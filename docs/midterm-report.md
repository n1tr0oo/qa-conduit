# Midterm Report — QA Implementation & Empirical Analysis
## Project: Conduit RealWorld App
**Date:** 2026-04-11
**Version:** 1.0
**Team:** 3 members
**Repository:** https://github.com/n1tr0oo/qa-conduit

---

## 1. System Description

### Architecture
Conduit is a full-stack blogging platform (Medium clone) built as a monolithic web application with separate frontend and backend processes communicating over HTTP.

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19, React Router (HashRouter), Vite 7 | SPA served on port 3000 |
| Backend | Express.js 5, Sequelize ORM 6 | REST API on port 3001 |
| Database | PostgreSQL 15 | Persistent data store |
| Authentication | JWT (jsonwebtoken) | Stateless token-based auth |
| Build / Dev | Node.js 20, npm workspaces | Dependency management |

### Key Functionalities
- User registration and login with JWT token issuance
- Full article CRUD (Create, Read, Update, Delete) with slug-based routing
- Global article feed with limit/offset pagination and tag filtering
- Comments system (add, list, delete per article)
- User profiles with follow/unfollow social graph
- Favorites (like/unlike article counter)

---

## 2. Methodology

### Risk-Based Testing Approach
Testing priority was determined by a risk matrix combining **probability of failure** × **impact if fails**. Three HIGH-risk modules were identified in Assignment 1 and confirmed empirically in Assignment 2. This midterm refines those scores using real failure data from CI/CD runs.

Risk scoring scale: 1 (lowest) — 10 (highest).

### Test Design Strategy
Tests follow a **fail-fast, evidence-driven** design:
- Each test maps to a specific risk module and business function
- Negative tests (expected failures) are treated with the same priority as positive tests
- Edge-case inputs (empty fields, special characters, malformed tokens) are explicitly designed rather than discovered by accident
- Variable chaining in API tests preserves realistic request sequencing (register → login → create → delete)

### Automation Tools

| Tool | Version | Purpose |
|---|---|---|
| Playwright | 1.59.1 | E2E / UI browser automation (Chromium, Firefox) |
| Newman (Postman CLI) | 6.2.2 | API test execution from Postman collections |
| Node.js `node:test` | built-in (Node 20) | Unit test runner — no additional dependency |
| GitHub Actions | — | CI/CD pipeline (trigger: push / PR to main) |
| `dorny/test-reporter` | v1 | JUnit XML → GitHub "Test Results" UI |

---

## 3. Automation Implementation

### CI/CD Setup (GitHub Actions)

Pipeline file: `.github/workflows/tests.yml`

```
Trigger: push / PR → main
│
├── PostgreSQL 15 service container (health-checked)
│
└── Job: playwright-tests (ubuntu-latest)
    │
    ├── Checkout → Setup Node.js 20
    ├── Clone Conduit app → npm install → Start backend (3001) → Start frontend (3000)
    ├── wait-on (http://localhost:3001/api/tags + http://localhost:3000)
    ├── Create test user + seed article with tag "qa" (curl)
    ├── npm install (QA) → playwright install chromium
    │
    ├── [NEW] node --test tests/unit/*.test.mjs   (unit tests)
    ├── [QG1] npx playwright test --project=chromium  → playwright-results.xml
    ├── [QG2] npx newman run conduit.postman_collection.json → newman-results.xml
    ├── [QG2b] npx newman run conduit-edge-cases.postman_collection.json → newman-edge-results.xml
    ├── [QG3] Quality Gate threshold check (bash, if: always())
    │         └─ parses all XML files, exits 1 if any failures > 0
    │
    ├── dorny/test-reporter → GitHub "Test Results (All Suites)" UI tab
    ├── Upload artifact: playwright-report (HTML, 7 days)
    └── Upload artifact: junit-results (XML, 7 days)
```

### Test Structure

