/**
 * tests/e2e/harness/runner.js
 * Lightweight, zero-dependency test runner supporting describe, test/it, hooks,
 * timeouts, assertion error trapping, tier tagging, and structured summary stats.
 * Supports hierarchical suite nesting with proper parent-child hook inheritance.
 */

const { performance } = require('node:perf_hooks');

class TestContext {
  constructor(name, fn, options = {}) {
    this.name = name;
    this.fn = fn;
    this.timeout = options.timeout || 10000;
    this.skip = Boolean(options.skip);
    this.tier = options.tier || null;
    this.durationMs = 0;
    this.error = null;
    this.status = 'pending'; // 'passed' | 'failed' | 'skipped'
  }
}

class SuiteContext {
  constructor(name, parent = null, options = {}) {
    this.name = name;
    this.parent = parent;
    this.tier = options.tier || (parent ? parent.tier : null);
    this.childSuites = [];
    this.tests = [];
    this.beforeHooks = [];
    this.afterHooks = [];
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
    this.sharedState = parent ? Object.create(parent.sharedState) : {};
  }

  // Collect all beforeEach hooks from root down to this suite
  getAllBeforeEachHooks() {
    const hooks = this.parent ? this.parent.getAllBeforeEachHooks() : [];
    return hooks.concat(this.beforeEachHooks);
  }

  // Collect all afterEach hooks from this suite up to root
  getAllAfterEachHooks() {
    const hooks = [...this.afterEachHooks];
    if (this.parent) {
      hooks.push(...this.parent.getAllAfterEachHooks());
    }
    return hooks;
  }
}

class TestRegistry {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
  }

  describe(name, fn, options = {}) {
    const suite = new SuiteContext(name, this.currentSuite, options);
    if (this.currentSuite) {
      this.currentSuite.childSuites.push(suite);
    } else {
      this.suites.push(suite);
    }
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    try {
      fn(suite);
    } finally {
      this.currentSuite = prevSuite;
    }
    return suite;
  }

  test(name, fn, options = {}) {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => this.test(name, fn, options));
      return;
    }
    const tier = options.tier || (this.currentSuite ? this.currentSuite.tier : null);
    const testCtx = new TestContext(name, fn, { ...options, tier });
    this.currentSuite.tests.push(testCtx);
    return testCtx;
  }

  before(fn) {
    if (this.currentSuite) this.currentSuite.beforeHooks.push(fn);
  }

  after(fn) {
    if (this.currentSuite) this.currentSuite.afterHooks.push(fn);
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEachHooks.push(fn);
  }

  clear() {
    this.suites = [];
    this.currentSuite = null;
  }
}

const registry = new TestRegistry();

/**
 * Execute a suite and its children recursively with before/after/beforeEach/afterEach hooks.
 */
