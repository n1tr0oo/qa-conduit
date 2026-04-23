/**
 * Performance Test — Module: User Authentication
 * High-risk module #1 (from midterm risk analysis)
 *
 * Scenarios:
 *   - normal    : 20 VUs × 3 min   → steady-state RPS check
 *   - peak      : 50 VUs × 2 min   → peak traffic burst
 *   - spike     : 0→100→0 VUs      → sudden traffic spike
 *   - endurance : 10 VUs × 30 min  → memory-leak / drift check
 *
 * Endpoints under test:
 *   POST /api/users/login    (login)
 *   POST /api/users          (registration)
 *   GET  /api/user           (get current user — requires JWT)
 *
 * Run:
 *   k6 run --env SCENARIO=normal   tests/performance/k6/auth-load-test.js
 *   k6 run --env SCENARIO=peak     tests/performance/k6/auth-load-test.js
 *   k6 run --env SCENARIO=spike    tests/performance/k6/auth-load-test.js
 *   k6 run --env SCENARIO=endurance tests/performance/k6/auth-load-test.js
 *
 *   Add --out json=tests/performance/results/auth-<scenario>.json to persist metrics.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  THRESHOLDS,
  STRESS_THRESHOLDS,
  TEST_USER,
  NORMAL_LOAD_STAGES,
  PEAK_LOAD_STAGES,
  SPIKE_STAGES,
  ENDURANCE_STAGES,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const loginSuccessRate   = new Rate('auth_login_success_rate');
const loginDuration      = new Trend('auth_login_duration_ms');
const registerSuccessRate = new Rate('auth_register_success_rate');
const tokenValidations   = new Counter('auth_token_validations');

// ── Scenario selector ─────────────────────────────────────────────────────────
const SCENARIO = __ENV.SCENARIO || 'normal';

const STAGE_MAP = {
  normal:    NORMAL_LOAD_STAGES,
  peak:      PEAK_LOAD_STAGES,
  spike:     SPIKE_STAGES,
  endurance: ENDURANCE_STAGES,
};

const THRESHOLD_MAP = {
  normal:    THRESHOLDS,
  peak:      THRESHOLDS,
  spike:     STRESS_THRESHOLDS,
  endurance: THRESHOLDS,
};

export const options = {
  stages: STAGE_MAP[SCENARIO] || NORMAL_LOAD_STAGES,
  thresholds: {
    ...THRESHOLD_MAP[SCENARIO],
    auth_login_success_rate: ['rate>0.99'],
  },
};

// ── Setup: obtain a shared token once ────────────────────────────────────────
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/users/login`,
    JSON.stringify({ user: TEST_USER }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const token = res.status === 200 ? JSON.parse(res.body).user?.token : null;
  return { token };
}

// ── Main VU function ──────────────────────────────────────────────────────────
export default function ({ token }) {
  // ── Group 1: Login (most critical auth path) ────────────────────────────
  group('POST /api/users/login', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/users/login`,
      JSON.stringify({ user: TEST_USER }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    loginDuration.add(Date.now() - start);

    const ok = check(res, {
      'login: status 200':           (r) => r.status === 200,
      'login: body has token':       (r) => JSON.parse(r.body)?.user?.token !== undefined,
      'login: response time < 500ms':(r) => r.timings.duration < 500,
    });
    loginSuccessRate.add(ok);
  });

  sleep(0.5);

  // ── Group 2: Get current user (JWT validation) ──────────────────────────
  if (token) {
    group('GET /api/user', () => {
      const res = http.get(`${BASE_URL}/api/user`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
      });
      tokenValidations.add(1);

      check(res, {
        'get-user: status 200':             (r) => r.status === 200,
        'get-user: body has email':         (r) => JSON.parse(r.body)?.user?.email !== undefined,
        'get-user: response time < 300ms':  (r) => r.timings.duration < 300,
      });
    });
  }

  sleep(0.5);

  // ── Group 3: Invalid login (error handling under load) ──────────────────
  group('POST /api/users/login (invalid credentials)', () => {
    const res = http.post(
      `${BASE_URL}/api/users/login`,
      JSON.stringify({ user: { email: 'wrong@example.com', password: 'wrongpass' } }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    check(res, {
      'invalid-login: status 4xx':         (r) => r.status >= 400 && r.status < 500,
      'invalid-login: response time < 1s': (r) => r.timings.duration < 1000,
    });
  });

  sleep(1);
}

// ── Teardown ──────────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log(`Auth load test (${SCENARIO}) complete.`);
}
