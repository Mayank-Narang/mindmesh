const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = process.env.JWT_SECRET || "mindmesh-test-jwt-secret-2026";
process.env.NODE_ENV = "test";

const app = require("../src/app");
const Note = require("../src/models/Note");
const Brain = require("../src/models/Brain");
const NoteChunk = require("../src/models/NoteChunk");
const {
  generateEmbedding,
  generateQueryEmbedding,
  clearEmbeddingCache,
  getEmbeddingCacheSize,
} = require("../src/services/vector");
const { extractMetadata } = require("../src/services/scraper");
const { generateBrainMemoryState } = require("../src/services/brainMemory");

// Disconnected Mongoose query interception for fast offline test execution
const originalBrainFind = Brain.find;
const originalBrainFindById = Brain.findById;
const originalNoteFind = Note.find;

Brain.find = function (...args) {
  if (mongoose.connection.readyState === 1) {
    return originalBrainFind.apply(this, args);
  }
  const q = {
    select: () => q,
    sort: () => q,
    then: (resolve, reject) => Promise.resolve([]).then(resolve, reject),
    catch: (reject) => Promise.resolve([]).catch(reject),
    exec: () => Promise.resolve([]),
  };
  return q;
};

Brain.findById = function (...args) {
  if (mongoose.connection.readyState === 1) {
    return originalBrainFindById.apply(this, args);
  }
  const q = {
    then: (resolve, reject) => Promise.resolve(null).then(resolve, reject),
    catch: (reject) => Promise.resolve(null).catch(reject),
    exec: () => Promise.resolve(null),
  };
  return q;
};

Note.find = function (...args) {
  if (mongoose.connection.readyState === 1) {
    return originalNoteFind.apply(this, args);
  }
  const q = {
    select: () => q,
    sort: () => q,
    limit: () => q,
    then: (resolve, reject) => Promise.resolve([]).then(resolve, reject),
    catch: (reject) => Promise.resolve([]).catch(reject),
    exec: () => Promise.resolve([]),
  };
  return q;
};

const originalNoteChunkAggregate = NoteChunk.aggregate;
const originalNoteChunkFind = NoteChunk.find;

NoteChunk.aggregate = function (...args) {
  if (mongoose.connection.readyState === 1) {
    return originalNoteChunkAggregate.apply(this, args);
  }
  return Promise.resolve([]);
};

NoteChunk.find = function (...args) {
  if (mongoose.connection.readyState === 1) {
    return originalNoteChunkFind.apply(this, args);
  }
  const q = {
    populate: () => q,
    lean: () => Promise.resolve([]),
    then: (resolve, reject) => Promise.resolve([]).then(resolve, reject),
    catch: (reject) => Promise.resolve([]).catch(reject),
    exec: () => Promise.resolve([]),
  };
  return q;
};

const userA = {
  id: "507f1f77bcf86cd799439001",
  email: "alice@example.com",
  role: "user",
};

const userB = {
  id: "507f1f77bcf86cd799439002",
  email: "bob@example.com",
  role: "user",
};

const tokenA = jwt.sign(userA, process.env.JWT_SECRET);
const tokenB = jwt.sign(userB, process.env.JWT_SECRET);

let server;
let baseUrl;

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
// 1. Vector Embedding Service: Caching & Stats
// ---------------------------------------------------------------------------
test("vector: in-memory cache operations", () => {
  clearEmbeddingCache();
  assert.equal(getEmbeddingCacheSize(), 0);
});

// ---------------------------------------------------------------------------
// 2. Scraper Service: SSRF Protection & Safe Timeouts
// ---------------------------------------------------------------------------
test("scraper: rejects SSRF attacks and internal network addresses", async () => {
  const unsafeUrls = [
    "http://localhost:3000/admin",
    "http://127.0.0.1:8080/secret",
    "http://[::1]:5000/info",
    "http://169.254.169.254/latest/meta-data/", // AWS/Cloud metadata
    "http://10.0.0.1/router",
    "http://192.168.1.1/gateway",
    "http://172.16.0.1/internal",
    "http://0.0.0.0:80",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "ftp://ftp.example.com",
  ];

  for (const target of unsafeUrls) {
    const meta = await extractMetadata(target, 100);
    assert.equal(meta.title, "", `Expected rejection for SSRF URL: ${target}`);
    assert.equal(meta.description, "");
  }
});

