/**
 * Chaos Test Suite Runner
 * Executes all chaos/fault injection tests in sequence and aggregates results.
 *
 * Run:
 *   node tests/chaos/run-all.mjs
 *   node tests/chaos/run-all.mjs --skip-network  (skip latency proxy test)
 *   node tests/chaos/run-all.mjs --skip-exhaustion
 */

import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '../../reports/chaos');
const ARGS        = process.argv.slice(2);

if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

const SUITES = [
  {
    name:   'API Downtime',
    file:   'api-downtime.mjs',
    skip:   false,
    fault:  'Connection refused (server down)',
  },
  {
    name:   'Database Failure',
    file:   'db-failure.mjs',
    skip:   false,
    fault:  '500/503 DB connection error',
  },
  {
    name:   'Network Latency',
    file:   'network-latency.mjs',
    skip:   ARGS.includes('--skip-network'),
    fault:  'Artificial 0–3000ms request delay',
  },
  {
    name:   'Resource Exhaustion',
    file:   'resource-exhaustion.mjs',
    skip:   ARGS.includes('--skip-exhaustion'),
    fault:  'Concurrent flood (1–100 VUs)',
  },
];

const summary = [];

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║         CHAOS / FAULT INJECTION TEST SUITE RUNNER            ║');
console.log('║         Conduit RealWorld App — Assignment 3                 ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

for (const suite of SUITES) {
  if (suite.skip) {
    console.log(`  ── ${suite.name} — SKIPPED`);
    summary.push({ name: suite.name, status: 'SKIPPED', fault: suite.fault, exitCode: null });
    continue;
  }

  console.log(`╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌`);
  console.log(`  Suite : ${suite.name}`);
  console.log(`  Fault : ${suite.fault}`);
  console.log(`  File  : tests/chaos/${suite.file}`);
  console.log('');

  const start = Date.now();
  let exitCode = 0;

  try {
    execFileSync(
      process.execPath,
      [join(__dirname, suite.file)],
      { stdio: 'inherit', timeout: 120_000 },
    );
  } catch (err) {
    exitCode = err.status ?? 1;
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  const status   = exitCode === 0 ? 'PASSED' : 'FAILED';
  console.log('');
  console.log(`  → ${suite.name}: ${status}  (${duration}s, exit code: ${exitCode})`);

  summary.push({ name: suite.name, status, fault: suite.fault, exitCode, durationSec: parseFloat(duration) });
}

// ── Final summary ─────────────────────────────────────────────────────────────
console.log('');
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  CHAOS TEST RESULTS SUMMARY                                  ║');
console.log('╠═══════════════════════════════════════════════════════════════╣');
for (const s of summary) {
  const icon = s.status === 'PASSED' ? '✓' : s.status === 'SKIPPED' ? '○' : '✗';
  console.log(`║  ${icon} ${s.name.padEnd(22)} ${s.fault.padEnd(38)} ║`);
}
console.log('╚═══════════════════════════════════════════════════════════════╝');

const passed  = summary.filter(s => s.status === 'PASSED').length;
const failed  = summary.filter(s => s.status === 'FAILED').length;
const skipped = summary.filter(s => s.status === 'SKIPPED').length;
console.log('');
console.log(`  Total: ${summary.length}  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`);

// ── Save report ───────────────────────────────────────────────────────────────
const report = {
  timestamp: new Date().toISOString(),
  suites:    summary,
  passed,
  failed,
  skipped,
};

writeFileSync(join(RESULTS_DIR, 'chaos-summary.json'), JSON.stringify(report, null, 2));
console.log(`  Report saved: reports/chaos/chaos-summary.json`);

process.exit(failed > 0 ? 1 : 0);
