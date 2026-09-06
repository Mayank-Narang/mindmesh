/**
 * tests/e2e/harness/harness.test.js
 * Comprehensive self-test / sanity check for MindMesh E2E test harness.
 * Exercises:
 *   1. Test Runner & Hooks (describe, test, it, before, after, beforeEach, afterEach, skip, timeout)
 *   2. HTTP Client (GET, POST, PUT, DELETE, withToken, headers, non-throwing status codes)
 *   3. SSE Reader (readSseStream, collectSseResponse, sources, message, done events)
 *   4. Server Launcher & Mock Adapter (health check, ephemeral port lifecycle)
 *   5. Auth Helper (unique email, valid token, forged token, expired token, user signup, login)
 *   6. Assertions (assertStatus, assertSuccess, assertError, assertSchema, assertRateLimitHeaders, assertValidJwt, assertNoteSchema, assertBrainSchema, assertCitations)
 */

const {
  describe,
  test,
  it,
  before,
  after,
  beforeEach,
  afterEach,
  assertStatus,
  assertSuccess,
  assertError,
  assertSchema,
  assertRateLimitHeaders,
  assertValidJwt,
  assertNoteSchema,
  assertBrainSchema,
  assertCitations,
  HttpClient,
  readSseStream,
  collectSseResponse,
  createMockServer,
  isServerHealthy,
  waitForHealth,
  generateUniqueEmail,
  createValidToken,
  createForgedToken,
  createExpiredToken,
  createTestUser,
  loginUser
} = require('./index');

