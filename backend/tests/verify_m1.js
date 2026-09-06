/**
 * @fileoverview Automated Verification Test Suite for Milestone M1
 * MindMesh Backend Core Auth & Security
 *
 * Tests:
 * 1. Health check GET /api/health -> 200 { status: "ok" } unaffected by auth or rate limiting
 * 2. User model schema validations, bcrypt pre-save hashing, comparePassword, and toJSON leak prevention
 * 3. POST /api/auth/signup -> 201 { token, user: { id, name, email, role } }
 * 4. POST /api/auth/signup duplicate email rejection -> 400
 * 5. POST /api/auth/login with valid credentials -> 200 { token, user }
 * 6. POST /api/auth/login with invalid password -> 401
 * 7. POST /api/auth/login with non-existent email -> 401
 * 8. GET /api/auth/me with Bearer token -> 200 { user: { id, name, email, role, createdAt } }
 * 9. GET /api/auth/me without token -> 401
 * 10. GET /api/auth/me with invalid token -> 403
 * 11. GET /api/notes without token -> 401
 * 12. GET /api/notes with token -> succeeds (doesn't return 401)
 * 13. Rate limiting on POST /api/auth/login -> 429 after 5 requests with retry-after
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const mongoose = require('mongoose');

// Ensure test environment variables
process.env.JWT_SECRET = process.env.JWT_SECRET || 'mindmesh-test-jwt-secret-2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Note = require('../src/models/Note');
const { clearRateLimitStore } = require('../src/middleware/rateLimiter');
const app = require('../src/app');

// In-memory backing store for tests when MongoDB Atlas is disconnected
const memoryUsers = new Map();

function makeQuery(resultPromise) {
  const q = {
    select: () => q,
    sort: () => q,
    skip: () => q,
    limit: () => q,
    populate: () => q,
    then: (resolve, reject) => resultPromise.then(resolve, reject),
    catch: (reject) => resultPromise.catch(reject),
    exec: () => resultPromise,
  };
  return q;
}

// Intercept Mongoose queries if disconnected from MongoDB
const originalUserSave = User.prototype.save;
const originalUserFindOne = User.findOne;
const originalUserFindById = User.findById;
const originalNoteFind = Note.find;
const originalNoteCount = Note.countDocuments;

User.prototype.save = async function (...args) {
  if (mongoose.connection.readyState === 1) {
    return originalUserSave.apply(this, args);
  }
  await this.validate();
  const preSaveHooks = User.schema.s.hooks._pres.get('save') || [];
  for (const hook of preSaveHooks) {
    await new Promise((resolve, reject) => {
      if (hook.fn.length >= 1) {
        hook.fn.call(this, (err) => (err ? reject(err) : resolve()));
      } else {
        Promise.resolve(hook.fn.call(this)).then(resolve, reject);
      }
    });
  }
  memoryUsers.set(this._id.toString(), this);
  return this;
};

User.findOne = function (filter, ...args) {
  if (mongoose.connection.readyState === 1) {
    return originalUserFindOne.call(this, filter, ...args);
  }
  const findPromise = (async () => {
    for (const doc of memoryUsers.values()) {
      if (filter.email && doc.email === filter.email.toLowerCase().trim()) {
        return doc;
      }
      if (filter._id && doc._id.toString() === filter._id.toString()) {
        return doc;
      }
    }
    return null;
  })();
  return makeQuery(findPromise);
};

User.findById = function (id, ...args) {
  if (mongoose.connection.readyState === 1) {
    return originalUserFindById.call(this, id, ...args);
  }
  const findPromise = (async () => {
    return memoryUsers.get(id ? id.toString() : '') || null;
  })();
  return makeQuery(findPromise);
};

Note.find = function (...args) {
  if (mongoose.connection.readyState === 1) {
    return originalNoteFind.apply(this, args);
  }
  return makeQuery(Promise.resolve([]));
};

Note.countDocuments = function (...args) {
  if (mongoose.connection.readyState === 1) {
    return originalNoteCount.apply(this, args);
  }
  return Promise.resolve(0);
};

let server;
let baseUrl;

test.before(async () => {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    } catch (_err) {
      // Continue with in-memory persistence
    }
  }

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  clearRateLimitStore();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
});

test('1. Health check GET /api/health returns 200 { status: "ok" }', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.ok('mongo' in data);
});

test('2. User model schema validations, bcrypt hashing, and toJSON leak prevention', async () => {
  const u = new User({
    name: '  Test Model User  ',
    email: ' MODELUSER@EXAMPLE.COM ',
    password: 'password123',
  });

  assert.strictEqual(u.name, 'Test Model User');
  assert.strictEqual(u.email, 'modeluser@example.com');

  await u.save();

  assert.ok(u.password.startsWith('$2'), 'Password should be hashed with bcrypt');
  assert.strictEqual(await u.comparePassword('password123'), true);
  assert.strictEqual(await u.comparePassword('wrongpwd'), false);

  const json = u.toJSON();
  assert.strictEqual(json.password, undefined, 'Password must not leak in toJSON');
  assert.strictEqual(json.id, u._id.toString(), 'toJSON must expose id alias');
  assert.strictEqual(json.__v, undefined, '__v must be stripped from toJSON');
});

test('3. POST /api/auth/signup creates user and returns 201 with token and user object', async () => {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Developer',
      email: 'alice@mindmesh.io',
      password: 'mypassword123',
    }),
  });

  assert.strictEqual(res.status, 201);
  const data = await res.json();
  assert.ok(typeof data.token === 'string' && data.token.length > 20, 'Should return valid JWT');
  assert.strictEqual(data.user.name, 'Alice Developer');
  assert.strictEqual(data.user.email, 'alice@mindmesh.io');
  assert.strictEqual(data.user.role, 'user');
  assert.strictEqual(data.user.password, undefined, 'Password must not be in response');
  assert.ok(data.user.id, 'User id should be present');
});

test('4. POST /api/auth/signup rejects duplicate email with 400', async () => {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alice Duplicate',
      email: 'alice@mindmesh.io',
      password: 'anotherpassword123',
    }),
  });

  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.ok(data.error);
});

test('5. POST /api/auth/login succeeds with valid credentials -> 200 with token and user', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@mindmesh.io',
      password: 'mypassword123',
    }),
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(typeof data.token === 'string' && data.token.length > 20);
  assert.strictEqual(data.user.email, 'alice@mindmesh.io');
  assert.strictEqual(data.user.password, undefined);
});

test('6. POST /api/auth/login fails with invalid password -> 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@mindmesh.io',
      password: 'wrongpassword',
    }),
  });

  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.error, 'Invalid email or password');
});

test('7. POST /api/auth/login fails with non-existent email -> 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nonexistent@mindmesh.io',
      password: 'anypassword',
    }),
  });

  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.error, 'Invalid email or password');
});

test('8. GET /api/auth/me with Bearer token -> 200 with user profile', async () => {
  // First login to get a fresh token
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@mindmesh.io',
      password: 'mypassword123',
    }),
  });
  const { token } = await loginRes.json();

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.strictEqual(meRes.status, 200);
  const data = await meRes.json();
  assert.strictEqual(data.user.name, 'Alice Developer');
  assert.strictEqual(data.user.email, 'alice@mindmesh.io');
  assert.strictEqual(data.user.role, 'user');
  assert.strictEqual(data.user.password, undefined);
  assert.ok(data.user.id);
});

test('9. GET /api/auth/me without token -> 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.success, false);
});

test('10. GET /api/auth/me with invalid token -> 403', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      Authorization: 'Bearer invalid.jwt.token.string',
    },
  });
  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.strictEqual(data.success, false);
});

test('11. Access notes route without token -> 401', async () => {
  const res = await fetch(`${baseUrl}/api/notes`);
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.ok(data.message.includes('Authentication required'));
});

test('12. Access notes route with valid token -> succeeds (doesn\'t return 401)', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alice@mindmesh.io',
      password: 'mypassword123',
    }),
  });
  const { token } = await loginRes.json();

  const res = await fetch(`${baseUrl}/api/notes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.notStrictEqual(res.status, 401, 'Notes access should not be rejected with 401 when token is provided');
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.notes));
});

test('13. Rate limiting on /api/auth/login triggers 429 after 5 requests', async () => {
  // Clear rate limit store so this test has a dedicated 5-attempt window
  clearRateLimitStore();

  const attempts = [];
  for (let i = 1; i <= 6; i++) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker@mindmesh.io',
        password: `badpass${i}`,
      }),
    });
    attempts.push({
      iteration: i,
      status: res.status,
      limit: res.headers.get('x-ratelimit-limit'),
      remaining: res.headers.get('x-ratelimit-remaining'),
      retryAfter: res.headers.get('retry-after'),
      body: await res.json(),
    });
  }

  // Requests 1 through 5 should return 401 (invalid credentials)
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(attempts[i].status, 401, `Request ${i + 1} should be 401`);
    assert.strictEqual(attempts[i].limit, '5', 'Limit header should be 5');
    assert.strictEqual(attempts[i].remaining, String(4 - i), `Remaining should decrease to ${4 - i}`);
  }

  // Request 6 must return 429 Too Many Requests
  const sixth = attempts[5];
  assert.strictEqual(sixth.status, 429, '6th request must be blocked with HTTP 429');
  assert.strictEqual(sixth.body.success, false);
  assert.strictEqual(sixth.body.message, 'Too many login attempts, please try again later.');
  assert.ok(sixth.retryAfter !== null, 'Retry-After header must be present');
  assert.ok(sixth.body.retryAfter > 0, 'retryAfter field must be positive');
});
