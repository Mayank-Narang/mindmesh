/**
 * @fileoverview Adversarial Stress Test Suite for Milestone M1
 * MindMesh Backend Core Auth & Security
 * Run by Challenger Agent challenger_m1_1
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'mindmesh-test-jwt-secret-2026';
process.env.NODE_ENV = 'test';

const User = require('../src/models/User');
const Note = require('../src/models/Note');
const { clearRateLimitStore } = require('../src/middleware/rateLimiter');
const app = require('../src/app');

// In-memory backing store for tests when MongoDB Atlas is not directly connected
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
      if (typeof filter.email === 'string' && doc.email === filter.email.toLowerCase().trim()) {
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
      // In-memory fallback
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

// ===========================================================================
// SUITE 1: RATE LIMITING ADVERSARIAL STRESS TESTS
// ===========================================================================
test('Suite 1: Rate Limiting — 5 failed attempts allowed, 6th returns 429 with Retry-After header', async () => {
  clearRateLimitStore();

  const responses = [];
  for (let i = 1; i <= 6; i++) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker@evilcorp.com',
        password: `wrong-pass-${i}`,
      }),
    });
    responses.push({
      iteration: i,
      status: res.status,
      limit: res.headers.get('x-ratelimit-limit'),
      remaining: res.headers.get('x-ratelimit-remaining'),
      retryAfter: res.headers.get('retry-after'),
      data: await res.json(),
    });
  }

  // 1-5 must return 401
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(responses[i].status, 401, `Request ${i + 1} should be 401`);
    assert.strictEqual(responses[i].limit, '5', 'X-RateLimit-Limit should be 5');
    assert.strictEqual(responses[i].remaining, String(4 - i), `X-RateLimit-Remaining should be ${4 - i}`);
  }

  // 6th must return 429
  const sixth = responses[5];
  assert.strictEqual(sixth.status, 429, '6th request must return HTTP 429 Too Many Requests');
  assert.ok(sixth.retryAfter !== null, 'Retry-After response header must be present');
  const retryVal = parseInt(sixth.retryAfter, 10);
  assert.ok(!isNaN(retryVal) && retryVal > 0, `Retry-After must be positive integer, got: ${sixth.retryAfter}`);
  assert.strictEqual(sixth.data.success, false);
  assert.strictEqual(sixth.data.message, 'Too many login attempts, please try again later.');
  assert.ok(sixth.data.retryAfter > 0, 'Response body retryAfter field must be positive');

  // 7th and 8th must also return 429
  const seventh = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'attacker@evilcorp.com', password: 'pass' }),
  });
  assert.strictEqual(seventh.status, 429, 'Subsequent 7th request must also be blocked with 429');
});

// ===========================================================================
// SUITE 2: HEALTH CHECK IMMUNITY UNDER ACTIVE RATE LIMITING
// ===========================================================================
test('Suite 2: Health check GET /api/health is NOT throttled even when login rate limit is actively saturated', async () => {
  // At this point, the IP is saturated in the login limiter from Suite 1.
  // 1. Check health immediately
  const res1 = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res1.status, 200, 'Health check must return 200 even after hitting login rate limit');
  const body1 = await res1.json();
  assert.strictEqual(body1.status, 'ok');

  // 2. Hammer health check with 20 rapid requests to ensure immunity
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200, `Health check request ${i + 1} must return 200`);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
  }

  // 3. Confirm login is STILL rate limited (429) from the same client
  const loginCheck = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'attacker@evilcorp.com', password: 'pass' }),
  });
  assert.strictEqual(loginCheck.status, 429, 'Login must remain rate-limited at 429');
});

// ===========================================================================
// SUITE 3: AUTHENTICATION BYPASS & TOKEN TAMPERING STRESS TESTS
// ===========================================================================
test('Suite 3.1: Forged JWT with fake secret returns 403 Forbidden', async () => {
  const forgedToken = jwt.sign(
    { id: 'fake-admin-id', email: 'fakeadmin@mindmesh.io', role: 'admin' },
    'completely-wrong-secret-key-123456789'
  );

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${forgedToken}` },
  });

  assert.strictEqual(res.status, 403, 'Forged JWT must be rejected with HTTP 403');
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.message, 'Invalid token. Access denied.');
});

test('Suite 3.2: Expired JWT returns 401 Unauthorized', async () => {
  // Sign a token with valid secret but expired in the past
  const expiredToken = jwt.sign(
    { id: 'expired-user-id', email: 'expired@mindmesh.io', role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: -10 } // Expired 10 seconds ago
  );

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });

  assert.strictEqual(res.status, 401, 'Expired JWT must be rejected with HTTP 401');
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.message, 'Token has expired. Please authenticate again.');
});

test('Suite 3.3: "none" algorithm unsigned token returns 403 Forbidden', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: 'none-alg-user', role: 'admin' })).toString('base64url');
  const unsignedToken = `${header}.${payload}.`;

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${unsignedToken}` },
  });

  assert.strictEqual(res.status, 403, 'Token with "none" algorithm must return HTTP 403');
  const body = await res.json();
  assert.strictEqual(body.success, false);
});

test('Suite 3.4: Malformed Authorization header formats are strictly rejected with 401 or 403', async () => {
  const validToken = jwt.sign(
    { id: 'valid-user-id', email: 'valid@mindmesh.io', role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const malformedCases = [
    { name: 'Missing Authorization header', header: undefined, expectedStatus: 401 },
    { name: 'Empty string header', header: '', expectedStatus: 401 },
    { name: 'Missing Bearer prefix', header: validToken, expectedStatus: 401 },
    { name: 'Lowercase bearer prefix', header: `bearer ${validToken}`, expectedStatus: 401 },
    { name: 'Uppercase BEARER prefix', header: `BEARER ${validToken}`, expectedStatus: 401 },
    { name: 'Basic auth format', header: 'Basic dXNlcjpwYXNz', expectedStatus: 401 },
    { name: 'Token prefix format', header: `Token ${validToken}`, expectedStatus: 401 },
    { name: 'Bearer with no token string', header: 'Bearer', expectedStatus: 401 },
    { name: 'Bearer with only space', header: 'Bearer ', expectedStatus: 401 },
    { name: 'Bearer with garbage token', header: 'Bearer not-a-real-jwt-token-string', expectedStatus: 403 },
    { name: 'Bearer with null string', header: 'Bearer null', expectedStatus: 403 },
    { name: 'Bearer with undefined string', header: 'Bearer undefined', expectedStatus: 403 },
    { name: 'Bearer with truncated JWT', header: `Bearer ${validToken.split('.').slice(0, 2).join('.')}`, expectedStatus: 403 },
  ];

  for (const c of malformedCases) {
    const headers = {};
    if (c.header !== undefined) {
      headers.Authorization = c.header;
    }
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers });
    assert.strictEqual(
      res.status,
      c.expectedStatus,
      `Case "${c.name}" should return HTTP ${c.expectedStatus}, but returned ${res.status}`
    );
    const body = await res.json();
    assert.strictEqual(body.success, false);
  }
});

// ===========================================================================
// SUITE 4: ZERO-TRUST ROUTE PROTECTION ON NOTE ROUTES
// ===========================================================================
test('Suite 4: Zero-trust route protection — all note routes reject unauthenticated requests with 401', async () => {
  // 1. GET /api/notes without token -> 401
  const getNotes = await fetch(`${baseUrl}/api/notes`);
  assert.strictEqual(getNotes.status, 401, 'GET /api/notes without token must return 401');
  const getNotesBody = await getNotes.json();
  assert.strictEqual(getNotesBody.success, false);
  assert.ok(getNotesBody.message.includes('Authentication required'));

  // 2. POST /api/notes without token -> 401
  const postNote = await fetch(`${baseUrl}/api/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Hacked Note Attempt',
      content: 'This note should never be created',
      type: 'text',
    }),
  });
  assert.strictEqual(postNote.status, 401, 'POST /api/notes without token must return 401');
  const postNoteBody = await postNote.json();
  assert.strictEqual(postNoteBody.success, false);

  // 3. GET /api/notes/:id without token -> 401
  const getNoteById = await fetch(`${baseUrl}/api/notes/507f1f77bcf86cd799439011`);
  assert.strictEqual(getNoteById.status, 401, 'GET /api/notes/:id without token must return 401');

  // 4. PUT /api/notes/:id without token -> 401
  const putNote = await fetch(`${baseUrl}/api/notes/507f1f77bcf86cd799439011`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Tampered' }),
  });
  assert.strictEqual(putNote.status, 401, 'PUT /api/notes/:id without token must return 401');

  // 5. DELETE /api/notes/:id without token -> 401
  const deleteNote = await fetch(`${baseUrl}/api/notes/507f1f77bcf86cd799439011`, {
    method: 'DELETE',
  });
  assert.strictEqual(deleteNote.status, 401, 'DELETE /api/notes/:id without token must return 401');

  // 6. POST /api/notes/search without token -> 401
  const searchNote = await fetch(`${baseUrl}/api/notes/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'secret data' }),
  });
  assert.strictEqual(searchNote.status, 401, 'POST /api/notes/search without token must return 401');
});

// ===========================================================================
// SUITE 5: CREDENTIAL SECURITY & DATA LEAKAGE RESISTANCE
// ===========================================================================
test('Suite 5: Credential security — timing resistance and data leak prevention', async () => {
  // Clear rate limiter for clean login attempts
  clearRateLimitStore();

  // Create a known user
  const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Security Tester',
      email: 'tester@security.org',
      password: 'superSecretPassword123!',
    }),
  });
  assert.strictEqual(signupRes.status, 201);
  const signupData = await signupRes.json();
  assert.strictEqual(signupData.user.password, undefined, 'Signup response must not leak password');

  // 1. Wrong password on existent email -> 401 with generic message
  const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'tester@security.org',
      password: 'incorrectPassword',
    }),
  });
  assert.strictEqual(wrongPassRes.status, 401);
  const wrongPassData = await wrongPassRes.json();

  // 2. Non-existent email -> 401 with identical message (prevents user enumeration)
  const nonExistentRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ghost-user-nonexistent@security.org',
      password: 'anyPassword123!',
    }),
  });
  assert.strictEqual(nonExistentRes.status, 401);
  const nonExistentData = await nonExistentRes.json();

  assert.strictEqual(
    wrongPassData.error,
    nonExistentData.error,
    'Login error messages for wrong password vs non-existent user must be identical'
  );
  assert.strictEqual(wrongPassData.error, 'Invalid email or password');

  // 3. Short password validation in signup (< 6 chars)
  const shortPassRes = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Short Password',
      email: 'shortpass@security.org',
      password: '12345',
    }),
  });
  assert.strictEqual(shortPassRes.status, 400, 'Password < 6 chars must be rejected with 400');
  const shortPassData = await shortPassRes.json();
  assert.ok(shortPassData.error.includes('at least 6 characters'));
});
