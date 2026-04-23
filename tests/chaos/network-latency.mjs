/**
 * Chaos Test — Network Latency / Slow Response Simulation
 * Module: User Authentication / Global Feed / Article Management
 *
 * Creates a local proxy server that introduces configurable artificial delays
 * to all forwarded requests. This simulates:
 *   - Network congestion
 *   - Database slow queries
 *   - Resource contention under load
 *
 * Fault type : network latency injection (proxy with artificial delay)
 * Duration   : configurable per scenario (250ms / 1000ms / 3000ms)
 * Expected   : requests complete but with elevated response times;
 *              error rate stays low; timeout checks flag excessive latency
 *
 * Run (server must be UP on BASE_URL):
 *   node tests/chaos/network-latency.mjs
 *   node tests/chaos/network-latency.mjs --delay 2000
 */

import http from 'node:http';

const BASE_URL    = process.env.BASE_URL || 'http://localhost:3001';
const PROXY_PORT  = 13001;
const CLI_DELAY   = parseInt(process.argv.find(a => a.startsWith('--delay'))?.split('=')[1] || '') || null;

// ── Latency scenarios ─────────────────────────────────────────────────────────
const LATENCY_SCENARIOS = [
  { label: 'Normal baseline',         delayMs:    0, expectedP95: 500  },
  { label: 'Light latency (250ms)',   delayMs:  250, expectedP95: 800  },
  { label: 'Moderate latency (1s)',   delayMs: 1000, expectedP95: 1600 },
  { label: 'Severe latency (3s)',     delayMs: 3000, expectedP95: 4000 },
];

// ── Proxy server factory ──────────────────────────────────────────────────────
function createLatencyProxy(delayMs) {
  const targetUrl = new URL(BASE_URL);

  const proxy = http.createServer((req, res) => {
    setTimeout(() => {
      const options = {
        hostname: targetUrl.hostname,
        port:     targetUrl.port || 80,
        path:     req.url,
        method:   req.method,
        headers:  req.headers,
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502);
        res.end(JSON.stringify({ errors: { proxy: [`Backend unreachable: ${err.code}`] } }));
      });

      req.pipe(proxyReq);
    }, delayMs);
  });

  return proxy;
}

// ── HTTP request via proxy ────────────────────────────────────────────────────
function requestViaProxy(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port:     PROXY_PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: 10_000,
    };

    const start = Date.now();
    const req   = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        status:   res.statusCode,
        body:     data,
        duration: Date.now() - start,
        error:    null,
      }));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: null, body: null, duration: Date.now() - start, error: 'TIMEOUT' });
    });

    req.on('error', (err) => {
      resolve({ status: null, body: null, duration: Date.now() - start, error: err.code || err.message });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Test endpoints ────────────────────────────────────────────────────────────
const ENDPOINTS = [
  {
    name:    'Feed — GET /api/articles',
    run:     () => requestViaProxy('GET', '/api/articles?limit=5'),
    success: (r) => r.status === 200,
  },
  {
    name:    'Auth — POST /api/users/login',
    run:     () => requestViaProxy('POST', '/api/users/login', {
      user: { email: 'qa_test@example.com', password: 'password123' },
    }),
    success: (r) => r.status === 200,
  },
  {
    name:    'Tags — GET /api/tags',
    run:     () => requestViaProxy('GET', '/api/tags'),
    success: (r) => r.status === 200,
  },
];

// ── Run one latency scenario ──────────────────────────────────────────────────
async function runScenario(scenario) {
  const proxy  = createLatencyProxy(scenario.delayMs);
  await new Promise((r) => proxy.listen(PROXY_PORT, r));

  const timings = [];
  const errors  = [];

  for (const endpoint of ENDPOINTS) {
    // Run each endpoint 3 times to get a sample
    for (let i = 0; i < 3; i++) {
      const result = await endpoint.run();
      timings.push(result.duration);
      if (!endpoint.success(result)) {
        errors.push(`${endpoint.name}: ${result.error || `HTTP ${result.status}`}`);
      }
    }
  }

  await new Promise((r) => proxy.close(r));

  const sorted = [...timings].sort((a, b) => a - b);
  const p50    = sorted[Math.floor(sorted.length * 0.50)];
  const p95    = sorted[Math.floor(sorted.length * 0.95)];
  const avg    = Math.round(timings.reduce((s, t) => s + t, 0) / timings.length);

  return {
    delayMs:    scenario.delayMs,
    p50,
    p95,
    avg,
    errorCount: errors.length,
    totalReqs:  timings.length,
    meetsP95:   p95 <= scenario.expectedP95,
    errors,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runNetworkLatencyTests() {
  const scenarios = CLI_DELAY !== null
    ? [{ label: `Custom delay (${CLI_DELAY}ms)`, delayMs: CLI_DELAY, expectedP95: CLI_DELAY + 600 }]
    : LATENCY_SCENARIOS;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CHAOS TEST — Network Latency Injection');
  console.log(`  Proxy port : ${PROXY_PORT}  →  Backend: ${BASE_URL}`);
  console.log(`  Scenarios  : ${scenarios.length}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  ${'Scenario'.padEnd(30)} ${'Delay'.padEnd(8)} ${'Avg'.padEnd(8)} ${'p50'.padEnd(8)} ${'p95'.padEnd(8)} ${'Errors'}`);
  console.log(`  ${'─'.repeat(30)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(10)}`);

  const results = [];

  for (const scenario of scenarios) {
    process.stdout.write(`  ${scenario.label.padEnd(30)} ${String(scenario.delayMs + 'ms').padEnd(8)} `);

    let result;
    try {
      result = await runScenario(scenario);
    } catch (err) {
      console.log(`SKIP (backend unreachable: ${err.message})`);
      results.push({ scenario: scenario.label, skipped: true, reason: err.message });
      continue;
    }

    const meetsLabel = result.meetsP95 ? 'OK ' : 'SLOW';
    console.log(
      `${String(result.avg + 'ms').padEnd(8)} ${String(result.p50 + 'ms').padEnd(8)} ${String(result.p95 + 'ms').padEnd(8)} ${result.errorCount}/${result.totalReqs} [${meetsLabel}]`
    );
    results.push({ scenario: scenario.label, ...result });
  }

  console.log('');
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  FINDINGS');
  console.log('───────────────────────────────────────────────────────────────');

  const nonSkipped = results.filter(r => !r.skipped);
  if (nonSkipped.length > 0) {
    const maxDelay   = Math.max(...nonSkipped.map(r => r.delayMs));
    const severeCase = nonSkipped.find(r => r.delayMs === maxDelay);
    if (severeCase) {
      console.log(`  Severe latency (${maxDelay}ms) p95: ${severeCase.p95}ms — errors: ${severeCase.errorCount}/${severeCase.totalReqs}`);
    }
    const slowScenarios = nonSkipped.filter(r => !r.meetsP95);
    if (slowScenarios.length > 0) {
      console.log(`  Scenarios exceeding p95 threshold: ${slowScenarios.map(r => r.scenario).join(', ')}`);
    } else {
      console.log('  All scenarios met p95 threshold.');
    }
  }

  console.log('');
  console.log('  Recommendations:');
  console.log('  1. Add request timeout config in frontend axios instance (src/services/)');
  console.log('  2. Show loading spinners / skeleton screens for requests > 500ms');
  console.log('  3. Consider response caching for GET /api/articles and /api/tags');
  console.log('───────────────────────────────────────────────────────────────');

  return results;
}

await runNetworkLatencyTests();