```
tests/
├── unit/
│   └── slugify.test.mjs          ← NEW — 13 unit tests (node:test)
├── ui/
│   ├── smoke.spec.js              ← 4 smoke tests
│   ├── auth.spec.js               ← 6 auth tests
│   ├── articles.spec.js           ← 5 article CRUD tests
│   ├── feed.spec.js               ← 8 feed tests
│   └── edge-cases.spec.js         ← NEW — 5 edge/failure/concurrency tests
└── api/
    ├── conduit.postman_collection.json          ← 18 requests, 34 assertions
    └── conduit-edge-cases.postman_collection.json ← NEW — 8 requests, 16 assertions
```

### Quality Gates Definition

| Gate ID | Metric | Threshold | Enforcement |
|---|---|---|---|
| QG01 | UI test pass rate | 100% | CI exits 1 if Playwright JUnit has failures > 0 |
| QG02 | API assertion pass rate (main suite) | 100% | CI exits 1 if Newman JUnit has failures > 0 |
| QG02b | API assertion pass rate (edge suite) | 100% | CI exits 1 if edge JUnit has failures > 0 |
| QG03 | Critical defects at deploy | 0 | Any test failure blocks merge to main |
| QG04 | HIGH-risk module coverage | 100% | All 3 HIGH modules fully automated |
| QG05 | MEDIUM-risk module coverage | ≥ 80% | Comments 100%, Profile 80% |
| QG06 | Pipeline total runtime | ≤ 10 min | Measured ~5 min; well within threshold |

**Critical Analysis:**
- Thresholds were set at 100% for pass rate — in retrospect, this is achievable because the app is stable and all selector issues were fixed in A2. The threshold is appropriate for this phase.
- Code coverage gate (70%) was not enforced automatically due to `node:test` not generating coverage XML by default; coverage is evaluated manually (see Task 3).
- The 0-critical-defect gate is the most impactful: it ensures no regression reaches main.

---

## Task 1: Refined Risk-Based Testing Strategy

### Task 1.1 — Re-evaluated High-Risk Components

| Module | Original Risk Score (A1) | Observed Issues (A2) | Updated Risk Score | Justification |
|---|---|---|---|---|
| User Authentication | HIGH — 8/10 | 3 defects: dropdown required before logout, error message 10s timeout, selector for login button | HIGH — 8/10 (unchanged) | Defects were automation-layer issues (CSS selectors, timing), not application logic bugs. JWT flow is correct. Token issuance and validation tested across 5 API requests — all pass. No logic regression detected. |
| Article Management | HIGH — 8/10 | 4 defects: multiple h1 elements, Delete button rendered twice, window.confirm blocking delete, slug mutation on title update | HIGH — 9/10 (↑ +1) | Highest defect count (4/9 total). Slug mutation on title change is a latent risk: a title update invalidates all previously captured URLs. This behaviour is invisible to end users until a 404 occurs downstream. Risk likelihood increases. |
| Global Feed & Pagination | HIGH — 7/10 | 2 defects: feed tabs are `<button>` not `<a>`, tag pills are `<button>` not `<a>` | HIGH — 7/10 (unchanged) | No logic defects. Both issues were selector assumptions, not feed behaviour bugs. Seed-data dependency in CI exposed a new infrastructure risk — feed tests silently pass even if no articles are present unless the seed step succeeds. |
| Comments | MEDIUM — 5/10 | 0 defects | MEDIUM — 4/10 (↓ −1) | All three CRUD operations passed without modification. Impact remains medium (visible but non-blocking). Likelihood drops because empirical data shows the module is stable. |
| User Profile | MEDIUM — 5/10 | 0 defects | MEDIUM — 4/10 (↓ −1) | Single API test passed. No UI automation — a coverage gap remains. However, profile is a read-heavy endpoint with minimal write logic; no failures observed in any run. |

### Task 1.2 — Evidence from Automation Runs

#### A. Failed Test Cases
No test cases **permanently** failed in CI. All failures during development were fixed before the final pipeline run.

