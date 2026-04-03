# Assignment 2 Report
## Project: Conduit RealWorld App — Automated Test Implementation & Quality Gates
**Date:** 2026-04-03
**Version:** 1.0 (Final)
**Team:** 3 members
**Repository:** https://github.com/n1tr0oo/qa-conduit

---

## 1. Scope of Automated Testing

### 1.1 Test Files Implemented

| File | Type | Tests | Browsers | Risk |
|------|------|-------|---------|------|
| `tests/ui/smoke.spec.js` | UI — Smoke | 4 | Chromium, Firefox | HIGH |
| `tests/ui/auth.spec.js` | UI — Auth | 6 | Chromium, Firefox | HIGH |
| `tests/ui/articles.spec.js` | UI — Articles | 5 | Chromium, Firefox | HIGH |
| `tests/ui/feed.spec.js` | UI — Feed | 8 | Chromium, Firefox | HIGH / MEDIUM |
| `tests/api/conduit.postman_collection.json` | API | 18 requests | — | HIGH / MEDIUM |

### 1.2 Coverage by Module

| Module | Risk | UI Tests | API Tests | Coverage |
|--------|------|---------|---------|---------|
| User Authentication | HIGH | 6 (login, register, logout, errors) | 5 requests | Full |
| Article Management | HIGH | 5 (create, view, edit, delete, redirect) | 6 requests | Full |
| Global Feed & Pagination | HIGH | 8 (feed, tags, tabs, navigation) | 3 requests | Full |
| Comments | MEDIUM | — | 3 requests | Full (API) |
| User Profile | MEDIUM | — | 1 request | Partial (API) |
| Favorites | LOW | — | — | Manual only |

---

## 2. Test Cases

### 2.1 UI Tests — Authentication (`auth.spec.js`)

| # | Test Name | Precondition | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| 1 | Login with valid credentials | User qa_test exists | Fill email/password, click Login | Redirected to home, username in nav |
| 2 | Login with wrong password shows error | User qa_test exists | Fill correct email, wrong password | `ul.error-messages` visible |
| 3 | Login with non-existent user shows error | — | Fill unknown email/password | `ul.error-messages` visible |
| 4 | Register form submits and redirects | — | Fill unique name/email/password, Sign up | Redirected to home, username in nav |
| 5 | Register with existing email shows error | User qa_test exists | Register with qa_test@example.com | `ul.error-messages` visible |
| 6 | Logout returns to home page | Logged in as qa_test | Open dropdown, click Logout | Home page, nav shows Login |

### 2.2 UI Tests — Article Management (`articles.spec.js`)

| # | Test Name | Precondition | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| 1 | Create new article | Logged in | Go to /editor, fill title/desc/body, Publish | Redirected to article page, h1 matches title |
| 2 | View article page shows content | Articles exist in DB | Click first preview link on home | URL `/#/article/...`, h1 and `.article-content` visible |
| 3 | Create and delete article | Logged in | Create article, click Delete Article, accept confirm | Redirected to home `/#/` |
| 4 | Edit existing article | Logged in | Create article, click Edit Article, change title, Update | h1 shows updated title |
| 5 | Article editor requires login | Not logged in | Navigate to `/#/editor` | Redirected away from editor |

### 2.3 UI Tests — Global Feed (`feed.spec.js`)

| # | Test Name | Precondition | Steps | Expected Result |
|---|-----------|-------------|-------|-----------------|
| 1 | Global feed shows feed toggle | — | Open home page | `.feed-toggle` visible |
| 2 | Global feed tab is active by default | — | Open home page | `button.active` contains "Global Feed" |
| 3 | Article previews visible | Articles in DB | Open home page | `.article-preview` visible |
| 4 | Sidebar with popular tags | — | Open home page | `.sidebar` visible |
| 5 | Tag filter changes active tab | Tags exist | Click first tag button | Active tab label matches tag name |
| 6 | Authenticated user sees Your Feed tab | Logged in | Open home page | Feed toggle contains "Your Feed" |
| 7 | Your Feed tab is clickable | Logged in | Click "Your Feed" | Tab becomes active, articles shown |
| 8 | Clicking article preview opens article | Articles exist | Click `a.preview-link` | URL `/#/article/...`, h1 visible |

### 2.4 API Tests — Summary (`conduit.postman_collection.json`)

