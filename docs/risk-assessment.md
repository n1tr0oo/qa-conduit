# Risk Assessment Document
## Project: Conduit RealWorld App
**Date:** 2026-04-03  
**Team:** 3 members  
**System:** React / Express.js / Sequelize / PostgreSQL  

---

## 1. System Description

Conduit is a blogging platform (Medium clone) with the following stack:
- **Frontend:** React (HashRouter, Vite)
- **Backend:** Express.js + Sequelize ORM
- **Database:** PostgreSQL
- **Auth:** JWT tokens

Core functionality: user registration/login, article CRUD, comments, user profiles, follow/unfollow, tags, global feed.

---

## 2. Module Risk Analysis

| # | Module | Components | Probability of Failure | Impact if Fails | Risk Level |
|---|--------|------------|----------------------|-----------------|------------|
| 1 | User Authentication | Register, Login, JWT token validation | Medium | Critical — all protected endpoints inaccessible without token | **HIGH** |
| 2 | Article Management | Create, Edit, Delete, View article | Medium | High — core business function of the platform | **HIGH** |
| 3 | Global Feed & Pagination | Feed list, Tag filter, Pagination | Medium | High — main entry point for all users | **HIGH** |
| 4 | User Profile | View profile, Edit settings, Follow/Unfollow | Low | Medium — affects personalization but not core flow | **MEDIUM** |
| 5 | Comments | Add comment, Delete comment | Low | Medium — secondary feature, does not block main flow | **MEDIUM** |
| 6 | Favorites | Like/Unlike article | Low | Low — non-critical, isolated feature | **LOW** |

---

## 3. Risk Matrix

```
         │  LOW Impact  │ MEDIUM Impact │ HIGH Impact │ CRITICAL Impact
─────────┼──────────────┼───────────────┼─────────────┼────────────────
HIGH     │              │               │             │ Authentication
Prob.    │              │               │             │ Article Mgmt
         │              │               │             │ Feed
─────────┼──────────────┼───────────────┼─────────────┼────────────────
MEDIUM   │              │               │             │
Prob.    │              │               │             │
─────────┼──────────────┼───────────────┼─────────────┼────────────────
LOW      │  Favorites   │ Comments      │             │
Prob.    │              │ User Profile  │             │
```

---

## 4. Risk Prioritization

### HIGH Risk — Test First, Automate Fully
- **User Authentication** — JWT is required for all protected API endpoints. If login/register fails, the entire application is blocked for authenticated users.
- **Article Management** — Creating, editing, and deleting articles is the primary business function. Any failure here directly impacts all users.
- **Global Feed & Pagination** — The main page is the first thing users see. Broken feed or pagination means the app is unusable as a reading platform.

### MEDIUM Risk — Test After HIGH
- **User Profile / Settings** — Failure here limits personalization but does not break core reading/writing flows.
- **Comments** — Secondary interaction feature. Failure is visible but does not prevent article creation or reading.

### LOW Risk — Manual Testing Sufficient
- **Favorites** — Isolated toggle feature with no downstream dependencies.

---

## 5. Assumptions

1. JWT authentication is the single most critical component — expiry, invalid tokens, and missing auth headers must all be validated.
2. Article CRUD operations are the core business process; all test automation priority is assigned here.
3. Feed rendering with pagination is treated as high-risk because it is the landing page for all unauthenticated and authenticated users.
4. Performance testing and security penetration testing are out of scope for Assignment 1.
5. Mobile/responsive testing is out of scope.
