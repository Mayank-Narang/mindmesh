/**
 * tests/e2e/harness/index.js
 * Central hub for MindMesh E2E test harness.
 * Re-exports runner, HTTP client, SSE reader, server lifecycle launcher,
 * auth helper, and domain assertions for one-line test imports.
 */

const runner = require('./runner');
const { HttpClient } = require('./httpClient');
const sse = require('./sseReader');
const server = require('./serverLauncher');
const auth = require('./authHelper');
const assertions = require('./assertions');

module.exports = {
  ...runner,
  HttpClient,
  ...sse,
  ...server,
  ...auth,
  ...assertions
};