| Test Name | Module | Failure Type | Frequency | Resolution |
|---|---|---|---|---|
| `TC-AU-06 logout` | Authentication | Selector error — dropdown not opened first | 1 local run | Added `.nav-link.dropdown-toggle` click before logout click |
| `TC-AU-02 wrong password` | Authentication | Timeout — `ul.error-messages` not appearing within default 5s | 2 local runs | Extended timeout to 10 000 ms |
| `TC-AR-03 delete article` | Article Management | `window.confirm` dialog blocked `.click()` | 1 local run | Added `page.on('dialog', d => d.accept())` |
| `TC-AR-04 edit article` | Article Management | `h1` matched wrong element (banner h1) | 1 local run | Scoped to `.article-page h1` |
| `TC-FD-05 tag filter` | Global Feed | `button.tag-pill` not found (no seed data in early CI) | 2 CI runs | Added curl seed step to workflow |

#### B. Flaky Tests
**No flaky tests identified.** Across all CI runs from commit `22e8d53` onward, every test either consistently passes or had a deterministic root cause that was fixed. The `TC-FD-05` tag-filter test was conditionally skipped (`test.skip()`) when no tags existed — this is a graceful skip, not flakiness.

#### C. Coverage Gaps

| Module | Risk | API Coverage | UI Coverage | Code Coverage* | Gap |
|---|---|---|---|---|---|
| User Authentication | HIGH | 5 requests / 10 assertions | 6 UI tests | ~85% | Token expiry path untested |
| Article Management | HIGH | 6 requests / 13 assertions | 5 UI tests | ~80% | Large payload, special chars in title |
| Global Feed & Pagination | HIGH | 3 requests / 6 assertions | 8 UI tests | ~75% | Pagination UI (next page click) not tested |
| Comments | MEDIUM | 3 requests / 5 assertions | 0 UI tests | ~60% | **< 70% — UI test gap** |
| User Profile | MEDIUM | 1 request / 3 assertions | 0 UI tests | ~40% | **< 70% — UI test gap; follow/unfollow untested** |
| Favorites | LOW | 0 | 0 | 0% | Manual only |

*Estimated based on function count covered by tests; formal tool-based coverage requires Istanbul/c8 instrumentation.

**Modules below 70% coverage threshold: Comments (UI), User Profile (UI)**

#### D. Unexpected System Behavior
1. **DELETE returns 200, not 204** — Conduit backend responds with `200 OK` + empty body on delete. REST convention expects `204 No Content`. Fixed by asserting `oneOf([200, 204])`.
2. **Slug mutation on title update** — Changing article title changes the slug. A subsequent GET on the old slug returns 404. This was not documented in the original risk assessment and is a real data-integrity edge case.
3. **`window.confirm` on article delete** — The React app renders a native browser confirm dialog instead of a custom modal. Playwright does not intercept this automatically — explicit `page.on('dialog')` is required.
4. **Feed tab elements are `<button>`, not `<a>`** — Assumption based on CSS class `.nav-link` was wrong. The app uses `<button class="nav-link">` for feed tabs, which changes the appropriate Playwright selector pattern.

### Task 1.3 — Map Evidence to Risk Dimensions

| Module | Likelihood | Impact | Detectability | Notes |
|---|---|---|---|---|
| User Authentication | Medium ↔ (confirmed) | Critical ↑ (confirmed) | Medium — tests cover main paths; expiry not tested | Risk score stays 8 — empirical data matches A1 prediction |
| Article Management | Medium → High ↑ | High (confirmed) | Medium-Low — slug mutation is subtle, easily missed | Risk ↑ to 9 — slug mutation is a hidden state-management defect |
| Global Feed & Pagination | Medium ↔ | High (confirmed) | Medium — seed data dependency adds infra risk | Risk stays 7 — behavior correct, selector assumptions wrong |
| Comments | Low ↓ | Medium (confirmed) | Medium-Low — no UI tests | Risk ↓ to 4 — 0 defects in all runs |
| User Profile | Low ↓ | Medium (confirmed) | Low — only API tested, no UI tests | Risk ↓ to 4 — 0 defects; but UI gap lowers detectability |

---

## Task 2: Expanded Automation & Coverage

### Task 2.1 — New Test Cases (10 total)

#### Unit Tests (Task 2.2A — Logic-Level)

