# QA Conduit — Test Repository

## System Under Test
**Conduit RealWorld App** — a blogging platform built with React / Express.js / Sequelize / PostgreSQL.
- Repository: https://github.com/TonyMckes/conduit-realworld-example-app
- Local Frontend: http://localhost:3000
- Local Backend: http://localhost:3001

## Team
| Role | Responsibility |
|------|---------------|
| Participant 1 | Risk Assessment, QA Test Strategy Document |
| Participant 2 | QA Environment Setup, CI/CD, Automation |
| Participant 3 | Research Paper (Introduction + Methodology) |

## Repository Structure
qa-conduit/
├── tests/
│   ├── ui/          # Playwright UI tests
│   └── api/         # Postman collections
├── reports/         # Test execution reports
├── docs/            # Risk assessment, test strategy
├── evidence/        # Screenshots, logs
├── .github/
│   └── workflows/
│       └── tests.yml  # CI/CD pipeline
└── README.md
## Modules & Risk Levels
| Module | Risk Level |
|--------|-----------|
| User Authentication | HIGH |
| Article Management | HIGH |
| Global Feed & Pagination | HIGH |
| User Profile | MEDIUM |
| Comments | MEDIUM |
| Favorites | LOW |

## Tools
| Tool | Purpose |
|------|---------|
| Playwright | UI test automation |
| Postman + Newman | API test automation |
| GitHub Actions | CI/CD pipeline |

## How to Run Tests

### Install dependencies
```bash
npm install
npx playwright install
```

### Run UI tests
```bash
npx playwright test
```

### Run API tests
```bash
newman run tests/api/conduit.postman_collection.json
```