const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = process.env.JWT_SECRET || "mindmesh-test-jwt-secret-2026";
process.env.NODE_ENV = "test";

const app = require("../src/app");
const { validateEnv } = require("../src/services/envValidator");
const Brain = require("../src/models/Brain");
const Note = require("../src/models/Note");

let server;
let baseUrl;

const userA = {
  id: "507f1f77bcf86cd799439001",
  email: "alice@example.com",
  role: "user",
};

const tokenA = jwt.sign(userA, process.env.JWT_SECRET);

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ---------------------------------------------------------------------------
// 1. Environment Validator Unit Tests
// ---------------------------------------------------------------------------
test("validateEnv: passes with valid configuration", () => {
  const env = {
    NODE_ENV: "development",
    MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/mindmesh",
    JWT_SECRET: "a_very_long_secure_secret_for_development_purposes_12345",
    GEMINI_API_KEY: "test_key",
    PORT: "5000",
  };

  const result = validateEnv({ env });
  assert.equal(result.isValid, true);
  assert.equal(result.fatalErrors.length, 0);
});

test("validateEnv: flags missing or invalid MONGODB_URI", () => {
  const resultMissing = validateEnv({
    env: { NODE_ENV: "development" },
  });
  assert.equal(resultMissing.isValid, false);
  assert.ok(resultMissing.fatalErrors.some((e) => e.includes("MONGODB_URI")));

  const resultInvalid = validateEnv({
    env: { NODE_ENV: "development", MONGODB_URI: "postgres://localhost/db" },
  });
  assert.equal(resultInvalid.isValid, false);
  assert.ok(resultInvalid.fatalErrors.some((e) => e.includes("mongodb://")));
});

test("validateEnv: enforces strict 32+ character JWT_SECRET in production", () => {
  const weakSecretResult = validateEnv({
    env: {
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster/db",
      JWT_SECRET: "short_secret",
    },
  });
  assert.equal(weakSecretResult.isValid, false);
  assert.ok(weakSecretResult.fatalErrors.some((e) => e.includes("32 characters")));

  const knownDefaultResult = validateEnv({
    env: {
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster/db",
      JWT_SECRET: "mindmesh-jwt-secret-dev-2026",
    },
  });
  assert.equal(knownDefaultResult.isValid, false);
  assert.ok(knownDefaultResult.fatalErrors.some((e) => e.includes("insecure default")));

  const validProdResult = validateEnv({
    env: {
      NODE_ENV: "production",
      MONGODB_URI: "mongodb+srv://cluster/db",
      JWT_SECRET: "c8f39487c69998246e8c7407a1b52f63810a0df2524d77519391ab1a21643c5b",
    },
  });
  assert.equal(validProdResult.isValid, true);
});

test("validateEnv: warns when GEMINI_API_KEY is omitted", () => {
  const result = validateEnv({
    env: {
      NODE_ENV: "development",
      MONGODB_URI: "mongodb+srv://cluster/db",
      JWT_SECRET: "dev_secret",
    },
  });
  assert.equal(result.isValid, true);
  assert.ok(result.warnings.some((w) => w.includes("GEMINI_API_KEY")));
});

// ---------------------------------------------------------------------------
// 2. Health Check Endpoint Tests
// ---------------------------------------------------------------------------
test("GET /api/health: returns enhanced status, version, and services", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.status, "ok");
  assert.ok(["connected", "disconnected"].includes(data.mongo));
  assert.equal(typeof data.version, "string");
  assert.equal(typeof data.uptimeSeconds, "number");
  assert.ok(typeof data.timestamp === "string");
  assert.ok(data.services);
  assert.ok(data.services.database);
});

// ---------------------------------------------------------------------------
// 3. CORS Preflight & Allowlist Tests
// ---------------------------------------------------------------------------
test("OPTIONS /api/notes: responds with CORS headers for allowed origin", async () => {
  const res = await fetch(`${baseUrl}/api/notes`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "GET",
    },
  });

  assert.ok([200, 204].includes(res.status));
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

// ---------------------------------------------------------------------------
// 4. Shares Route Query Test
// ---------------------------------------------------------------------------
test("GET /api/shares/shared-with-me: handles authenticated user request", async () => {
  // Mock Brain.find and Note.find when disconnected
  const origBrainFind = Brain.find;
  const origNoteFind = Note.find;

  Brain.find = function () {
    const q = { select: () => Promise.resolve([]), then: (r) => Promise.resolve([]).then(r) };
    return q;
  };
  Note.find = function () {
    const q = { select: () => Promise.resolve([]), then: (r) => Promise.resolve([]).then(r) };
    return q;
  };

  try {
    const res = await fetch(`${baseUrl}/api/shares/shared-with-me`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.brains));
    assert.ok(Array.isArray(data.notes));
  } finally {
    Brain.find = origBrainFind;
    Note.find = origNoteFind;
  }
});
