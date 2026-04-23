/**
 * Chaos Test — Resource Exhaustion (Concurrent Request Flood)
 * Module: Global Feed / User Authentication / Article Management
 *
 * Sends bursts of concurrent requests to simulate resource exhaustion:
 *   - Connection pool saturation
 *   - Event-loop queue backpressure
 *   - Memory pressure from simultaneous response buffering
 *
 * Fault type : concurrent request flood (resource exhaustion)
 * Duration   : ~60s for full suite
 * Expected   : error rate < 5% under 50 VUs; response times degrade
 *              gracefully; server does NOT crash (process stays alive)
 *
 * Metrics collected:
 *   - Success rate per concurrency level
 *   - p50 / p95 / p99 response times
 *   - Error types (ECONNRESET, ETIMEDOUT, 5xx)
 *   - Throughput (req/s)
 *
 * Run (server must be UP):
 *   node tests/chaos/resource-exhaustion.mjs
 */

import http from 'node:http';

const BASE_URL  = process.env.BASE_URL || 'http://localhost:3001';
const targetUrl = new URL(BASE_URL);

// ── HTTP request (no timeout by default — we want to see natural back-pressure)
function request(method, path, body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: targetUrl.hostname,
      port:     targetUrl.port || 80,
      path,
      method,
      headers:  { 'Content-Type': 'application/json' },
      timeout:  15_000,
    };

    const start = Date.now();
    const req   = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        status:   res.statusCode,
        duration: Date.now() - start,
        error:    null,
        is5xx:    res.statusCode >= 500,
      }));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: null, duration: Date.now() - start, error: 'TIMEOUT', is5xx: false });
    });

    req.on('error', (err) => {
      resolve({ status: null, duration: Date.now() - start, error: err.code || err.message, is5xx: false });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Send N concurrent requests and collect results ────────────────────────────
async function flood(concurrency, requestFn) {
  const promises = Array.from({ length: concurrency }, requestFn);
  const start    = Date.now();
  const results  = await Promise.allSettled(promises);
  const wallTime = Date.now() - start;

  const responses = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { status: null, duration: 0, error: r.reason?.message, is5xx: false }
  );

  const durations = responses.map(r => r.duration).sort((a, b) => a - b);
  const errors    = responses.filter(r => r.error !== null || r.is5xx);
  const successes = responses.filter(r => r.status >= 200 && r.status < 400);

  return {
    concurrency,
    total:       responses.length,
    success:     successes.length,
    errors:      errors.length,
    errorRate:   (errors.length / responses.length * 100).toFixed(1),
    p50:         durations[Math.floor(durations.length * 0.50)] || 0,
    p95:         durations[Math.floor(durations.length * 0.95)] || 0,
    p99:         durations[Math.floor(durations.length * 0.99)] || 0,
    wallTimeMs:  wallTime,
    rps:         Math.round(responses.length / (wallTime / 1000)),
    errorTypes:  [...new Set(errors.map(e => e.error || `HTTP ${e.status}`))],
  };
}

// ── Concurrency levels to test ────────────────────────────────────────────────
const LEVELS = [1, 5, 10, 25, 50, 100];

// ── Endpoint request factories ────────────────────────────────────────────────
const ENDPOINTS = [
  {
    name: 'GET /api/articles (feed)',
    fn:   () => () => request('GET', '/api/articles?limit=10'),
  },
  {
    name: 'POST /api/users/login (auth)',
    fn:   () => () => request('POST', '/api/users/login', {
      user: { email: 'qa_test@example.com', password: 'password123' },
    }),
  },
  {
    name: 'GET /api/tags (tags)',
    fn:   () => () => request('GET', '/api/tags'),
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function runResourceExhaustionTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CHAOS TEST — Resource Exhaustion (Concurrent Request Flood)');
  console.log(`  Target  : ${BASE_URL}`);
  console.log(`  Levels  : ${LEVELS.join(', ')} concurrent requests per endpoint`);
  console.log('═══════════════════════════════════════════════════════════════');

  const allResults = [];

  for (const endpoint of ENDPOINTS) {
    console.log('');
    console.log(`  Endpoint: ${endpoint.name}`);
    console.log(`  ${'VUs'.padEnd(6)} ${'OK'.padEnd(6)} ${'Err'.padEnd(6)} ${'ErrRate'.padEnd(9)} ${'p50'.padEnd(8)} ${'p95'.padEnd(8)} ${'p99'.padEnd(8)} ${'RPS'}`);
    console.log(`  ${'─'.repeat(6)} ${'─'.repeat(6)} ${'─'.repeat(6)} ${'─'.repeat(9)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(6)}`);

    for (const level of LEVELS) {
      let result;
      try {
        result = await flood(level, endpoint.fn());
      } catch (err) {
        console.log(`  ${String(level).padEnd(6)} SKIP (${err.message})`);
        continue;
      }

      const errFlag = parseFloat(result.errorRate) > 5 ? ' !' : '';
      console.log(
        `  ${String(level).padEnd(6)} ${String(result.success).padEnd(6)} ${String(result.errors).padEnd(6)} ${(result.errorRate + '%').padEnd(9)} ${String(result.p50 + 'ms').padEnd(8)} ${String(result.p95 + 'ms').padEnd(8)} ${String(result.p99 + 'ms').padEnd(8)} ${result.rps}${errFlag}`
      );

      if (result.errorTypes.length > 0) {
        console.log(`    Error types: ${result.errorTypes.join(', ')}`);
      }

      allResults.push({ endpoint: endpoint.name, ...result });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  ANALYSIS');
  console.log('───────────────────────────────────────────────────────────────');

  if (allResults.length > 0) {
    const highLoad    = allResults.filter(r => r.concurrency >= 50);
    const avgErrHigh  = highLoad.length
      ? (highLoad.reduce((s, r) => s + parseFloat(r.errorRate), 0) / highLoad.length).toFixed(1)
      : 'N/A';
    const maxP95      = Math.max(...allResults.map(r => r.p95));
    const minP95      = Math.min(...allResults.filter(r => r.concurrency === 1).map(r => r.p95));
    const degradation = minP95 > 0 ? ((maxP95 - minP95) / minP95 * 100).toFixed(0) : 'N/A';

    console.log(`  Avg error rate @ 50+ VUs  : ${avgErrHigh}%  (threshold: 5%)`);
    console.log(`  Baseline p95 (1 VU)       : ${minP95}ms`);
    console.log(`  Max p95 (peak concurrency): ${maxP95}ms`);
    console.log(`  Latency degradation       : ${degradation}%`);
  }

  console.log('');
  console.log('  Recommendations:');
  console.log('  1. Configure connection pool limits in Sequelize config.js');
  console.log('  2. Add rate-limiting middleware (express-rate-limit) to /api/users/login');
  console.log('  3. Cache GET /api/tags and GET /api/articles (Redis or in-process LRU)');
  console.log('  4. Add circuit-breaker pattern for database-bound routes');
  console.log('───────────────────────────────────────────────────────────────');

  return allResults;
}

await runResourceExhaustionTests();
