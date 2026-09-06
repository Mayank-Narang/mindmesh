/**
 * tests/e2e/harness/assertions.js
 * Domain-specific assertions extending Node.js native `node:assert/strict`.
 * Provides detailed diagnostics for HTTP status codes, schema validation,
 * rate limit headers, JWT format, and MindMesh domain structures (Note, Brain, Citations).
 */

const assert = require('node:assert/strict');

/**
 * Assert that an HTTP response has the expected status code.
 * @param {object} res - HttpClient response object
 * @param {number} expectedStatus - Expected HTTP status code
 * @param {string} [customMessage]
 */
function assertStatus(res, expectedStatus, customMessage) {
  assert.equal(
    res.status,
    expectedStatus,
    customMessage ||
      `Expected HTTP ${expectedStatus} but received ${res.status}. Body: ${JSON.stringify(res.data || res.rawText)}`
  );
}

/**
 * Assert that an HTTP response indicates success (2xx).
 * @param {object} res - HttpClient response object
 * @param {string} [customMessage]
 */
function assertSuccess(res, customMessage) {
  assert.ok(
    res.status >= 200 && res.status < 300,
    customMessage ||
      `Expected 2xx success status but received ${res.status}. Body: ${JSON.stringify(res.data || res.rawText)}`
  );
}

/**
 * Assert that an HTTP response represents an error with expected status and message pattern.
 * @param {object} res
 * @param {number} expectedStatus
 * @param {string|RegExp} [messagePattern]
 */
function assertError(res, expectedStatus, messagePattern) {
  assertStatus(res, expectedStatus);
  if (messagePattern) {
    const errorMsg =
      res.data?.error ||
      res.data?.message ||
      (typeof res.data === 'string' ? res.data : res.rawText || '');

    if (messagePattern instanceof RegExp) {
      assert.match(
        String(errorMsg),
        messagePattern,
        `Error message "${errorMsg}" did not match pattern ${messagePattern}`
      );
    } else {
      assert.ok(
        String(errorMsg).toLowerCase().includes(String(messagePattern).toLowerCase()),
        `Expected error message "${errorMsg}" to contain "${messagePattern}"`
      );
    }
  }
}

/**
 * Assert that an object adheres to a type specification.
 * Supports: string, number, boolean, array, object, isodate, optional (key with trailing '?')
 * @param {object} obj - Object to test
 * @param {Record<string, string|object>} schemaDef - Schema specification
 * @param {string} [path='$']
 */
function assertSchema(obj, schemaDef, path = '$') {
  assert.ok(
    obj && typeof obj === 'object',
    `Expected object at ${path}, received: ${typeof obj}`
  );

  for (const [key, rawExpectedType] of Object.entries(schemaDef)) {
    const currentPath = `${path}.${key}`;
    const isOptional = key.endsWith('?') || (typeof rawExpectedType === 'string' && rawExpectedType.endsWith('?'));
    const actualKey = key.replace(/\?$/, '');
    let expectedType = typeof rawExpectedType === 'string' ? rawExpectedType.replace(/\?$/, '') : rawExpectedType;

    const val = obj[actualKey];

    if (isOptional && (val === undefined || val === null)) {
      continue;
    }

    assert.notEqual(
      val,
      undefined,
      `Missing required property at ${currentPath}`
    );

    if (typeof expectedType === 'object' && !Array.isArray(expectedType)) {
      assertSchema(val, expectedType, currentPath);
    } else if (expectedType === 'array') {
      assert.ok(
        Array.isArray(val),
        `Expected array at ${currentPath}, received: ${typeof val}`
      );
    } else if (expectedType === 'isodate') {
      assert.ok(
        typeof val === 'string' && !isNaN(Date.parse(val)),
        `Expected ISO date string at ${currentPath}, received: "${val}"`
      );
    } else {
      assert.equal(
        typeof val,
        expectedType,
        `Expected type "${expectedType}" at ${currentPath}, received: "${typeof val}"`
      );
    }
  }
}

/**
 * Assert that standard rate limiting headers exist and comply with bounds.
 * @param {object} res
 * @param {{ limit?: number, minRemaining?: number }} [options]
 */
