# QA Test Strategy Document
## Project: Conduit RealWorld App
**Date:** 2026-04-03  
**Team:** 3 members  
**System:** React / Express.js / Sequelize / PostgreSQL  

---

## 1. Project Scope & Objectives

### In Scope
| Area | Details |
|------|---------|
| Frontend (UI) | All user-facing pages: Home, Login, Register, Article, Profile, Settings, Editor |
| Backend (API) | REST API endpoints: /api/users, /api/articles, /api/profiles, /api/tags, /api/comments |
| Authentication flow | Register, Login, JWT token handling |
| Core user flows | Create/Edit/Delete article, Add/Delete comment, Follow/Unfollow user, Like article |

### Out of Scope
- Performance / load testing
- Security penetration testing
- Mobile / responsive UI testing
- Database migration testing
- Third-party service integrations

### Objectives
1. Identify defects in HIGH-risk modules before deployment
2. Ensure all critical user flows work end-to-end
3. Establish automated regression suite for future assignments

---

## 2. Risk Assessment Results

| Module | Risk Level | Testing Priority |
|--------|------------|-----------------|
| User Authentication | HIGH | 1st |
| Article Management | HIGH | 1st |
| Global Feed & Pagination | HIGH | 1st |
| User Profile / Settings | MEDIUM | 2nd |
| Comments | MEDIUM | 2nd |
| Favorites | LOW | 3rd |

*Full risk analysis in [risk-assessment.md](./risk-assessment.md)*

---

## 3. Test Approach

### 3.1 Manual Testing

| Type | What it covers | When |
|------|---------------|------|
| Smoke testing | App starts, main pages load, no console errors | Before every test run |
| Exploratory testing | Edge cases, unexpected user behavior, UI bugs | Ongoing during development |

### 3.2 Automated Testing

| Type | Tool | Covers | Priority |
|------|------|--------|----------|
| UI Automation | Playwright | Login, Register, Article CRUD, Feed, Profile | HIGH risk first |
| API Automation | Postman + Newman | /api/users, /api/articles, /api/comments, /api/profiles | HIGH risk first |

### 3.3 Test Execution Order
1. Smoke tests (verify app is running)
2. Authentication tests (login, register, JWT)
3. Article management tests (CRUD)
4. Feed & pagination tests
5. Profile & comments tests
6. Favorites tests

---

## 4. Tool Selection & Configuration

| Tool | Purpose | Justification |
|------|---------|--------------|
| Playwright | UI test automation | Cross-browser support (Chromium, Firefox, WebKit), fast execution, built-in reporting |
| Postman + Newman | API test automation | Visual collection editor, CLI runner for CI/CD integration |
| GitHub Actions | CI/CD pipeline | Free, native GitHub integration, runs on every push/PR |
| GitHub | Test repository | Version control, history, collaboration |

### Repository Structure
```
qa-conduit/
├── tests/
│   ├── ui/          # Playwright tests
│   └── api/         # Postman collections
├── reports/         # HTML test reports
├── docs/            # This document + risk assessment
├── evidence/        # Screenshots, logs
└── .github/
    └── workflows/
        └── tests.yml
```

---

## 5. Planned Test Coverage

### UI Tests (Playwright)
| Test Suite | Module | Risk |
|------------|--------|------|
| smoke.spec.js | All pages load | HIGH |
| auth.spec.js | Register, Login, Logout | HIGH |
| article.spec.js | Create, Edit, Delete, View | HIGH |
| feed.spec.js | Global feed, Tag filter, Pagination | HIGH |
| profile.spec.js | View profile, Edit settings, Follow | MEDIUM |
| comments.spec.js | Add, Delete comment | MEDIUM |

### API Tests (Postman)
| Collection | Endpoints | Risk |
|------------|-----------|------|
| Auth | POST /api/users, POST /api/users/login | HIGH |
| Articles | GET/POST/PUT/DELETE /api/articles | HIGH |
| Feed | GET /api/articles/feed, GET /api/tags | HIGH |
| Profiles | GET/POST/DELETE /api/profiles/:username/follow | MEDIUM |
| Comments | GET/POST/DELETE /api/articles/:slug/comments | MEDIUM |

---

## 6. Planned Metrics

| Metric | Target |
|--------|--------|
| HIGH-risk module coverage | 100% |
| MEDIUM-risk module coverage | 80% |
| LOW-risk module coverage | 50% |
| Automated UI tests | ≥ 20 test cases |
| Automated API tests | ≥ 15 test cases |
| Estimated effort — UI tests | ~6 hours |
| Estimated effort — API tests | ~4 hours |
| Estimated effort — documentation | ~4 hours |

---

## 7. Baseline Metrics (Assignment 1)

| Metric | Value |
|--------|-------|
| Total modules identified | 6 |
| HIGH-risk modules | 3 (Authentication, Articles, Feed) |
| MEDIUM-risk modules | 2 (Profile, Comments) |
| LOW-risk modules | 1 (Favorites) |
| Smoke tests implemented | 4 test cases |
| Browsers covered | 2 (Chromium, Firefox) |
| Smoke test pass rate | 8/8 (100%) |
| CI/CD pipeline | Configured (GitHub Actions) |