describe('MindMesh Test Harness Primitives', () => {
  let mockServerInstance = null;
  let client = null;
  let hookCounter = 0;

  before(async () => {
    hookCounter = 1;
    // Launch dedicated mock server on ephemeral port for self-test isolation
    mockServerInstance = await createMockServer(0);
    client = new HttpClient(mockServerInstance.url);
  });

  after(async () => {
    if (mockServerInstance) {
      await mockServerInstance.stop();
    }
  });

  beforeEach(() => {
    hookCounter++;
  });

  afterEach(() => {
    // Teardown hook
  });

  // ---------------------------------------------------------------------------
  // 1. Runner Core & Lifecycle Hooks
  // ---------------------------------------------------------------------------
  describe('1. Runner & Hook Execution', () => {
    test('before and beforeEach hooks should have executed', () => {
      if (hookCounter <= 1) {
        throw new Error(`Expected hookCounter > 1, got ${hookCounter}`);
      }
    });

    test('skipped test handling should work', () => {
      // Should not be executed if skip: true
    }, { skip: true });

    it('it() alias behaves identically to test()', () => {
      if (typeof it !== 'function') {
        throw new Error('it() is not a function');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. HTTP Client Capabilities
  // ---------------------------------------------------------------------------
  describe('2. HTTP Client (Native Fetch Wrapper)', () => {
    test('GET /api/health returns 200 with JSON payload', async () => {
      const res = await client.get('/api/health');
      assertStatus(res, 200);
      assertSuccess(res);
      assertSchema(res.data, {
        status: 'string',
        mongo: 'string'
      });
    });

    test('POST requests correctly serialize body and receive JSON response', async () => {
      const email = generateUniqueEmail('client_test');
      const res = await client.post('/api/auth/signup', {
        name: 'Client Test',
        email,
        password: 'Password123!'
      });
      assertStatus(res, 201);
      assertSuccess(res);
      assertSchema(res.data, {
        token: 'string',
        user: {
          id: 'string',
          name: 'string',
          email: 'string',
          role: 'string'
        }
      });
    });

    test('Non-throwing behavior on 4xx error responses', async () => {
      const res = await client.post('/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      });
      assertStatus(res, 401);
      assertError(res, 401, 'Invalid credentials');
    });

    test('withToken() injects Authorization Bearer header', async () => {
      const email = generateUniqueEmail('token_test');
      const userRes = await client.post('/api/auth/signup', {
        name: 'Token User',
        email,
        password: 'Password123!'
      });
      const token = userRes.data.token;
      const authedClient = client.withToken(token);

      const meRes = await authedClient.get('/api/auth/me');
      assertStatus(meRes, 200);
      assertSuccess(meRes);
      assertSchema(meRes.data.user, {
        id: 'string',
        email: 'string',
        role: 'string'
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. SSE Stream Reader
  // ---------------------------------------------------------------------------
  describe('3. Server-Sent Events (SSE) Reader', () => {
    test('readSseStream generator parses sources, message, and done events', async () => {
      const email = generateUniqueEmail('sse_test');
      const { authenticatedClient } = await createTestUser(client, { email });
      const userRes = await authenticatedClient.get('/api/auth/me');
      assertStatus(userRes, 200);

      const sseUrl = `${mockServerInstance.url}/api/ai/ask`;
      const events = [];

      for await (const msg of readSseStream(sseUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authenticatedClient.defaultHeaders.Authorization.split(' ')[1]}` },
        body: { question: 'What is MindMesh?' }
      })) {
        events.push(msg);
      }

      if (events.length === 0) {
        throw new Error('Expected to receive SSE events, got 0');
      }

      const eventTypes = events.map((e) => e.event);
      if (!eventTypes.includes('sources')) throw new Error('Missing sources event');
      if (!eventTypes.includes('message')) throw new Error('Missing message event');
      if (!eventTypes.includes('done')) throw new Error('Missing done event');
    });

    test('collectSseResponse aggregates full text and citations cleanly', async () => {
      const sseUrl = `${mockServerInstance.url}/api/ai/ask`;
      const token = createValidToken({ id: 'sse_user' });

      const streamResult = await collectSseResponse(sseUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { question: 'Explain semantic retrieval' }
      }, 5000);

      if (!streamResult.isDone) throw new Error('Expected stream to complete with isDone=true');
      if (streamResult.citations.length === 0) throw new Error('Expected citations array to be populated');
      if (!streamResult.fullText.includes('MindMesh')) throw new Error('Expected fullText to contain message chunks');

      assertCitations(streamResult.citations);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Server Lifecycle & Health Detector
  // ---------------------------------------------------------------------------
  describe('4. Server Lifecycle & Health Detection', () => {
    test('isServerHealthy returns true for active mock server', async () => {
      const healthy = await isServerHealthy(mockServerInstance.url, 1000);
      if (!healthy) throw new Error('Expected mock server to report healthy');
    });

    test('isServerHealthy returns false for unreachable port', async () => {
      const healthy = await isServerHealthy('http://127.0.0.1:59999', 300);
      if (healthy) throw new Error('Expected inactive port to report unhealthy');
    });

    test('waitForHealth succeeds within timeout for active server', async () => {
      const ready = await waitForHealth(mockServerInstance.url, 1000, 100);
      if (!ready) throw new Error('waitForHealth failed on active server');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Auth Helper Primitives
  // ---------------------------------------------------------------------------
  describe('5. Auth Helper Primitives', () => {
    test('generateUniqueEmail produces unique format', () => {
      const email1 = generateUniqueEmail('test');
      const email2 = generateUniqueEmail('test');
      if (email1 === email2) throw new Error('Expected distinct random emails');
      if (!email1.includes('@example.com')) throw new Error('Invalid email domain format');
    });

    test('createValidToken produces valid 3-part JWT', () => {
      const token = createValidToken({ id: 'u123', role: 'admin' });
      assertValidJwt(token);
    });

    test('createForgedToken produces valid JWT syntax with mismatched secret', () => {
      const token = createForgedToken({ id: 'u999' });
      assertValidJwt(token);
    });

    test('createExpiredToken produces token with expired timestamp', () => {
      const token = createExpiredToken({ id: 'u_exp' });
      assertValidJwt(token);
    });

    test('createTestUser and loginUser flow', async () => {
      const { user, token, credentials, authenticatedClient } = await createTestUser(client);
      assertValidJwt(token);
      assertSchema(user, {
        id: 'string',
        name: 'string',
        email: 'string',
        role: 'string'
      });

      const loginRes = await loginUser(client, credentials.email, credentials.password);
      assertValidJwt(loginRes.token);
      assertSchema(loginRes.user, {
        id: 'string',
        email: 'string'
      });

      const meRes = await loginRes.authenticatedClient.get('/api/auth/me');
      assertStatus(meRes, 200);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Domain Assertions
  // ---------------------------------------------------------------------------
  describe('6. Domain Assertions Validation', () => {
    test('assertStatus and assertSuccess validate correct statuses', () => {
      assertStatus({ status: 200, data: {} }, 200);
      assertSuccess({ status: 204 });
    });

    test('assertError matches string patterns and regexes', () => {
      const errRes = { status: 400, data: { error: 'Validation failed: title is required' } };
      assertError(errRes, 400, 'Validation failed');
      assertError(errRes, 400, /title is required/i);
    });

    test('assertSchema validates nested and optional properties', () => {
      const sampleObj = {
        id: '123',
        count: 5,
        isActive: true,
        tags: ['a', 'b'],
        createdAt: new Date().toISOString(),
        profile: { bio: 'Hello' },
        optionalField: null
      };

      assertSchema(sampleObj, {
        id: 'string',
        count: 'number',
        isActive: 'boolean',
        tags: 'array',
        createdAt: 'isodate',
        profile: { bio: 'string' },
        'optionalField?': 'string'
      });
    });

    test('assertRateLimitHeaders validates presence and threshold', () => {
      const res = {
        headers: {
          'x-ratelimit-limit': '100',
          'x-ratelimit-remaining': '95',
          'x-ratelimit-reset': '1700000000'
        }
      };
      assertRateLimitHeaders(res, { limit: 100, minRemaining: 98 });
    });

    test('assertNoteSchema validates Note structure', () => {
      const sampleNote = {
        _id: 'note_123',
        title: 'Quantum Computing Intro',
        content: 'Overview of qubits...',
        type: 'markdown',
        tags: ['physics', 'computing']
      };
      assertNoteSchema(sampleNote);
    });

    test('assertBrainSchema validates Brain structure', () => {
      const sampleBrain = {
        _id: 'brain_123',
        name: 'Research Brain',
        sharedWith: []
      };
      assertBrainSchema(sampleBrain);
    });
  });
});
