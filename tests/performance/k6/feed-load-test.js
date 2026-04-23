/**
 * Performance Test — Module: Global Feed & Pagination
 * High-risk module #3 (from midterm risk analysis)
 *
 * Scenarios: normal / peak / spike / endurance  (--env SCENARIO=<name>)
 *
 * Endpoints under test:
 *   GET /api/articles                          (global feed, default)
 *   GET /api/articles?limit=10&offset=0        (paginated — first page)
 *   GET /api/articles?limit=10&offset=10       (paginated — second page)
 *   GET /api/articles?tag=qa                   (tag filter)
 *   GET /api/tags                              (tag list)
 *
 * Run:
 *   k6 run --env SCENARIO=normal tests/performance/k6/feed-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  THRESHOLDS,
  STRESS_THRESHOLDS,
  NORMAL_LOAD_STAGES,
  PEAK_LOAD_STAGES,
  SPIKE_STAGES,
  ENDURANCE_STAGES,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const feedSuccessRate     = new Rate('feed_success_rate');
const feedDuration        = new Trend('feed_duration_ms');
const paginationSuccess   = new Rate('feed_pagination_success_rate');
const tagFilterSuccess    = new Rate('feed_tag_filter_success_rate');
const feedRequests        = new Counter('feed_total_requests');

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
    feed_success_rate:           ['rate>0.99'],
    feed_pagination_success_rate:['rate>0.99'],
    feed_tag_filter_success_rate:['rate>0.99'],
  },
};

export function setup() {
  // Verify feed endpoint is reachable before starting
  const res = http.get(`${BASE_URL}/api/articles?limit=1`);
  if (res.status !== 200) {
    console.error(`Feed check failed: ${res.status}`);
  }
  return {};
}

// ── Main VU function ──────────────────────────────────────────────────────────
export default function () {
  // ── Group 1: Default global feed ─────────────────────────────────────────
  group('GET /api/articles (default)', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/articles`);
    feedDuration.add(Date.now() - start);
    feedRequests.add(1);

    const ok = check(res, {
      'feed: status 200':                   (r) => r.status === 200,
      'feed: body has articlesCount':       (r) => JSON.parse(r.body)?.articlesCount !== undefined,
      'feed: articles is array':            (r) => Array.isArray(JSON.parse(r.body)?.articles),
      'feed: response time < 500ms':        (r) => r.timings.duration < 500,
    });
    feedSuccessRate.add(ok);
  });

  sleep(0.2);

  // ── Group 2: Paginated feed — first page ──────────────────────────────────
  group('GET /api/articles?limit=10&offset=0', () => {
    const res = http.get(`${BASE_URL}/api/articles?limit=10&offset=0`);
    feedRequests.add(1);

    const ok = check(res, {
      'pagination-p1: status 200':           (r) => r.status === 200,
      'pagination-p1: ≤10 articles':         (r) => JSON.parse(r.body)?.articles?.length <= 10,
      'pagination-p1: response time < 500ms':(r) => r.timings.duration < 500,
    });
    paginationSuccess.add(ok);
  });

  sleep(0.2);

  // ── Group 3: Paginated feed — second page ─────────────────────────────────
  group('GET /api/articles?limit=10&offset=10', () => {
    const res = http.get(`${BASE_URL}/api/articles?limit=10&offset=10`);
    feedRequests.add(1);

    const ok = check(res, {
      'pagination-p2: status 200':            (r) => r.status === 200,
      'pagination-p2: response time < 500ms': (r) => r.timings.duration < 500,
    });
    paginationSuccess.add(ok);
  });

  sleep(0.2);

  // ── Group 4: Tag-filtered feed ────────────────────────────────────────────
  group('GET /api/articles?tag=qa', () => {
    const res = http.get(`${BASE_URL}/api/articles?tag=qa`);
    feedRequests.add(1);

    const ok = check(res, {
      'tag-filter: status 200':            (r) => r.status === 200,
      'tag-filter: response time < 500ms': (r) => r.timings.duration < 500,
    });
    tagFilterSuccess.add(ok);
  });

  sleep(0.2);

  // ── Group 5: Tag list ─────────────────────────────────────────────────────
  group('GET /api/tags', () => {
    const res = http.get(`${BASE_URL}/api/tags`);
    feedRequests.add(1);

    check(res, {
      'tags: status 200':            (r) => r.status === 200,
      'tags: body has tags array':   (r) => Array.isArray(JSON.parse(r.body)?.tags),
      'tags: response time < 300ms': (r) => r.timings.duration < 300,
    });
  });

  sleep(1);
}

export function teardown() {
  console.log(`Feed load test (${SCENARIO}) complete.`);
}