| Test ID | Target Module | Scenario Type | Input Data | Expected Output | Actual Result |
|---|---|---|---|---|---|
| TC-UNIT-01 | Slug Generation (Article Management) | Edge — standard inputs regression | "Hello World", "  Hello World  ", "Hello_world", "Hello-world" | "hello-world" for all | Pass ✅ |
| TC-UNIT-02 | Slug Generation | Edge — empty / whitespace | "", "   " | "" | Pass ✅ |
| TC-UNIT-03 | Slug Generation | Edge — numeric inputs | "article 42", "123 test", "Hello World 2026" | "article-42", "123-test", "hello-world-2026" | Pass ✅ |
| TC-UNIT-04 | Slug Generation | Edge — special characters / injection | "bread & butter", "<script>alert(1)</script>", "'; DROP TABLE--", "hello 🌍 world" | No `<`, `>`, `'`, `;` in output; emoji removed | Pass ✅ |
| TC-UNIT-05 | Slug Generation | Edge — consecutive delimiters | "hello  world", "hello\tworld", "hello\nworld" | "hello--world", "hello-world", "hello-world" | Pass ✅ |

#### E2E Tests — Failure / Edge / Concurrency / Invalid User Behavior (Task 2.2C)

| Test ID | Target Module | Scenario Type | Input Data | Expected Output | Actual Result |
|---|---|---|---|---|---|
| TC-AUTH-FAIL-01 | User Authentication (HIGH) | Failure — empty credentials | Email = "", Password = "" → click Login | HTML5 validation prevents submit; URL stays on `/#/login` (no redirect) | Pass ✅ |
| TC-AUTH-FAIL-02 | User Authentication (HIGH) | Failure / injection input — SQL injection in password | Email = qa_test@example.com, Password = `' OR '1'='1'; DROP TABLE--` | `ul.error-messages` visible; bcrypt rejects injection string; user NOT logged in | Pass ✅ |
| TC-ART-EDGE-01 | Article Management (HIGH) | Edge — XSS-like title input | Title: `<script>alert(1)</script> Article {ts}` | Article created; no alert dialog fires; `<` `>` not executed in DOM | Pass ✅ |
| TC-CONC-01 | User Authentication (HIGH) | Concurrency — rapid double-click submit | dblclick on Login button with valid credentials | App lands on home once; no crash or JS error | Pass ✅ |
| TC-INV-01 | Authentication / User Profile (MEDIUM) | Invalid user behavior — skip auth step | Navigate to `/#/settings` without login | Redirected away from `/settings`; protected route inaccessible | Pass ✅ |

#### API Edge-Case Tests (Task 2.2B — Integration-Level)

| Test ID | Target Module | Scenario Type | Input Data | Expected Output | Actual Result |
|---|---|---|---|---|---|
| TC-API-FAIL-01 | Article Management (HIGH) | Failure — missing auth | POST /api/articles, no token | 401, errors object | Pass ✅ |
| TC-API-FAIL-02 | Article Management (HIGH) | Failure — resource not found | GET /api/articles/this-article-does-not-exist-00000000 | 404 or 422, errors object | Pass ✅ |
| TC-API-EDGE-01 | User Authentication (HIGH) | Edge — missing required field | POST /api/users without username | 422, errors object | Pass ✅ |
| TC-API-EDGE-02 | User Authentication (HIGH) | Edge — empty required field | POST /api/users with username = "" | 422, errors object | Pass ✅ |
| TC-API-CONC-01 | User Authentication (HIGH) | Concurrency — two sequential logins | POST /api/users/login × 2 (same credentials) | Both return 200 + valid independent JWT tokens | Pass ✅ |
| TC-API-INV-01 | User Authentication (HIGH) | Invalid behavior — malformed JWT | GET /api/user with token = "this.is.not.a.real.jwt" | 401, errors object | Pass ✅ |

**Total new test cases: 5 unit + 5 E2E + 6 API = 16 new tests**
**Combined suite: 23 original UI + 5 new E2E + 13 unit + 18 original API + 6 new API = 65 tests / 50 assertions**