| Group | Request | Method | Expected Status | Assertions |
|-------|---------|--------|-----------------|-----------|
| Authentication | Register new user | POST /api/users | 201 | 2 |
| Authentication | Login with valid credentials | POST /api/users/login | 200 | 2 |
| Authentication | Login with wrong password | POST /api/users/login | 422 | 2 |
| Authentication | Get current user (auth) | GET /api/user | 200 | 2 |
| Authentication | Get current user (no token) | GET /api/user | 401 | 2 |
| Articles | Get global feed | GET /api/articles | 200 | 2 |
| Articles | Get articles with limit/offset | GET /api/articles?limit=5&offset=0 | 200 | 2 |
| Articles | Create article | POST /api/articles | 201 | 3 |
| Articles | Get article by slug | GET /api/articles/{{slug}} | 200 | 2 |
| Articles | Update article | PUT /api/articles/{{slug}} | 200 | 2 |
| Comments | Add comment | POST /api/articles/{{slug}}/comments | 201 | 2 |
| Comments | Get comments | GET /api/articles/{{slug}}/comments | 200 | 1 |
| Comments | Delete comment | DELETE /api/articles/{{slug}}/comments/{{id}} | 200 or 204 | 1 |
| Articles | Delete article | DELETE /api/articles/{{slug}} | 200 or 204 | 1 |
| Feed & Tags | Get tags | GET /api/tags | 200 | 1 |
| Feed & Tags | Filter by tag | GET /api/articles?tag=qa | 200 | 2 |
| Feed & Tags | Get user feed | GET /api/articles/feed | 200 | 2 |
| Profiles | Get user profile | GET /api/profiles/qa_test | 200 | 3 |
| **Total** | **18 requests** | | | **34 assertions** |

---

## 3. Test Scripts

### 3.1 Key Playwright Patterns Used

**Login helper (shared across auth, articles, feed):**
```js
async function login(page) {
  await page.goto('/#/login');
  await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
  await page.locator('input[placeholder="Password"]').fill(TEST_USER.password);
  await page.locator('button:has-text("Login")').click();
  await expect(page.locator('nav')).toContainText(TEST_USER.username);
}
```

**Dialog handling for destructive actions:**
```js
page.on('dialog', (dialog) => dialog.accept());
await page.locator('button:has-text("Delete Article")').first().click();
```

**Strict mode fix (multiple h1 on page):**
```js
await expect(page.locator('.article-page h1')).toContainText(title);
```

**Newman variable chaining (token → slug → commentId):**
```js
// In test script after login:
pm.environment.set("token", pm.response.json().user.token);
// In test script after create article:
pm.environment.set("slug", pm.response.json().article.slug);
```

### 3.2 Selectors Reference (App-Specific)

| Element | Selector | Note |
|---------|---------|------|
| Login button | `button:has-text("Login")` | No `type="submit"` in DOM |
| Register button | `button:has-text("Sign up")` | No `type="submit"` in DOM |
| Error messages | `ul.error-messages` | Rendered by AuthPageContainer |
| Username in nav | `.nav-link.dropdown-toggle` | Inside dropdown |
| Logout | `.dropdown-item:has-text("Logout")` | Click dropdown first |
| Article title (view) | `.article-page h1` | Multiple h1 on page — need scoped selector |
| Delete button | `button:has-text("Delete Article").first()` | Rendered twice on article page |
| Edit link | `a.nav-link:has-text("Edit Article").first()` | Rendered twice on article page |
| Feed tabs | `button.nav-link` (not `<a>`) | FeedNavLink uses `<button>` |
| Tag buttons | `button.tag-pill` (not `<a>`) | TagButton uses `<button>` |

---

## 4. Version Control

| Commit | Description |
|--------|-------------|
| Initial | Smoke tests + Newman collection + CI pipeline (Assignment 1) |
| Pipeline green | Fixed DEV_DB_LOGGING TypeError, wait-on timeout |
| Auth tests | `tests/ui/auth.spec.js` — 6 login/register/logout tests |
| Articles tests | `tests/ui/articles.spec.js` — 5 CRUD UI tests |
| Feed tests | `tests/ui/feed.spec.js` — 8 feed/navigation tests |
| Selector fixes | Fixed button selectors, strict mode h1, dialog handling |
| Quality gates | JUnit reporters, threshold check step, dorny/test-reporter |

**Branch:** `main`
**Repository:** https://github.com/n1tr0oo/qa-conduit

---

## 5. Quality Gates

### 5.1 Gate Definitions

| Gate | Threshold | Tool | Enforcement |
|------|-----------|------|------------|
| UI test pass rate | **100%** | Playwright JUnit XML | Pipeline step exits 1 if `failures > 0` |
| API assertion pass rate | **100%** | Newman JUnit XML | Pipeline step exits 1 if `failures > 0` |
| Critical defects at deploy | **0** | Manual + automated | Zero-defect policy |
| HIGH-risk module coverage | **100%** | Coverage analysis | Manual review |
| MEDIUM-risk module coverage | **≥ 80%** | Coverage analysis | Manual review |
| Pipeline status | **Green** | GitHub Actions | Fail-fast on any step failure |