function assertRateLimitHeaders(res, options = {}) {
  const headers = res.headers || {};
  assert.ok(
    headers['x-ratelimit-limit'] !== undefined,
    'Missing X-RateLimit-Limit header'
  );
  assert.ok(
    headers['x-ratelimit-remaining'] !== undefined,
    'Missing X-RateLimit-Remaining header'
  );
  assert.ok(
    headers['x-ratelimit-reset'] !== undefined,
    'Missing X-RateLimit-Reset header'
  );

  if (options.limit !== undefined) {
    assert.equal(
      Number(headers['x-ratelimit-limit']),
      options.limit,
      `Expected X-RateLimit-Limit to be ${options.limit}, got ${headers['x-ratelimit-limit']}`
    );
  }

  if (options.minRemaining !== undefined) {
    const remaining = Number(headers['x-ratelimit-remaining']);
    assert.ok(
      remaining <= options.minRemaining,
      `Expected X-RateLimit-Remaining <= ${options.minRemaining}, got ${remaining}`
    );
  }
}

/**
 * Assert that a token string is a syntactically valid three-part JWT.
 * @param {string} token
 * @param {string} [customMessage]
 */
function assertValidJwt(token, customMessage) {
  assert.ok(
    typeof token === 'string' && token.length > 0,
    customMessage || 'Expected token to be a non-empty string'
  );
  const parts = token.split('.');
  assert.equal(
    parts.length,
    3,
    customMessage || `Expected 3-part JWT (header.payload.signature) but found ${parts.length} parts`
  );

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
    assert.ok(header.alg, 'JWT header missing alg property');
  } catch (err) {
    assert.fail(`Failed to parse JWT header: ${err.message}`);
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    assert.ok(typeof payload === 'object', 'JWT payload is not a valid JSON object');
  } catch (err) {
    assert.fail(`Failed to parse JWT payload: ${err.message}`);
  }
}

/**
 * Assert that an array represents valid AI citation source items.
 * @param {Array<any>} citations
 */
function assertCitations(citations) {
  assert.ok(
    Array.isArray(citations),
    `Expected citations to be an array, got ${typeof citations}`
  );
  for (const [idx, item] of citations.entries()) {
    assert.ok(
      item && typeof item === 'object',
      `Citation at index ${idx} must be an object`
    );
    assert.ok(
      item.id || item._id,
      `Citation at index ${idx} missing id property`
    );
    assert.ok(
      item.title !== undefined,
      `Citation at index ${idx} missing title property`
    );
    assert.ok(
      typeof item.snippet === 'string',
      `Citation at index ${idx} missing snippet string`
    );
  }
}

/**
 * Assert that an object complies with the MindMesh Note schema.
 * @param {object} note
 */
function assertNoteSchema(note) {
  assert.ok(note && typeof note === 'object', 'Expected Note to be an object');
  assert.ok(note._id || note.id, 'Note missing identifier (_id/id)');
  assert.ok(typeof note.title === 'string', 'Note title must be a string');
  assert.ok(typeof note.type === 'string', 'Note type must be a string');
  assert.ok(
    ['text', 'markdown', 'url'].includes(note.type),
    `Unknown note type: ${note.type}`
  );
  if (note.tags !== undefined) {
    assert.ok(Array.isArray(note.tags), 'Note tags must be an array');
  }
}

/**
 * Assert that an object complies with the MindMesh Brain schema.
 * @param {object} brain
 */
function assertBrainSchema(brain) {
  assert.ok(brain && typeof brain === 'object', 'Expected Brain to be an object');
  assert.ok(brain._id || brain.id, 'Brain missing identifier (_id/id)');
  assert.ok(typeof brain.name === 'string', 'Brain name must be a string');
  if (brain.sharedWith !== undefined) {
    assert.ok(Array.isArray(brain.sharedWith), 'Brain sharedWith must be an array');
  }
}

module.exports = {
  ...assert,
  assertStatus,
  assertSuccess,
  assertError,
  assertSchema,
  assertRateLimitHeaders,
  assertValidJwt,
  assertCitations,
  assertNoteSchema,
  assertBrainSchema
};