### Task 2.2 — All Three Test Levels Implemented

| Level | Tool | Count | Files |
|---|---|---|---|
| A. Unit Tests (Logic) | `node:test` (Node 20 built-in) | 13 tests | `tests/unit/slugify.test.mjs` |
| B. Integration Tests (Module Interaction) | Newman / Postman | 26 requests, 50 assertions | `tests/api/conduit.postman_collection.json` + `tests/api/conduit-edge-cases.postman_collection.json` |
| C. E2E Tests (User Flow) | Playwright | 28 tests × 1 browser (CI) | `tests/ui/*.spec.js` |

**Code Evidence — Unit test (TC-UNIT-04):**
```js
test('XSS-like input is sanitised to dashes (no angle brackets in slug)', () => {
  const result = slugify('<script>alert(1)</script>');
  assert.ok(!result.includes('<'), 'slug must not contain <');
  assert.ok(!result.includes('>'), 'slug must not contain >');
});
```

**Code Evidence — E2E test (TC-ART-EDGE-01):**
```js
test('TC-ART-EDGE-01 — article with XSS-like title is stored and displayed safely', async ({ page }) => {
  await login(page);
  const xssTitle = `<script>alert(1)</script> Article ${Date.now()}`;
  await page.goto('/#/editor');
  await page.locator('input[placeholder="Article Title"]').fill(xssTitle);
  // ... fill fields, submit ...
  await expect(page).toHaveURL(/#\/article\//, { timeout: 10000 });
  let alertFired = false;
  page.on('dialog', async (dialog) => { alertFired = true; await dialog.accept(); });
  await page.waitForTimeout(1000);
  expect(alertFired).toBe(false);
});
```

**Code Evidence — API test (TC-API-FAIL-01):**
```json
{
  "name": "TC-API-FAIL-01 — Create article without auth token (expect 401)",
  "request": { "method": "POST", "header": [], "url": "{{baseUrl}}/articles" },
  "event": [{
    "listen": "test",
    "script": { "exec": [
      "pm.test('status is 401', () => pm.response.to.have.status(401));",
      "pm.test('errors object present', () => pm.expect(pm.response.json()).to.have.property('errors'));"
    ]}
  }]
}
```

### Task 2.3 — CI/CD Execution

Pipeline is configured in `.github/workflows/tests.yml`. On every push/PR to `main`:

1. Install dependencies
2. Start PostgreSQL + backend + frontend
3. Create test user + seed data
4. **[NEW]** Run unit tests (`node --test`)
5. Run Playwright UI tests → `playwright-results.xml`
6. Run Newman main suite → `newman-results.xml`
7. **[NEW]** Run Newman edge-case suite → `newman-edge-results.xml`
8. Quality gate check — parse all XML files; exit 1 if any failures
9. Publish test results → GitHub Actions "Test Results" tab
10. Upload artifacts (HTML report + JUnit XML)

**Evidence:** GitHub Actions runs at https://github.com/n1tr0oo/qa-conduit/actions

---

## Task 3: Metrics Collection

### 3.1 Coverage

| Module | Risk | Functional Coverage | Code Coverage (est.) | Status |
|---|---|---|---|---|
| User Authentication | HIGH | 100% | ~85% | ✅ Above threshold |
| Article Management | HIGH | 100% | ~80% | ✅ Above threshold |
| Global Feed & Pagination | HIGH | 100% | ~75% | ✅ Above threshold |
| Comments | MEDIUM | 100% (API) / 0% (UI) | ~60% | ⚠️ Below 70% — UI gap |
| User Profile | MEDIUM | 80% (API only) | ~40% | ⚠️ Below 70% — major UI gap |
| Favorites | LOW | 0% | ~0% | ℹ️ Manual only |

**Overall weighted coverage (risk-weighted):**
- HIGH modules: avg ~80% code coverage ✅
- MEDIUM modules: avg ~50% — below 70% threshold ⚠️

### 3.2 Defect Detection

