// Shared K6 configuration — thresholds and scenario helpers
// Usage: import { BASE_URL, THRESHOLDS, makeAuthHeader } from './config.js';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// ── Performance thresholds ────────────────────────────────────────────────────
// Derived from baseline metrics in docs/baseline-metrics.md
export const THRESHOLDS = {
  // 95th-percentile response time under normal load
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  // Less than 1% of requests may fail
  http_req_failed: ['rate<0.01'],
  // Throughput — at least 10 req/s under normal load
  http_reqs: ['rate>10'],
};

// Stricter thresholds for the stress scenario
export const STRESS_THRESHOLDS = {
  http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  http_req_failed: ['rate<0.05'],
};

// ── Default credentials (must match CI seed data) ────────────────────────────
export const TEST_USER = {
  email: 'qa_test@example.com',
  password: 'password123',
};

// ── Helper: obtain a JWT token via login ──────────────────────────────────────
// Call once in setup(), pass the token to default() via exported data.
export function login(http) {
  const res = http.post(
    `${BASE_URL}/api/users/login`,
    JSON.stringify({ user: TEST_USER }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    console.error(`Login failed: ${res.status} — ${res.body}`);
    return null;
  }
  return JSON.parse(res.body).user.token;
}

// ── Helper: auth header object ───────────────────────────────────────────────
export function makeAuthHeader(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Token ${token}`,
  };
}

// ── Shared scenario definitions ───────────────────────────────────────────────
// Import only what you need — each script picks its own stages.

// Normal load: 20 VUs ramp up, hold, ramp down (5 minutes total)
export const NORMAL_LOAD_STAGES = [
  { duration: '1m', target: 20 },
  { duration: '3m', target: 20 },
  { duration: '1m', target: 0 },
];

// Peak load: ramp to 50 VUs
export const PEAK_LOAD_STAGES = [
  { duration: '1m', target: 20 },
  { duration: '2m', target: 50 },
  { duration: '2m', target: 50 },
  { duration: '1m', target: 0 },
];

// Spike load: instant jump to 100 VUs then back
export const SPIKE_STAGES = [
  { duration: '30s', target: 5 },
  { duration: '10s', target: 100 },
  { duration: '1m',  target: 100 },
  { duration: '10s', target: 5 },
  { duration: '30s', target: 0 },
];

// Endurance / soak: 10 VUs for 30 minutes
export const ENDURANCE_STAGES = [
  { duration: '2m',  target: 10 },
  { duration: '26m', target: 10 },
  { duration: '2m',  target: 0 },
];
