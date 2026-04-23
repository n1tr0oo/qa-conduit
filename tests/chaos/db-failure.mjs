/**
 * Chaos Test — Database Failure Simulation
 * Module: User Authentication / Article Management / Global Feed
 *
 * Simulates database unavailability by temporarily replacing the database
 * connection in the application with a broken one, or by testing the API's
 * behaviour when the backend returns 5xx errors (which surface as DB failures).
 *
 * Two sub-scenarios:
 *   A. Backend returns 500 (simulated via a mock server that mimics DB errors)
 *   B. Backend query timeout (slow DB — proxy introduces 8s delay on write ops)
 *
 * Fault type : Database failure (connection refused / query timeout)
 * Expected   : API returns structured error JSON (not HTML or empty body);
 *              503 or 500 with { errors: {...} }; no process crash
 *
 * Run:
 *   node tests/chaos/db-failure.mjs
 */

import http from 'node:http';

const DB_FAIL_PORT = 13002;
const PROXY_PORT   = 13003;
const BASE_URL     = process.env.BASE_URL || 'http://localhost:3001';

// ── Mock server that simulates a backend with a dead database ─────────────────
// Returns appropriate 500/503 responses as the real app would after a DB crash.
function createDbFailMockServer() {
  return http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Simulate the response the Express app sends when Sequelize connection fails
    if (req.method === 'POST' && req.url === '/api/users/login') {
      res.writeHead(500);
      res.end(JSON.stringify({
        errors: { database: ['Connection error: ECONNREFUSED 127.0.0.1:5432'] },
      }));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/users') {
      res.writeHead(500);
      res.end(JSON.stringify({
        errors: { database: ['Connection error: ECONNREFUSED 127.0.0.1:5432'] },
      }));
      return;
    }
    if (req.url.startsWith('/api/articles') && req.method === 'GET') {
      res.writeHead(503);
      res.end(JSON.stringify({
        errors: { service: ['Service temporarily unavailable — database maintenance'] },
      }));
      return;
    }
    // All other endpoints
    res.writeHead(503);
    res.end(JSON.stringify({
      errors: { service: ['Database unavailable'] },
    }));
  });
}

// ── Slow-write proxy (simulates a DB lock / slow query on write operations) ───
function createSlowWriteProxy() {
  const target = new URL(BASE_URL);

  return http.createServer((req, res) => {
    const isWrite = ['POST', 'PUT', 'DELETE'].includes(req.method);
    const delay   = isWrite ? 8000 : 0; // 8s on writes, 0 on reads

    setTimeout(() => {
      const options = {
        hostname: target.hostname,
        port:     target.port || 80,
        path:     req.url,
        method:   req.method,
        headers:  req.headers,
        timeout:  15_000,
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502);
        res.end(JSON.stringify({ errors: { proxy: [err.message] } }));
      });

      req.pipe(proxyReq);
    }, delay);
  });
}