| # | Defect | Module | Risk Level | Found In |
|---|---|---|---|---|
| D01 | Logout requires dropdown to be opened first | Authentication | HIGH | A2 Playwright |
| D02 | Error message timeout needs 10s (API latency) | Authentication | HIGH | A2 Playwright |
| D03 | Login button selector: must use `:has-text` | Authentication | HIGH | A2 Playwright |
| D04 | Multiple h1 on article page — must scope to `.article-page h1` | Article Management | HIGH | A2 Playwright |
| D05 | Delete button rendered twice — must use `.first()` | Article Management | HIGH | A2 Playwright |
| D06 | Edit link rendered twice — must use `.first()` | Article Management | HIGH | A2 Playwright |
| D07 | `window.confirm` dialog blocks Playwright delete — needs `page.on('dialog')` | Article Management | HIGH | A2 Playwright |
| D08 | Feed tabs are `<button>` not `<a>` — selector assumption wrong | Global Feed | HIGH | A2 Playwright |
| D09 | DELETE /api/articles returns 200 not 204 — need `oneOf` | Article Management | HIGH | A2 Newman |

**Total defects found across A1–A2: 9**
**Defects blocking CI: 0** (all resolved)
**New defects found in midterm phase: 0** (all new tests pass)

### 3.3 Efficiency

| Metric | A1 (Baseline) | A2 | Midterm (A3) |
|---|---|---|---|
| Total test cases | 4 smoke | 41 | 65 |
| UI tests | 4 | 28 (23 CI) | 33 (28 CI) |
| API tests | 0 | 18 req / 34 assertions | 26 req / 50 assertions |
| Unit tests | 0 | 0 | 13 |
| CI pipeline runtime | ~3 min | ~5 min | ~6 min |
| Test execution time (UI, Chromium) | ~2s | ~17s | ~22s |
| Test execution time (API, Newman) | — | ~2s | ~4s |
| Unit test execution time | — | — | <1s |

### 3.4 Stability

| Metric | Value |
|---|---|
| Flaky tests identified | 0 |
| Tests with deterministic root causes (fixed) | 5 |
| Tests with conditional skip | 1 (TC-FD-05, no seed data) |
| Flaky test rate | **0%** |

---

## Task 4: Comparative Analysis

### 4.1 Planned vs Actual

| Aspect | Planned (A1) | Actual (A2/A3) | Gap |
|---|---|---|---|
| HIGH-risk module coverage | 100% | 100% | No gap |
| MEDIUM-risk module coverage | ≥ 80% | 90% avg (API); ~50% with UI | Gap: UI tests for Comments and Profile not implemented |
| Automated UI test count | ≥ 20 runs | 33 tests | Exceeded target |
| Automated API test count | ≥ 15 requests | 26 requests | Exceeded target |
| Unit tests | Not planned | 13 implemented in midterm | Not in A1 scope — added as requirement |
| Defects predicted | 6–10 total | 9 found | Within range |
| CI pipeline runtime | ≤ 10 min | ~6 min | Met — 4 min buffer |
| Flaky tests | Anticipated possible | 0 observed | Better than expected |
| Slug mutation risk | Not predicted | Found — title change updates slug → old URL 404s | **Gap: incorrect assumption** |
| HTML structure assumptions | `<a>` for nav links | `<button>` for feed tabs | **Gap: selector assumptions failed** |
| `window.confirm` dialog | Not predicted | Blocks Playwright without explicit handler | **Gap: missing assumption** |

### 4.2 Required Insights

**Incorrect assumptions in planning:**
1. **Selector assumptions** — Assumed all navigation elements were `<a>` tags. Conduit uses `<button>` for feed tabs and tag pills. This caused 2 failures in feed tests.
2. **Dialog handling** — Did not anticipate that the delete confirmation would use a native browser `window.confirm()`. Custom modals (which Playwright handles with `.click()`) were assumed.
3. **Slug stability** — Assumed article slug was immutable after creation. The backend regenerates slug from title on every PUT. This is a real data-integrity risk, not just a test complexity.
4. **DELETE response code** — Assumed 204 per REST convention. The app returns 200 with empty body.