async function runSuite(suite, options = {}) {
  const results = {
    name: suite.name,
    tier: suite.tier,
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    tests: [],
    childSuites: []
  };

  const suiteStart = performance.now();

  try {
    // 1. Run suite before hooks
    for (const hook of suite.beforeHooks) {
      await hook(suite.sharedState);
    }

    const allBeforeEach = suite.getAllBeforeEachHooks();
    const allAfterEach = suite.getAllAfterEachHooks();

    // 2. Run direct tests in this suite
    for (const testCtx of suite.tests) {
      results.total++;
      if (testCtx.skip) {
        testCtx.status = 'skipped';
        results.skipped++;
        results.tests.push({
          name: testCtx.name,
          status: 'skipped',
          durationMs: 0,
          tier: testCtx.tier,
          error: null
        });
        continue;
      }

      // Run beforeEach hooks (ancestors first)
      for (const hook of allBeforeEach) {
        await hook(suite.sharedState);
      }

      const testStart = performance.now();
      let timerId;
      try {
        await Promise.race([
          testCtx.fn(suite.sharedState),
          new Promise((_, reject) => {
            timerId = setTimeout(
              () => reject(new Error(`Test timed out after ${testCtx.timeout}ms`)),
              testCtx.timeout
            );
          })
        ]);
        testCtx.status = 'passed';
        results.passed++;
      } catch (err) {
        testCtx.status = 'failed';
        testCtx.error = err;
        results.failed++;
        if (options.bail) {
          throw err;
        }
      } finally {
        if (timerId) clearTimeout(timerId);
        testCtx.durationMs = Math.round(performance.now() - testStart);
        results.tests.push({
          name: testCtx.name,
          status: testCtx.status,
          durationMs: testCtx.durationMs,
          tier: testCtx.tier,
          error: testCtx.error
        });

        // Run afterEach hooks
        for (const hook of allAfterEach) {
          try {
            await hook(suite.sharedState);
          } catch (e) {
            console.error('Error in afterEach hook:', e);
          }
        }
      }
    }

    // 3. Run child suites recursively
    for (const childSuite of suite.childSuites) {
      const childRes = await runSuite(childSuite, options);
      results.childSuites.push(childRes);
      results.total += childRes.total;
      results.passed += childRes.passed;
      results.failed += childRes.failed;
      results.skipped += childRes.skipped;

      if (options.bail && childRes.failed > 0) {
        break;
      }
    }
  } catch (err) {
    if (options.bail) {
      results.durationMs = Math.round(performance.now() - suiteStart);
      throw err;
    }
  } finally {
    // 4. Run suite after hooks
    for (const hook of suite.afterHooks) {
      try {
        await hook(suite.sharedState);
      } catch (e) {
        console.error('Error in after hook:', e);
      }
    }
    results.durationMs = Math.round(performance.now() - suiteStart);
  }

  return results;
}

/**
 * Flatten nested suite result tree for structured reporting.
 */
function flattenSuiteResults(suiteResult, parentPrefix = '') {
  const prefix = parentPrefix ? `${parentPrefix} > ${suiteResult.name}` : suiteResult.name;
  let flattened = [];

  if (suiteResult.tests.length > 0) {
    flattened.push({
      name: prefix,
      tier: suiteResult.tier,
      total: suiteResult.tests.length,
      passed: suiteResult.tests.filter((t) => t.status === 'passed').length,
      failed: suiteResult.tests.filter((t) => t.status === 'failed').length,
      skipped: suiteResult.tests.filter((t) => t.status === 'skipped').length,
      durationMs: suiteResult.durationMs,
      tests: suiteResult.tests
    });
  }

  for (const child of suiteResult.childSuites) {
    flattened = flattened.concat(flattenSuiteResults(child, prefix));
  }

  return flattened;
}

/**
 * Execute all currently registered top-level suites and compile aggregated summary.
 */
async function runAllSuites(options = {}) {
  const aggregated = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    suites: []
  };

  const overallStart = performance.now();

  for (const suite of registry.suites) {
    const suiteRes = await runSuite(suite, options);
    aggregated.total += suiteRes.total;
    aggregated.passed += suiteRes.passed;
    aggregated.failed += suiteRes.failed;
    aggregated.skipped += suiteRes.skipped;
    aggregated.suites.push(...flattenSuiteResults(suiteRes));

    if (options.bail && suiteRes.failed > 0) {
      break;
    }
  }

  aggregated.durationMs = Math.round(performance.now() - overallStart);
  return aggregated;
}

module.exports = {
  registry,
  TestRegistry,
  SuiteContext,
  TestContext,
  describe: (name, fn, opts) => registry.describe(name, fn, opts),
  test: (name, fn, opts) => registry.test(name, fn, opts),
  it: (name, fn, opts) => registry.test(name, fn, opts),
  before: (fn) => registry.before(fn),
  after: (fn) => registry.after(fn),
  beforeEach: (fn) => registry.beforeEach(fn),
  afterEach: (fn) => registry.afterEach(fn),
  clearRegistry: () => registry.clear(),
  runSuite,
  runAllSuites,
  flattenSuiteResults
};