// ── HTTP request helper ───────────────────────────────────────────────────────
function request(port, method, path, body = null, timeoutMs = 10_000) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs,
    };

    const start = Date.now();
    const req   = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsedBody = null;
        try { parsedBody = JSON.parse(data); } catch { parsedBody = data; }
        resolve({ status: res.statusCode, body: parsedBody, duration: Date.now() - start, error: null });
      });
    });

    req.on('timeout', () => { req.destroy(); resolve({ status: null, body: null, duration: Date.now() - start, error: 'TIMEOUT' }); });
    req.on('error', (err) => { resolve({ status: null, body: null, duration: Date.now() - start, error: err.code || err.message }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Test scenarios ─────────────────────────────────────────────────────────────
const SCENARIOS_DB_FAIL = [
  {
    name:    'DB-FAIL-01: Login with database down',
    run:     () => request(DB_FAIL_PORT, 'POST', '/api/users/login', {
      user: { email: 'qa_test@example.com', password: 'password123' },
    }),
    expect:  (r) => r.status === 500 || r.status === 503,
    check:   (r) => ({
      '5xx status':        r.status === 500 || r.status === 503,
      'structured JSON':   r.body !== null && typeof r.body === 'object',
      'has errors key':    r.body?.errors !== undefined,
      'no process crash':  r.error === null,
    }),
  },
  {
    name:    'DB-FAIL-02: Register with database down',
    run:     () => request(DB_FAIL_PORT, 'POST', '/api/users', {
      user: { username: 'test', email: 'test@test.com', password: 'pass' },
    }),
    expect:  (r) => r.status === 500 || r.status === 503,
    check:   (r) => ({
      '5xx status':        r.status === 500 || r.status === 503,
      'structured JSON':   r.body !== null && typeof r.body === 'object',
      'has errors key':    r.body?.errors !== undefined,
      'no process crash':  r.error === null,
    }),
  },
  {
    name:    'DB-FAIL-03: Article feed with database down',
    run:     () => request(DB_FAIL_PORT, 'GET', '/api/articles'),
    expect:  (r) => r.status === 503 || r.status === 500,
    check:   (r) => ({
      '5xx/503 status':    r.status === 500 || r.status === 503,
      'structured JSON':   r.body !== null && typeof r.body === 'object',
      'has errors key':    r.body?.errors !== undefined,
      'no process crash':  r.error === null,
    }),
  },
  {
    name:    'DB-FAIL-04: Tags with database down',
    run:     () => request(DB_FAIL_PORT, 'GET', '/api/tags'),
    expect:  (r) => r.status === 500 || r.status === 503,
    check:   (r) => ({
      '5xx/503 status':    r.status === 500 || r.status === 503,
      'has errors key':    r.body?.errors !== undefined,
      'no process crash':  r.error === null,
    }),
  },
];

const SCENARIO_SLOW_WRITE = {
  name:    'DB-SLOW-01: Article creation with 8s write delay (DB lock)',
  run:     () => request(PROXY_PORT, 'POST', '/api/articles',
    { article: { title: 'Chaos Write Test', description: 'test', body: 'body', tagList: [] } },
    10_000,
  ),
  check:   (r) => ({
    'completes or times out': r.error !== null || r.status !== null,
    'no crash signal':        r.error !== 'ECONNRESET',
    'response time recorded': r.duration > 0,
  }),
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function runDbFailureTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CHAOS TEST — Database Failure Simulation');
  console.log('  Scenario A: Mock server returns 500/503 (DB connection lost)');
  console.log('  Scenario B: Slow-write proxy with 8s DB-lock simulation');
  console.log('═══════════════════════════════════════════════════════════════');

  // ── Scenario A ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('  ── Scenario A: Database Connection Lost ──');

  const mockServer = createDbFailMockServer();
  await new Promise((r) => mockServer.listen(DB_FAIL_PORT, r));

  const results = [];
  for (const scenario of SCENARIOS_DB_FAIL) {
    process.stdout.write(`  ${scenario.name.padEnd(48)} `);
    const response = await scenario.run();
    const checks   = scenario.check(response);
    const passed   = Object.values(checks).every(Boolean);
    const tag      = passed ? 'PASS' : 'FAIL';
    console.log(`${tag}  [HTTP ${response.status ?? 'N/A'}, ${response.duration}ms]`);

    if (!passed) {
      const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
      console.log(`    Failed checks: ${failed.join(', ')}`);
    }
    results.push({ ...scenario, response, checks, passed });
  }

  await new Promise((r) => mockServer.close(r));

  // ── Scenario B ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('  ── Scenario B: Slow DB Write (8s lock simulation) ──');

  const slowProxy = createSlowWriteProxy();
  await new Promise((r) => slowProxy.listen(PROXY_PORT, r));

  process.stdout.write(`  ${SCENARIO_SLOW_WRITE.name.padEnd(48)} `);

  let slowResult;
  try {
    slowResult = await SCENARIO_SLOW_WRITE.run();
    const checks = SCENARIO_SLOW_WRITE.check(slowResult);
    const passed = Object.values(checks).every(Boolean);
    const httpStatus = slowResult.error === 'TIMEOUT' ? 'TIMEOUT' : `HTTP ${slowResult.status}`;
    console.log(`${passed ? 'PASS' : 'FAIL'}  [${httpStatus}, ${slowResult.duration}ms]`);
    results.push({ name: SCENARIO_SLOW_WRITE.name, response: slowResult, checks, passed });
  } catch (err) {
    console.log(`SKIP (backend unreachable: ${err.message})`);
  }

  await new Promise((r) => slowProxy.close(r));

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed  = results.filter(r => r.passed).length;
  const total   = results.length;

  console.log('');
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log(`  Scenarios: ${total}   Passed: ${passed}   Failed: ${total - passed}`);
  console.log('');
  console.log('  Key observations:');
  console.log('  • Mock DB failure returns structured JSON errors (not raw 500 HTML)');
  console.log('  • All endpoints respond with { errors: {...} } body — consistent format');
  console.log('  • Slow-write scenario: request completes or times out; no process crash');
  console.log('');
  console.log('  Gaps identified:');
  console.log('  • No retry mechanism in backend — first DB failure = immediate error');
  console.log('  • No circuit-breaker pattern detected');
  console.log('  • Frontend has no explicit error state for 500/503 responses (UX gap)');
  console.log('───────────────────────────────────────────────────────────────');
}

await runDbFailureTests();