// ---------------------------------------------------------------------------
// 3. Brain Memory State: Compact JSON Generation
// ---------------------------------------------------------------------------
test("brainMemory: generates compact JSON memory state for empty brain", async () => {
  const brain = {
    _id: new mongoose.Types.ObjectId(),
    name: "Research Brain",
    description: "",
    save: async function () {},
  };

  // Mock Note.find to return empty array
  const origFind = Note.find;
  Note.find = function () {
    const q = {
      sort: () => q,
      select: () => Promise.resolve([]),
      then: (r) => Promise.resolve([]).then(r),
    };
    return q;
  };

  try {
    const state = await generateBrainMemoryState(brain, { save: false, useAi: false });
    assert.equal(state.noteCount, 0);
    assert.ok(state.summary.includes("Empty brain"));
    assert.equal(typeof brain.description, "string");

    // Verify it is valid JSON
    const parsed = JSON.parse(brain.description);
    assert.equal(parsed.noteCount, 0);
    assert.ok(brain.description.length <= 500);
  } finally {
    Note.find = origFind;
  }
});

test("brainMemory: generates structured metadata for populated brain", async () => {
  const brain = {
    _id: new mongoose.Types.ObjectId(),
    name: "Backend Architecture",
    description: "",
    save: async function () {},
  };

  const sampleNotes = [
    { title: "JWT Auth Flow", type: "text", tags: ["auth", "security"], updatedAt: new Date() },
    { title: "Docker Deployment", type: "markdown", tags: ["docker", "devops"], updatedAt: new Date() },
    { title: "Mongo Atlas Guide", type: "url", tags: ["database", "auth"], updatedAt: new Date() },
  ];

  const origFind = Note.find;
  Note.find = function () {
    const q = {
      sort: () => q,
      select: () => Promise.resolve(sampleNotes),
      then: (r) => Promise.resolve(sampleNotes).then(r),
    };
    return q;
  };

  try {
    const state = await generateBrainMemoryState(brain, { save: false, useAi: false });
    assert.equal(state.noteCount, 3);
    assert.equal(state.types.text, 1);
    assert.equal(state.types.markdown, 1);
    assert.equal(state.types.url, 1);
    assert.ok(state.tags.includes("auth"));
    assert.ok(state.topics.includes("JWT Auth Flow"));
    assert.ok(brain.description.length <= 500);

    const parsed = JSON.parse(brain.description);
    assert.equal(parsed.noteCount, 3);
    assert.ok(parsed.summary.length > 0);
  } finally {
    Note.find = origFind;
  }
});

// ---------------------------------------------------------------------------
// 4. AI Ask Route: Authorization, Validation & SSE Response
// ---------------------------------------------------------------------------
test("POST /api/ai/ask rejects requests without authorization token with 401", async () => {
  const res = await fetch(`${baseUrl}/api/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "How does JWT work?" }),
  });

  assert.equal(res.status, 401);
});

test("POST /api/ai/ask rejects empty question with 400", async () => {
  const res = await fetch(`${baseUrl}/api/ai/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ question: "   " }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "A non-empty 'question' string is required");
});

test("POST /api/ai/ask rejects invalid brainId format with 400", async () => {
  const res = await fetch(`${baseUrl}/api/ai/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ question: "Tell me about security", brainId: "bad-id" }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "Invalid brain ID");
});

test("POST /api/ai/ask streams SSE events: sources, message, done", async () => {
  const res = await fetch(`${baseUrl}/api/ai/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ question: "What is the project architecture?" }),
  });

  assert.equal(res.status, 200);
  assert.ok(res.headers.get("content-type").includes("text/event-stream"));

  const bodyText = await res.text();
  assert.ok(bodyText.includes("event: sources"));
  assert.ok(bodyText.includes("event: message") || bodyText.includes("event: done"));
  assert.ok(bodyText.includes("event: done"));
});