**Missing test scenarios (now added in midterm):**
- Empty form submission (TC-AUTH-FAIL-01, TC-AUTH-FAIL-02)
- Special character input in critical fields (TC-ART-EDGE-01, TC-UNIT-04)
- Unauthorized API access (TC-API-FAIL-01)
- Non-existent resource retrieval (TC-API-FAIL-02)
- Malformed authentication tokens (TC-API-INV-01)
- Rapid duplicate submissions (TC-CONC-01)
- Accessing protected routes without auth (TC-INV-01)

**Inefficient automation design (identified and improved):**
- In A2, the Postman collection was a single sequential chain. Any failure in the chain (e.g., login fails) causes all subsequent tests to fail with misleading errors. The edge-case collection uses a fresh login step at the top of the collection to avoid this cascade problem.
- The `TC-FD-05` test gracefully skips when no seed data is present, but this means a missing seed step in CI is **invisible** — the test passes by skipping. A more robust design would assert that at least one tag exists before testing the filter.

---

## Task 5: Discussion

### What Worked

**Automation pipeline** — The GitHub Actions pipeline was the most effective part of the strategy. Running all 65 tests automatically on every push caught all 9 defects early in development. The fail-fast quality gate (exit 1 on any failure) prevented regressions from reaching the main branch.

**Newman variable chaining** — Designing API tests as a stateful sequence (register → login → create → get → update → comment → delete) mirrors real user behavior and provides more realistic coverage than isolated unit-style API calls.

**Risk-based prioritisation** — Investing 100% automation effort in HIGH-risk modules before touching MEDIUM modules was correct. The 4 Article Management defects and 3 Authentication defects would have been missed without comprehensive automation.

**Unit tests for pure functions** — The `slugify` function tests (TC-UNIT-04) revealed that XSS-like inputs produce safe slugs — a positive security finding that manual testing would likely have missed.

### What Didn't Work

**Selector assumptions** — Two test categories (feed tabs, tag pills) required rework because HTML structure differed from assumptions. In future, inspecting the rendered DOM before writing selectors would prevent this.

**No UI coverage for Comments and Profile** — These were deprioritised due to their MEDIUM risk rating, but the resulting code coverage gap (~40–60%) is below the 70% threshold. Adding even basic UI tests for comment submission and profile view would close this gap.

**Concurrency tests are simulated, not truly parallel** — TC-CONC-01 (double-click) and TC-API-CONC-01 (two sequential login calls) simulate concurrency but do not fire truly simultaneous requests. True concurrency testing would require a load-testing tool (e.g., k6, Artillery).

### Unexpected Findings

1. **Zero flaky tests** — Initially expected some timing-related flakiness in CI (slower GitHub runners vs. local). The `waitForTimeout` and explicit `toBeVisible` checks with appropriate timeouts made all tests deterministic.

2. **React escapes XSS by default** — TC-ART-EDGE-01 confirmed that React's JSX rendering escapes `<script>` tags in article titles. No alert fired. This is a security positive — the framework's default behaviour provides injection protection without explicit sanitisation code.

3. **Slug mutation is a silent data-integrity risk** — Defect D05 (slug mutation) was discovered only because the test suite attempted to DELETE an article after updating its title. A user who bookmarks an article URL before editing the title will encounter a permanent 404 — this is a real UX defect that pure UI testing would not detect.

### Improvements for Next Phase

1. **Add UI tests for Comments and Profile** — Close the coverage gap below 70%.
2. **Instrument code coverage with c8/Istanbul** — Replace estimated percentages with measured line/branch coverage numbers.
3. **Add true concurrency test with k6** — Replace simulated double-click with genuine parallel HTTP requests to test the JWT issuance endpoint under load.
4. **Add pagination UI test** — Verify that clicking "page 2" loads the correct offset of articles (currently only API pagination is tested).
5. **Add Favorites automation** — LOW risk but 0% coverage; a single API test and one UI toggle test would bring it to baseline coverage.
6. **Test token expiry** — The most significant coverage gap in the Authentication module. JWTs expire; a test with a deliberately expired token would validate the 401 handling path.
