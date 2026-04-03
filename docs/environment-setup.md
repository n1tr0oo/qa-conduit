# QA Environment Setup Report
## Project: Conduit RealWorld App
**Date:** 2026-04-03  
**Version:** 1.0 (Final)  
**Team:** 3 members  

---

## 1. System Under Test

| Property | Value |
|----------|-------|
| Application | Conduit RealWorld App (Medium clone) |
| Source repository | https://github.com/TonyMckes/conduit-realworld-example-app |
| Frontend | React 19, HashRouter, Vite 7 — port **3000** |
| Backend | Express.js 5, Sequelize ORM 6 — port **3001** |
| Database | PostgreSQL 15 |
| Authentication | JWT (`JWT_KEY` environment variable) |

---

## 2. Local Development Environment

### 2.1 Prerequisites Installed

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v20.x | JavaScript runtime |
| npm | v10.x | Package manager, workspace support |
| PostgreSQL | 15 | Local test database |
| Git | 2.x | Version control |

### 2.2 Application Startup

```bash
# From conduit-realworld-example-app/
npm install
npm run dev        # starts backend (3001) + frontend (3000) concurrently
```

**Environment variables required (backend `.env`):**

```
NODE_ENV=development
PORT=3001
JWT_KEY=<your_secret>
DEV_DB_USERNAME=<db_user>
DEV_DB_PASSWORD=<db_password>
DEV_DB_NAME=<db_name>
DEV_DB_HOSTNAME=localhost
DEV_DB_DIALECT=postgres
```

### 2.3 Test User Setup

The test suite requires a pre-existing user for login tests:

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"user":{"username":"qa_test","email":"qa_test@example.com","password":"password123"}}'
```

---

## 3. QA Test Repository

### 3.1 Repository

| Property | Value |
|----------|-------|
| URL | https://github.com/n1tr0oo/qa-conduit |
| Branch | main |
| License | ISC |

### 3.2 Directory Structure

```
qa-conduit/
├── .github/
│   └── workflows/
│       └── tests.yml          # GitHub Actions CI/CD pipeline
├── tests/
│   ├── ui/
│   │   └── smoke.spec.js      # Playwright smoke tests (4 tests)
│   └── api/
│       └── conduit.postman_collection.json   # Newman API collection (18 req / 34 assertions)
├── reports/
│   └── html/                  # Playwright HTML report (git-ignored)
├── docs/
│   ├── risk-assessment.md     # Module risk analysis
│   ├── test-strategy.md       # Test approach, coverage, metrics
│   └── environment-setup.md  # This document
├── .gitignore
├── package.json               # devDependencies: playwright, newman
└── playwright.config.js       # Playwright configuration
```

### 3.3 Key Configuration Files

**`package.json`**
```json
{
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:report": "playwright show-report reports/html"
  },
  "devDependencies": {
    "@playwright/test": "^1.59.1",
    "newman": "^6.2.2"
  }
}
```

**`playwright.config.js`**
```js
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  timeout: 30000,
  retries: 1,
  reporter: [['html', { outputFolder: 'reports/html' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
```

---

## 4. Tool Installation

### 4.1 Playwright

```bash
cd qa-conduit
npm install
npx playwright install chromium firefox
```

**Run UI tests locally:**
```bash
npx playwright test                    # all browsers
npx playwright test --project=chromium # chromium only
npx playwright show-report reports/html
```

### 4.2 Newman

Newman is included in devDependencies. Run API tests:

```bash
npx newman run tests/api/conduit.postman_collection.json
```

Newman outputs a detailed per-request report including status codes, test assertions, and timing.

---

## 5. CI/CD Pipeline

### 5.1 Overview

The pipeline is defined in `.github/workflows/tests.yml` and triggers on every push and pull request to `main`.

### 5.2 Pipeline Steps

| Step | Description |
|------|-------------|
| PostgreSQL service | Spins up postgres:15 container on port 5432 |
| Checkout QA repo | Checks out n1tr0oo/qa-conduit |
| Setup Node.js 20 | Installs Node.js v20 on runner |
| Clone Conduit app | Clones the application under test |
| Install app dependencies | `npm install` in conduit-app/ |
| Start backend | `node index.js` — Express on port 3001, DB tables auto-created via `sequelize.sync()` |
| Start frontend | `npm run dev -w frontend` — Vite dev server on port 3000 |
| Wait for services | `wait-on` polls both ports (timeout: 120s) |
| Create test user | `curl` POST to create qa_test@example.com |
| Install QA deps | `npm install` in qa-conduit/ |
| Install Playwright | `npx playwright install --with-deps chromium` |
| Run Playwright tests | `npx playwright test --project=chromium` |
| Run Newman tests | `npx newman run tests/api/...` |
| Upload artifact | Playwright HTML report uploaded, retained 7 days |

### 5.3 Pipeline Status

| Run | Commit | Result | Duration |
|-----|--------|--------|---------|
| #1 | Initial setup | ✅ Pass | ~57s |
| #2 | Postman collection | ✅ Pass | ~52s |
| #3–#5 | Pipeline fixes | iterative | — |
| Final | Full stack in CI | ✅ Pass | ~3–4 min |

### 5.4 Screenshots

*GitHub Actions — runs list (all passing):*  
See `evidence/` folder or GitHub Actions tab at https://github.com/n1tr0oo/qa-conduit/actions

---

## 6. Known Constraints

| Constraint | Description |
|-----------|-------------|
| HashRouter | React app uses `/#/route` URL format — Playwright `goto` calls must use `/#/login`, not `/login` |
| Slug update | `PUT /api/articles/:slug` with title change generates a new slug — test suite re-captures slug after update |
| DELETE response | This Conduit implementation returns HTTP 200 (not 204) for DELETE operations |
| `DEV_DB_LOGGING` | Sequelize `logging` option must be a function or `false` (boolean); string `"false"` causes TypeError |
| CI browsers | Only Chromium runs in CI to reduce pipeline time; full Chromium+Firefox runs locally |
