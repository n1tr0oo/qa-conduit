/**
 * Performance Test — Combined Full-System Scenario
 * Simulates realistic mixed traffic across all three high-risk modules.
 *
 * Traffic mix (approximates real-world Conduit usage):
 *   60% — Feed browsing (read-heavy)
 *   25% — Authentication (login/register)
 *   15% — Article management (write operations)
 *
 * Stages (default — normal load):
 *   0→20 VUs over 1m, hold 5m, ramp down 1m  (7 min total)
 *
 * Run:
 *   k6 run tests/performance/k6/full-scenario.js
 *   k6 run --env SCENARIO=stress tests/performance/k6/full-scenario.js
 *
 *   Output JSON:
 *   k6 run --out json=tests/performance/results/full-normal.json tests/performance/k6/full-scenario.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  BASE_URL,
  TEST_USER,
  makeAuthHeader,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const overallSuccessRate = new Rate('overall_success_rate');
const p95Duration        = new Trend('p95_response_time');

const SCENARIO = __ENV.SCENARIO || 'normal';

const STAGES = {
  normal: [
    { duration: '1m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  stress: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 50 },
    { duration: '3m', target: 80 },
    { duration: '2m', target: 0 },
  ],
  spike: [
    { duration: '30s', target: 5 },
    { duration: '15s', target: 150 },
    { duration: '1m',  target: 150 },
    { duration: '15s', target: 5 },
    { duration: '30s', target: 0 },
  ],
};

export const options = {
  stages: STAGES[SCENARIO] || STAGES.normal,
  thresholds: {
    http_req_duration:    ['p(95)<800', 'p(99)<2000'],
    http_req_failed:      ['rate<0.02'],
    overall_success_rate: ['rate>0.98'],
  },
};

// ── Setup: get a shared token ─────────────────────────────────────────────────
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/users/login`,
    JSON.stringify({ user: TEST_USER }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return {
    token: res.status === 200 ? JSON.parse(res.body).user?.token : null,
  };
}

// ── Weighted traffic simulation ───────────────────────────────────────────────
export default function ({ token }) {
  const rand = Math.random();

  if (rand < 0.60) {
    // 60% — feed browsing
    browseFeeds();
  } else if (rand < 0.85) {
    // 25% — authentication
    authenticateUser();
  } else {
    // 15% — article management
    manageArticles(token);
  }

  sleep(Math.random() * 2 + 0.5); // random think time 0.5–2.5s
}

// ── Feed browsing ─────────────────────────────────────────────────────────────
function browseFeeds() {
  group('Feed: browse global feed', () => {
    const res = http.get(`${BASE_URL}/api/articles?limit=10&offset=0`);
    p95Duration.add(res.timings.duration);
    const ok = check(res, {
      'feed: 200': (r) => r.status === 200,
      'feed: <500ms': (r) => r.timings.duration < 500,
    });
    overallSuccessRate.add(ok);
  });

  sleep(0.3);

  group('Feed: fetch tags', () => {
    const res = http.get(`${BASE_URL}/api/tags`);
    check(res, {
      'tags: 200': (r) => r.status === 200,
    });
  });
}

// ── Authentication ────────────────────────────────────────────────────────────
function authenticateUser() {
  group('Auth: login', () => {
    const res = http.post(
      `${BASE_URL}/api/users/login`,
      JSON.stringify({ user: TEST_USER }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    p95Duration.add(res.timings.duration);
    const ok = check(res, {
      'login: 200': (r) => r.status === 200,
      'login: has token': (r) => JSON.parse(r.body)?.user?.token !== undefined,
      'login: <500ms': (r) => r.timings.duration < 500,
    });
    overallSuccessRate.add(ok);
  });
}

// ── Article management ────────────────────────────────────────────────────────
function manageArticles(token) {
  if (!token) return;

  const headers = makeAuthHeader(token);
  let slug = null;

  group('Articles: create', () => {
    const res = http.post(
      `${BASE_URL}/api/articles`,
      JSON.stringify({
        article: {
          title:       `Full Scenario ${__VU}-${__ITER}`,
          description: 'Mixed traffic simulation',
          body:        'Load test article body.',
          tagList:     ['loadtest'],
        },
      }),
      { headers },
    );
    p95Duration.add(res.timings.duration);
    const ok = check(res, {
      'create: 201': (r) => r.status === 201,
      'create: <500ms': (r) => r.timings.duration < 500,
    });
    overallSuccessRate.add(ok);
    if (res.status === 201) slug = JSON.parse(res.body).article?.slug;
  });

  sleep(0.2);

  if (slug) {
    group('Articles: delete', () => {
      const res = http.del(`${BASE_URL}/api/articles/${slug}`, null, { headers });
      check(res, { 'delete: 200': (r) => r.status === 200 || r.status === 204 });
    });
  }
}

export function teardown() {
  console.log(`Full scenario (${SCENARIO}) complete.`);
}
