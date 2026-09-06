/**
 * tests/e2e/harness/authHelper.js
 * User generation, JWT signing/verification, and authenticated client helper.
 * Supports token creation, forged token generation, expired token creation,
 * and automated user registration/login flows.
 */

const crypto = require('node:crypto');
const path = require('node:path');

// Safe module loading for jsonwebtoken
let jwtModule = null;
try {
  jwtModule = require('jsonwebtoken');
} catch {
  try {
    const backendJwtPath = path.resolve(__dirname, '../../../backend/node_modules/jsonwebtoken');
    jwtModule = require(backendJwtPath);
  } catch {
    jwtModule = null;
  }
}

const DEFAULT_SECRET =
  process.env.JWT_SECRET || 'mindmesh-test-secret-key-32-chars-long-e2e';

/**
 * Generate a unique email for test isolation.
 * @param {string} prefix
 * @returns {string}
 */
function generateUniqueEmail(prefix = 'user') {
  const rand = Math.random().toString(36).substring(2, 8);
  return `test_${prefix}_${Date.now()}_${rand}@example.com`;
}

/**
 * Native Node HMAC-SHA256 JWT sign fallback if jsonwebtoken package is unavailable.
 */
function nativeSign(payload, secret, expiresInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');

  return `${data}.${signature}`;
}

/**
 * Create a valid signed JWT token.
 * @param {object} payload
 * @param {string} secret
 * @param {string|number} expiresIn
 * @returns {string}
 */
function createValidToken(
  payload = { id: 'test_user_id', role: 'user' },
  secret = DEFAULT_SECRET,
  expiresIn = '1h'
) {
  if (jwtModule && typeof jwtModule.sign === 'function') {
    return jwtModule.sign(payload, secret, { expiresIn });
  }
  const seconds = typeof expiresIn === 'number' ? expiresIn : 3600;
  return nativeSign(payload, secret, seconds);
}

/**
 * Create a forged JWT token signed with an untrusted / mismatched secret key.
 * Used for 403 Forbidden verification tests.
 * @param {object} payload
 * @param {string} secret
 * @param {string} expiresIn
 * @returns {string}
 */
function createForgedToken(
  payload = { id: 'attacker_user_id', role: 'admin' },
  secret = 'wrong-unauthorized-secret-key-999',
  expiresIn = '1h'
) {
  if (jwtModule && typeof jwtModule.sign === 'function') {
    return jwtModule.sign(payload, secret, { expiresIn });
  }
  return nativeSign(payload, secret, 3600);
}

/**
 * Create an expired JWT token (negative expiration timestamp).
 * Used for 401 Unauthorized / TokenExpiredError tests.
 * @param {object} payload
 * @param {string} secret
 * @returns {string}
 */
function createExpiredToken(
  payload = { id: 'expired_user_id', role: 'user' },
  secret = DEFAULT_SECRET
) {
  if (jwtModule && typeof jwtModule.sign === 'function') {
    return jwtModule.sign(payload, secret, { expiresIn: '-10s' });
  }
  return nativeSign(payload, secret, -60);
}

/**
 * Create a new user through POST /api/auth/signup and return credentials and authenticated client.
 * @param {import('./httpClient').HttpClient} client
 * @param {object} overrides
 * @returns {Promise<{
 *   user: object,
 *   token: string,
 *   credentials: { name: string, email: string, password: string },
 *   authenticatedClient: import('./httpClient').HttpClient
 * }>}
 */
async function createTestUser(client, overrides = {}) {
  const payload = {
    name: overrides.name || 'E2E Test User',
    email: overrides.email || generateUniqueEmail('signup'),
    password: overrides.password || 'StrongP@ssw0rd!123'
  };

  const res = await client.post('/api/auth/signup', payload);
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `Failed to create test user: HTTP ${res.status} - ${JSON.stringify(res.data || res.rawText)}`
    );
  }

  const token = res.data?.token;
  const user = res.data?.user || res.data;

  return {
    user,
    token,
    credentials: payload,
    authenticatedClient: client.withToken(token)
  };
}

/**
 * Log in an existing user via POST /api/auth/login and return token and authenticated client.
 * @param {import('./httpClient').HttpClient} client
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{
 *   user: object,
 *   token: string,
 *   authenticatedClient: import('./httpClient').HttpClient
 * }>}
 */
async function loginUser(client, email, password) {
  const res = await client.post('/api/auth/login', { email, password });
  if (res.status !== 200) {
    throw new Error(
      `Login failed: HTTP ${res.status} - ${JSON.stringify(res.data || res.rawText)}`
    );
  }

  const token = res.data?.token;
  const user = res.data?.user || res.data;

  return {
    user,
    token,
    authenticatedClient: client.withToken(token)
  };
}

module.exports = {
  generateUniqueEmail,
  createValidToken,
  createForgedToken,
  createExpiredToken,
  createTestUser,
  loginUser
};
