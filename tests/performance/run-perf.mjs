/**
 * Newman Performance Runner — Conduit API
 * Covers: Authentication (HIGH), Article Management (HIGH), Global Feed (HIGH)
 *
 * Scenarios:
 *   normal    — 1 virtual user, 30 iterations (baseline RPS/latency)
 *   peak      — 5 parallel users, 20 iterations each (100 total requests/flow)
 *   spike     — 15 parallel users, 5 iterations each (instant burst)
 *   endurance — 1 virtual user, 100 iterations (drift / memory check)
 *
 * Usage:
 *   node tests/performance/run-perf.mjs                  # all scenarios
 *   node tests/performance/run-perf.mjs --scenario normal
 *   node tests/performance/run-perf.mjs --scenario spike
 *   node tests/performance/run-perf.mjs --base-url http://localhost:3001
 */

import newman   from 'newman';
import { join, dirname } from 'node:path';
import { fileURLToPath }  from 'node:url';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const COLLECTION   = join(__dirname, 'postman/performance.postman_collection.json');
const RESULTS_DIR  = join(__dirname, '../../reports/performance');
const BASE_URL_ARG = process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1];
const BASE_URL     = BASE_URL_ARG || process.env.BASE_URL || 'http://localhost:3001';
const SCENARIO_ARG = process.argv.find(a => a.startsWith('--scenario='))?.split('=')[1]
                  || (process.argv.includes('--scenario') && process.argv[process.argv.indexOf('--scenario') + 1])
                  || 'all';

if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

// ── Scenario definitions ──────────────────────────────────────────────────────
const SCENARIOS = {
  normal: {
    label:       'Normal Load',
    description: '1 virtual user × 30 iterations — steady-state baseline',
    vus:         1,
    iterations:  30,
    delayMs:     200,
    thresholdP95: 500,
  },
  peak: {
    label:       'Peak Load',
    description: '5 parallel users × 20 iterations — expected traffic burst',
    vus:         5,
    iterations:  20,
    delayMs:     100,
    thresholdP95: 800,
  },
  spike: {
    label:       'Spike Load',
    description: '15 parallel users × 5 iterations — sudden traffic surge',
    vus:         15,
    iterations:  5,
    delayMs:     0,
    thresholdP95: 1500,
  },
  endurance: {
    label:       'Endurance',
    description: '1 virtual user × 100 iterations — memory / drift check',
    vus:         1,
    iterations:  100,
    delayMs:     100,
    thresholdP95: 600,
  },
};

// ── Run one Newman instance (returns Promise with summary) ────────────────────
function runNewman(iterationCount, delayMs, vuIndex) {
  return new Promise((resolve, reject) => {
    newman.run({
      collection:     COLLECTION,
      iterationCount,
      delayRequest:   delayMs,
      envVar: [
        { key: 'baseUrl', value: `${BASE_URL}/api` },
      ],
      reporters:  ['json'],
      reporter: {
        json: { export: join(RESULTS_DIR, `.tmp-vu${vuIndex}-${Date.now()}.json`) },
      },
      // suppress CLI output for parallel runs
      reporter: { json: { export: join(RESULTS_DIR, `.tmp-vu${vuIndex}-${Date.now()}.json`) } },
    }, (err, summary) => {
      if (err) return reject(err);
      resolve(summary);
    });
  });
}

