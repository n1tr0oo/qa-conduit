# QA Test Strategy Document
## Project: Conduit RealWorld App
**Date:** 2026-04-03  
**Version:** 1.0 (Final)  
**Team:** 3 members  
**System:** React / Express.js / Sequelize / PostgreSQL  

---

## 1. Project Scope & Objectives

### In Scope

| Area | Details |
|------|---------|
| Frontend (UI) | All user-facing pages: Home, Login, Register, Article, Profile, Settings, Editor |
| Backend (API) | REST API endpoints: /api/users, /api/user, /api/articles, /api/profiles, /api/tags, /api/articles/:slug/comments |
| Authentication flow | Register, Login, JWT token handling, unauthorized access rejection |
| Core user flows | Create/Edit/Delete article, Add/Delete comment, Follow user, Like article, Paginated feed |

### Out of Scope

- Performance / load testing
- Security penetration testing
- Mobile / responsive UI testing
- Database migration testing
- Third-party service integrations
- Favorites feature (LOW risk — manual check only)

### Objectives

1. Identify defects in HIGH-risk modules before deployment
2. Ensure all critical user flows work end-to-end via automated tests
3. Establish automated regression suite runnable locally and in CI/CD

---

## 2. Risk-Based Testing Priority

| Module | Risk Level | Testing Priority | Automation |
|--------|------------|-----------------|-----------|
| User Authentication | HIGH | 1st | Full — UI + API |
| Article Management | HIGH | 1st | Full — UI + API |
| Global Feed & Pagination | HIGH | 1st | Full — UI + API |
| User Profile / Settings | MEDIUM | 2nd | Partial — API |
| Comments | MEDIUM | 2nd | Full — API |
| Favorites | LOW | 3rd | Manual only |

*Full risk analysis: [risk-assessment.md](./risk-assessment.md)*

---

## 3. Test Approach

### 3.1 Manual Testing

| Type | What it covers | When |
|------|---------------|------|
| Smoke testing | App starts, main pages load, no console errors | Before every automated test run |
| Exploratory testing | Edge cases, unexpected user behavior, UI bugs | Ongoing |

### 3.2 Automated Testing

| Type | Tool | Version | Covers |
|------|------|---------|--------|
| UI Automation | Playwright | 1.59.1 | Smoke tests: homepage, navbar, login page, register page |
| API Automation | Newman (Postman CLI) | 6.2.2 | Authentication, Article CRUD, Feed, Tags, Profiles, Comments |

### 3.3 Test Execution Order

All tests follow a dependency-aware sequence:

**API tests (Newman):**
1. Register new user → captures JWT token
2. Login with valid credentials → refreshes token
3. Login with wrong password → validates 422 error
4. Get current user (authenticated) → validates token works
5. Get current user (no token) → validates 401
6. Get global feed, limit/offset → validates articles endpoint
7. Create article → captures `articleSlug`
8. Get article by slug → validates created article
9. Update article → captures updated slug (title change updates slug)
10. Add comment → captures `commentId`
11. Get comments for article
12. Delete comment
13. Delete article
14. Get tags
15. Filter articles by tag
16. Get user feed (authenticated)
17. Get user profile

**UI tests (Playwright):**
1. Homepage loads (title matches /conduit/i)
2. Navigation bar is visible
3. Login page loads (form fields visible)
4. Register page loads (form fields visible)

### 3.4 Test Environment Requirements

| Component | Value |
|-----------|-------|
| Frontend URL | http://localhost:3000 |
| Backend URL | http://localhost:3001/api |
| Router type | HashRouter — routes use `/#/path` format |
| Test user | qa_test@example.com / password123 |
| Node.js | v20 |

---

## 4. Tool Selection & Justification

| Tool | Purpose | Justification |
|------|---------|--------------|
| Playwright | UI test automation | Cross-browser support (Chromium, Firefox), built-in waiting, HTML reporter, CI-ready |
| Newman | API test automation CLI | Runs Postman collections from CLI, JSON output, CI/CD integration, detailed per-request reporting |
| Postman | API collection authoring | Visual editor for building request sequences with test scripts and variable chaining |
| GitHub Actions | CI/CD pipeline | Free tier, native GitHub integration, matrix support, artifact uploads |
| PostgreSQL 15 | Test database in CI | Service container in GitHub Actions — ephemeral, isolated per run |

---

## 5. Test Coverage

### UI Tests (Playwright) — Implemented

| Test | File | Browsers | Risk |
|------|------|---------|------|
| Homepage loads | smoke.spec.js | Chromium, Firefox | HIGH |
| Navigation bar visible | smoke.spec.js | Chromium, Firefox | HIGH |
| Login page loads | smoke.spec.js | Chromium, Firefox | HIGH |
| Register page loads | smoke.spec.js | Chromium, Firefox | HIGH |

### API Tests (Newman/Postman) — Implemented

| Group | Tests | Assertions | Risk |
|-------|-------|-----------|------|
| Authentication | 5 requests | 10 assertions | HIGH |
| Articles (CRUD) | 6 requests | 13 assertions | HIGH |
| Feed & Tags | 3 requests | 6 assertions | HIGH |
| Comments | 3 requests | 5 assertions | MEDIUM |
| Profiles | 1 request | 3 assertions | MEDIUM |
| **Total** | **18 requests** | **34 assertions** | |

---

## 6. CI/CD Pipeline

The pipeline runs automatically on every push and pull request to `main`.

**Execution steps:**
1. Start PostgreSQL 15 service container
2. Checkout QA repository
3. Clone Conduit application from GitHub
4. Install all dependencies
5. Start backend (Express.js on port 3001) — DB tables auto-created via `sequelize.sync()`
6. Start frontend dev server (Vite on port 3000)
7. Wait for both services to respond
8. Create test user via API
9. Run Playwright UI tests (Chromium)
10. Run Newman API tests
11. Upload HTML test report as artifact

**Pipeline file:** `.github/workflows/tests.yml`  
**Repository:** https://github.com/n1tr0oo/qa-conduit

---

## 7. Achieved Metrics (Assignment 1)

| Metric | Target | Achieved |
|--------|--------|---------|
| HIGH-risk module coverage | 100% | 100% |
| MEDIUM-risk module coverage | 80% | 100% |
| LOW-risk module coverage | 50% | 0% (manual only) |
| Automated UI tests | ≥ 20 test cases | 4 tests × 2 browsers = 8 runs |
| Automated API tests | ≥ 15 test cases | 18 requests, 34 assertions |
| CI/CD pipeline | Configured | Green — passes on every push |
| Browsers covered (local) | 2 | 2 (Chromium, Firefox) |
| Smoke test pass rate | 100% | 8/8 (100%) |
| API test pass rate | 100% | 34/34 (100%) |