### 5.2 Gate Implementation (CI)

Quality gates are enforced in `.github/workflows/tests.yml`:

1. **Playwright** runs with `--reporter=html,list,junit` → writes `reports/junit/playwright-results.xml`
2. **Newman** runs with `--reporters cli,junit` → writes `reports/junit/newman-results.xml`
3. **"Quality Gate — verify thresholds"** step parses both XML files, checks `failures=0`, exits 1 if not met
4. **`dorny/test-reporter@v1`** displays per-test results in GitHub Actions UI
5. Both XML files uploaded as artifacts (7-day retention)

### 5.3 Justification of Thresholds

- **100% pass rate** — any regression in user-facing functionality is unacceptable; partial failures mask real defects
- **0 critical bugs** — Zero-Defect Policy standard for production deployments
- **80% MEDIUM coverage** — per ISO/IEC 25010 quality model for secondary features
- **Fail-fast** — broken build blocks the team immediately (Martin Fowler, *Continuous Integration*, 2006)

---

## 6. Execution Metrics

### 6.1 Local Results

| Suite | Tests / Assertions | Passed | Failed | Duration |
|-------|--------------------|--------|--------|---------|
| UI — Chromium | 23 tests | 23 | 0 | ~13s |
| UI — Firefox | 23 tests | 23 | 0 | ~44s |
| UI — Total (both browsers) | 46 runs | 46 | 0 | ~58s |
| API — Newman | 18 req / 34 assertions | 34 | 0 | ~2s |

### 6.2 Pass Rate

| Metric | Value |
|--------|-------|
| UI pass rate (local) | **46 / 46 = 100%** |
| API pass rate (local) | **34 / 34 = 100%** |
| Browsers covered (local) | 2 (Chromium, Firefox) |
| Browsers covered (CI) | 1 (Chromium) |

### 6.3 Test Distribution

| Category | Count | % of Total UI |
|----------|-------|--------------|
| Authentication | 6 tests | 26% |
| Article Management | 5 tests | 22% |
| Global Feed | 8 tests | 35% |
| Smoke | 4 tests | 17% |

---

## 7. Defects Found During Implementation

| # | Area | Issue | Root Cause | Fix |
|---|------|-------|-----------|-----|
| 1 | UI | `button[type="submit"]` not found on Login | Login/Register buttons have no `type` attribute in JSX | Changed to `button:has-text("Login")` / `button:has-text("Sign up")` |
| 2 | UI | Logout link not found | Username dropdown must be opened first | Added click on `.nav-link.dropdown-toggle` before `.dropdown-item:has-text("Logout")` |
| 3 | UI | `h1` strict mode violation on article page | Multiple h1 elements on page (logo + article titles in feed) | Scoped to `.article-page h1` |
| 4 | UI | Delete button resolves to 2 elements | `ArticleAuthorButtons` rendered twice (banner + article-actions) | Added `.first()` |
| 5 | UI | Edit link resolves to 2 elements | Same cause as above | Added `.first()` |
| 6 | UI | `window.confirm` blocks delete flow | Playwright dismisses dialogs by default | Added `page.on('dialog', d => d.accept())` |
| 7 | UI | Feed tabs are `<button>` not `<a>` | `FeedNavLink` renders `<button>`, not `<a>` | Changed selectors to `button.nav-link`, `button.tag-pill` |
| 8 | UI | Create article fails with duplicate title | Same title used across runs — slug collision | Added `Date.now()` to titles in all create/edit/delete tests |
| 9 | UI | Flaky: global feed tab on Firefox | Selector ran before React rendered the active state | Added `await expect(.feed-toggle).toBeVisible()` before active-tab check |

---

## 8. CI/CD Evidence

| Run | Trigger | Result | Notes |
|-----|---------|--------|-------|
| Assignment 1 — final | Push to main | Green | 4 smoke + 18 API |
| Assignment 2 — quality gates | Push to main | Green (expected) | 23 UI + 18 API + gate check |

**Pipeline:** `.github/workflows/tests.yml`
**Artifacts:** `playwright-report` (HTML), `junit-results` (XML) — 7-day retention
**Test summary:** visible in GitHub Actions → Checks → "Test Results" (dorny/test-reporter)

---

## 9. Tools & Versions

| Tool | Version | Purpose |
|------|---------|---------|
| Playwright | 1.59.1 | UI test automation |
| Newman | 6.2.2 | API test automation (CLI) |
| Node.js | 20.x | Runtime |
| GitHub Actions | — | CI/CD pipeline |
| PostgreSQL | 15 | Test database in CI |
| dorny/test-reporter | v1 | JUnit → GitHub Actions summary |