// ── Extract per-request metrics from Newman summary ───────────────────────────
function extractMetrics(summaries) {
  // Collect all response times per request name
  const byName = {};

  for (const summary of summaries) {
    for (const execution of summary.run.executions) {
      const name     = execution.item.name;
      const respTime = execution.response?.responseTime ?? null;
      const status   = execution.response?.code ?? null;
      const failed   = (execution.assertions || []).some(a => a.error);

      if (!byName[name]) byName[name] = { times: [], errors: 0, total: 0 };
      byName[name].total++;
      if (respTime !== null) byName[name].times.push(respTime);
      if (failed || (status && status >= 500)) byName[name].errors++;
    }
  }

  // Calculate percentiles
  const results = [];
  for (const [name, data] of Object.entries(byName)) {
    const sorted  = [...data.times].sort((a, b) => a - b);
    const len     = sorted.length;
    const avg     = len ? Math.round(sorted.reduce((s, t) => s + t, 0) / len) : 0;
    const p50     = sorted[Math.floor(len * 0.50)] ?? 0;
    const p95     = sorted[Math.floor(len * 0.95)] ?? 0;
    const p99     = sorted[Math.floor(len * 0.99)] ?? 0;
    const errRate = data.total ? ((data.errors / data.total) * 100).toFixed(1) : '0.0';

    results.push({ name, total: data.total, avg, p50, p95, p99, errRate });
  }

  // Overall metrics
  const allTimes   = summaries.flatMap(s =>
    s.run.executions.map(e => e.response?.responseTime).filter(Boolean)
  );
  const allErrors  = summaries.flatMap(s =>
    s.run.executions.flatMap(e =>
      (e.assertions || []).filter(a => a.error)
    )
  ).length;
  const allTotal   = summaries.reduce((s, r) => s + r.run.executions.length, 0);
  const sortedAll  = [...allTimes].sort((a, b) => a - b);
  const overall    = {
    total:    allTotal,
    avg:      sortedAll.length ? Math.round(sortedAll.reduce((s, t) => s + t, 0) / sortedAll.length) : 0,
    p50:      sortedAll[Math.floor(sortedAll.length * 0.50)] ?? 0,
    p95:      sortedAll[Math.floor(sortedAll.length * 0.95)] ?? 0,
    p99:      sortedAll[Math.floor(sortedAll.length * 0.99)] ?? 0,
    errRate:  allTotal ? ((allErrors / allTotal) * 100).toFixed(1) : '0.0',
    failures: summaries.reduce((s, r) => s + r.run.failures.length, 0),
  };

  return { byRequest: results, overall };
}

