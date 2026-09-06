#!/usr/bin/env node
/**
 * tests/e2e/run_all.js
 * Master MindMesh E2E test runner.
 *
 * Supports:
 *   --tier=1,2,3,4 (or --tier=1, --tier=all)
 *   --filter=<pattern>
 *   --verbose
 *   --bail
 *   --server-url=<url>
 *   --mock-server
 *   --no-server
 *   --self-test
 *   --help
 */

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const harness = require('./harness');

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tiers: ['1', '2', '3', '4'],
    filter: null,
    verbose: false,
    bail: false,
    serverUrl: process.env.TEST_API_URL || null,
    mockServer: false,
    noServer: false,
    selfTest: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--tier=')) {
      const tierVal = arg.substring(7).trim();
      if (tierVal === 'all') {
        options.tiers = ['1', '2', '3', '4'];
      } else {
        options.tiers = tierVal.split(',').map((t) => t.trim().replace(/^tier/i, ''));
      }
    } else if (arg.startsWith('--filter=')) {
      options.filter = new RegExp(arg.substring(9).trim(), 'i');
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--bail' || arg === '-b') {
      options.bail = true;
    } else if (arg.startsWith('--server-url=')) {
      options.serverUrl = arg.substring(13).trim();
    } else if (arg === '--mock-server') {
      options.mockServer = true;
    } else if (arg === '--no-server') {
      options.noServer = true;
    } else if (arg === '--self-test') {
      options.selfTest = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
MindMesh E2E Master Test Runner

Usage:
  node tests/e2e/run_all.js [options]

Options:
  --tier=<1,2,3,4|all>   Run specific tier(s) (default: all)
  --filter=<pattern>     Regex pattern to filter test files and test names
  --verbose, -v          Show detailed per-test logs and execution timings
  --bail, -b             Abort test execution immediately on first failure
  --server-url=<url>     Target pre-existing server (default: http://localhost:5000)
  --mock-server          Force use of in-process mock server adapter
  --no-server            Skip server startup (run static/contract checks only)
  --self-test            Run harness self-test suite (harness.test.js)
  --help, -h             Display this help message

Exit codes:
  0: All tests passed
  1: One or more tests failed or test runner encountered fatal error
`);
}

// Locate test files based on tier configuration and filters
function discoverTestFiles(options, baseDir) {
  const filesToRun = [];

  // Check for self-test request
  if (options.selfTest) {
    const harnessTest = path.join(baseDir, 'harness', 'harness.test.js');
    if (fs.existsSync(harnessTest)) {
      filesToRun.push({
        tier: 'harness',
        tierName: 'Harness Self-Test',
        filePath: harnessTest,
        relativePath: path.relative(baseDir, harnessTest)
      });
    }
    return filesToRun;
  }

  const tierMetadata = {
    '1': { dir: 'tier1', name: 'Tier 1: Feature Coverage' },
    '2': { dir: 'tier2', name: 'Tier 2: Boundary & Corner Cases' },
    '3': { dir: 'tier3', name: 'Tier 3: Cross-Feature Pairwise' },
    '4': { dir: 'tier4', name: 'Tier 4: Real-World Scenarios' }
  };

  for (const tierKey of options.tiers) {
    const meta = tierMetadata[tierKey];
    if (!meta) continue;

    const tierDir = path.join(baseDir, meta.dir);
    if (!fs.existsSync(tierDir)) continue;

    const entries = fs.readdirSync(tierDir).sort();
    for (const entry of entries) {
      if (entry.endsWith('.test.js')) {
        const fullPath = path.join(tierDir, entry);
        const relPath = path.relative(baseDir, fullPath);

        if (!options.filter || options.filter.test(entry) || options.filter.test(relPath)) {
          filesToRun.push({
            tier: `tier${tierKey}`,
            tierName: meta.name,
            filePath: fullPath,
            relativePath: relPath
          });
        }
      }
    }
  }

  // If no tier tests were found but filter is not active, fallback to include harness test if it exists
  if (filesToRun.length === 0 && !options.filter) {
    const harnessTest = path.join(baseDir, 'harness', 'harness.test.js');
    if (fs.existsSync(harnessTest)) {
      filesToRun.push({
        tier: 'harness',
        tierName: 'Harness Self-Test',
        filePath: harnessTest,
        relativePath: path.relative(baseDir, harnessTest)
      });
    }
  }

  return filesToRun;
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const baseDir = path.resolve(__dirname);
  const reportsDir = path.join(baseDir, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║               MindMesh E2E Master Test Runner                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`Node Runtime : ${process.version}`);
  console.log(`Tiers Target : ${options.tiers.join(', ')}`);
  if (options.filter) console.log(`Filter Pattern: ${options.filter}`);
  if (options.bail) console.log(`Bail Mode    : ON (stops on first failure)`);
  if (options.verbose) console.log(`Verbose Mode : ON`);

  let serverInfo = null;

  // 1. Server initialization
  if (!options.noServer) {
    try {
      serverInfo = await harness.startServer({
        url: options.serverUrl,
        mockServer: options.mockServer
      });
      process.env.TEST_API_URL = serverInfo.url;
      console.log(`Target Server: ${serverInfo.url} (managed: ${serverInfo.managed})`);
    } catch (err) {
      console.error(`\n✖ Fatal: Unable to initialize test server: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log('Target Server: NONE (--no-server active)');
  }

  console.log('─'.repeat(68));

  // 2. Discover test files
  const testFiles = discoverTestFiles(options, baseDir);
  console.log(`Discovered ${testFiles.length} test file(s) for execution.\n`);

  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    success: true
  };

  const tierStats = {
    harness: { name: 'Harness Self-Test', total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
    tier1: { name: 'Tier 1: Feature Coverage', total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
    tier2: { name: 'Tier 2: Boundary & Corner Cases', total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
    tier3: { name: 'Tier 3: Cross-Feature Pairwise', total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
    tier4: { name: 'Tier 4: Real-World Scenarios', total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 }
  };

  const failures = [];
  const runnerStart = performance.now();

  try {
    for (const fileInfo of testFiles) {
      const { tier, filePath, relativePath } = fileInfo;

      if (options.verbose) {
        console.log(`\n▶ Running: ${relativePath}`);
      }

      harness.clearRegistry();

      // Load test file into registry
      try {
        delete require.cache[require.resolve(filePath)];
        require(filePath);
      } catch (err) {
        console.error(`\n✖ Failed to load test file ${relativePath}: ${err.message}`);
        failures.push({
          file: relativePath,
          test: 'File Import',
          error: err.message,
          stack: err.stack
        });
        summary.failed++;
        summary.total++;
        if (options.bail) break;
        continue;
      }

      // Execute suites in file
      const fileRes = await harness.runAllSuites({ bail: options.bail });

      const currentTier = tierStats[tier] || tierStats.harness;
      currentTier.total += fileRes.total;
      currentTier.passed += fileRes.passed;
      currentTier.failed += fileRes.failed;
      currentTier.skipped += fileRes.skipped;
      currentTier.durationMs += fileRes.durationMs;

      summary.total += fileRes.total;
      summary.passed += fileRes.passed;
      summary.failed += fileRes.failed;
      summary.skipped += fileRes.skipped;

      // Print per-test feedback
      for (const suite of fileRes.suites) {
        for (const t of suite.tests) {
          if (t.status === 'passed') {
            if (options.verbose) {
              console.log(`  ✔ [PASS] ${suite.name} > ${t.name} (${t.durationMs}ms)`);
            }
          } else if (t.status === 'skipped') {
            if (options.verbose) {
              console.log(`  ⊘ [SKIP] ${suite.name} > ${t.name}`);
            }
          } else if (t.status === 'failed') {
            console.log(`  ✖ [FAIL] ${suite.name} > ${t.name} (${t.durationMs}ms)`);
            console.log(`     Error: ${t.error?.message || t.error}`);
            failures.push({
              file: relativePath,
              suite: suite.name,
              test: t.name,
              error: t.error?.message || String(t.error),
              stack: t.error?.stack || null
            });
          }
        }
      }

      if (!options.verbose) {
        const icon = fileRes.failed === 0 ? '✔' : '✖';
        console.log(`${icon} ${relativePath} (${fileRes.passed}/${fileRes.total} passed, ${fileRes.durationMs}ms)`);
      }

      if (options.bail && fileRes.failed > 0) {
        console.log('\n[!] Bail triggered: Stopping further test execution.');
        break;
      }
    }
  } finally {
    if (serverInfo && typeof serverInfo.stop === 'function') {
      await serverInfo.stop();
    }
  }

  summary.durationMs = Math.round(performance.now() - runnerStart);
  summary.success = summary.failed === 0;

  // 3. Print Final Report
  console.log('\n' + '═'.repeat(68));
  console.log('                   EXECUTION SUMMARY REPORT');
  console.log('═'.repeat(68));

  for (const [key, t] of Object.entries(tierStats)) {
    if (t.total > 0 || options.tiers.includes(key.replace(/^tier/, ''))) {
      const statusStr = t.failed === 0 ? 'PASS' : 'FAIL';
      console.log(
        `• ${t.name.padEnd(35)} : ${t.passed}/${t.total} passed [${statusStr}] (${t.durationMs}ms)`
      );
    }
  }

  console.log('─'.repeat(68));
  console.log(
    `TOTAL: ${summary.total} tests | ` +
    `PASSED: ${summary.passed} | ` +
    `FAILED: ${summary.failed} | ` +
    `SKIPPED: ${summary.skipped} | ` +
    `TIME: ${summary.durationMs}ms`
  );
  console.log('═'.repeat(68));

  if (failures.length > 0) {
    console.log(`\n✖ FAILURES (${failures.length}):`);
    failures.forEach((f, idx) => {
      console.log(`\n${idx + 1}) ${f.file} > ${f.suite || ''} > ${f.test}`);
      console.log(`   ${f.error}`);
      if (options.verbose && f.stack) {
        console.log(`   Stack:\n${f.stack.split('\n').slice(1, 5).map(l => '     ' + l).join('\n')}`);
      }
    });
  }

  // 4. Save JSON Report
  const jsonReportPath = path.join(reportsDir, 'summary.json');
  const reportPayload = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'test',
    summary,
    tiers: tierStats,
    failures
  };

  fs.writeFileSync(jsonReportPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
  console.log(`\nReport artifact saved to: ${jsonReportPath}\n`);

  if (summary.failed > 0) {
    console.log('RESULT: ✖ FAILED');
    process.exit(1);
  } else {
    console.log('RESULT: ✔ ALL TESTS PASSED');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\nUnhandled error in test runner:', err);
  process.exit(1);
});