// ── Run one scenario (potentially multiple parallel VUs) ──────────────────────
async function runScenario(key, cfg) {
  const label = `${cfg.label} (${cfg.vus} VU × ${cfg.iterations} iter)`;
  console.log('');
  console.log(`┌─ ${label}`);
  console.log(`│  ${cfg.description}`);
  console.log(`│  Delay: ${cfg.delayMs}ms   Base URL: ${BASE_URL}`);
  console.log('│');

  const start    = Date.now();
  const vuRuns   = Array.from({ length: cfg.vus }, (_, i) =>
    runNewman(cfg.iterations, cfg.delayMs, i)
  );

  let summaries;
  try {
    summaries = await Promise.all(vuRuns);
  } catch (err) {
    console.log(`│  ERROR: ${err.message}`);
    console.log('└─ FAILED');
    return null;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const metrics = extractMetrics(summaries);
  const { overall } = metrics;

  // ── Per-request table ───────────────────────────────────────────────────
  console.log(`│  ${'Request'.padEnd(38)} ${'n'.padEnd(5)} ${'avg'.padEnd(7)} ${'p50'.padEnd(7)} ${'p95'.padEnd(7)} ${'p99'.padEnd(7)} ${'err%'}`);
  console.log(`│  ${'─'.repeat(38)} ${'─'.repeat(5)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(5)}`);

  for (const r of metrics.byRequest) {
    const p95flag = r.p95 > cfg.thresholdP95 ? ' !' : '  ';
    console.log(
      `│  ${r.name.slice(0,38).padEnd(38)} ${String(r.total).padEnd(5)} ` +
      `${String(r.avg+'ms').padEnd(7)} ${String(r.p50+'ms').padEnd(7)} ` +
      `${String(r.p95+'ms').padEnd(7)} ${String(r.p99+'ms').padEnd(7)} ` +
      `${r.errRate}%${p95flag}`
    );
  }

  console.log('│');
  const p95ok  = overall.p95 <= cfg.thresholdP95;
  const errOk  = parseFloat(overall.errRate) < 1;
  const verdict = (p95ok && errOk) ? 'PASS ✓' : 'FAIL ✗';
  console.log(`│  Overall: avg=${overall.avg}ms  p50=${overall.p50}ms  p95=${overall.p95}ms  p99=${overall.p99}ms`);
  console.log(`│  Total requests: ${overall.total}  Errors: ${overall.failures}  Error rate: ${overall.errRate}%`);
  console.log(`│  Wall time: ${elapsed}s   p95 threshold: ${cfg.thresholdP95}ms → ${verdict}`);
  console.log('└─ DONE');

  // ── Save per-scenario JSON ──────────────────────────────────────────────
  const report = {
    scenario:    key,
    label:       cfg.label,
    description: cfg.description,
    vus:         cfg.vus,
    iterations:  cfg.iterations,
    delayMs:     cfg.delayMs,
    baseUrl:     BASE_URL,
    timestamp:   new Date().toISOString(),
    wallTimeSec: parseFloat(elapsed),
    thresholdP95: cfg.thresholdP95,
    passed:      p95ok && errOk,
    overall,
    byRequest:   metrics.byRequest,
  };

  const outFile = join(RESULTS_DIR, `perf-${key}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  return report;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const toRun = SCENARIO_ARG === 'all'
  ? Object.keys(SCENARIOS)
  : SCENARIO_ARG.split(',').filter(k => SCENARIOS[k]);

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   Newman Performance Tests — Conduit API (Assignment 3)     ║');
console.log(`║   Scenarios: ${toRun.join(', ').padEnd(46)}║`);
console.log(`║   Base URL : ${BASE_URL.padEnd(46)}║`);
console.log('╚══════════════════════════════════════════════════════════════╝');

const allReports = [];
for (const key of toRun) {
  const report = await runScenario(key, SCENARIOS[key]);
  if (report) allReports.push(report);
}

// ── Summary table across all scenarios ───────────────────────────────────────
if (allReports.length > 1) {
  console.log('');
  console.log('┌── SUMMARY ACROSS ALL SCENARIOS ──────────────────────────────┐');
  console.log(`│  ${'Scenario'.padEnd(12)} ${'VUs'.padEnd(5)} ${'Total req'.padEnd(10)} ${'avg'.padEnd(8)} ${'p95'.padEnd(8)} ${'p95 thr'.padEnd(9)} ${'Err%'.padEnd(7)} ${'Result'}`);
  console.log(`│  ${'─'.repeat(12)} ${'─'.repeat(5)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(9)} ${'─'.repeat(7)} ${'─'.repeat(7)}`);

  for (const r of allReports) {
    const icon = r.passed ? '✓' : '✗';
    console.log(
      `│  ${r.scenario.padEnd(12)} ${String(r.vus).padEnd(5)} ${String(r.overall.total).padEnd(10)} ` +
      `${String(r.overall.avg+'ms').padEnd(8)} ${String(r.overall.p95+'ms').padEnd(8)} ` +
      `${String(r.thresholdP95+'ms').padEnd(9)} ${(r.overall.errRate+'%').padEnd(7)} ${icon}`
    );
  }
  console.log('└──────────────────────────────────────────────────────────────┘');
}

// ── Save combined report ──────────────────────────────────────────────────────
const combined = {
  timestamp:  new Date().toISOString(),
  baseUrl:    BASE_URL,
  scenarios:  allReports,
  passed:     allReports.filter(r => r.passed).length,
  failed:     allReports.filter(r => !r.passed).length,
};
writeFileSync(join(RESULTS_DIR, 'perf-summary.json'), JSON.stringify(combined, null, 2));
console.log('');
console.log(`  Reports saved to: reports/performance/`);

const exitCode = allReports.some(r => !r.passed) ? 1 : 0;
process.exit(exitCode);
