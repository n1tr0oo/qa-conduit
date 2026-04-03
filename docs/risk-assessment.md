# Risk Assessment Document
## Project: Conduit RealWorld App
**Date:** 2026-04-03  
**Version:** 1.0 (Final)  
**Team:** 3 members  
**System:** React / Express.js / Sequelize / PostgreSQL  

---

## 1. System Description

Conduit is a blogging platform (Medium clone) with the following stack:

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router (HashRouter), Vite 7 |
| Backend | Express.js 5, Sequelize ORM 6 |
| Database | PostgreSQL 15 |
| Authentication | JWT tokens (jsonwebtoken) |
| Build/Dev | Node.js 20, npm workspaces |

Core functionality: user registration/login, article CRUD, comments, user profiles, follow/unfollow, tag-based filtering, global feed with pagination.

---

## 2. Module Risk Analysis

| # | Module | Components | Probability of Failure | Impact if Fails | Risk Level |
|---|--------|------------|----------------------|-----------------|------------|
| 1 | User Authentication | Register, Login, JWT token validation, protected route access | Medium | **Critical** — all protected endpoints inaccessible without valid token; entire authenticated user flow blocked | **HIGH** |
| 2 | Article Management | Create, Edit, Delete, View article; slug generation | Medium | **High** — core business function of the platform; all CRUD operations affected | **HIGH** |
| 3 | Global Feed & Pagination | Feed list, tag filter, limit/offset pagination | Medium | **High** — main entry point for all users; broken feed means app is unusable as reading platform | **HIGH** |
| 4 | User Profile / Settings | View profile, edit bio/avatar, follow/unfollow user | Low | **Medium** — affects personalization but does not block core reading/writing flows | **MEDIUM** |
| 5 | Comments | Add comment, delete comment, list comments per article | Low | **Medium** — secondary interaction feature; failure is visible but does not prevent article creation or reading | **MEDIUM** |
| 6 | Favorites | Like/unlike article, favorited count | Low | **Low** — isolated toggle feature with no downstream dependencies on other modules | **LOW** |

---

## 3. Risk Matrix

```
              │  LOW Impact  │ MEDIUM Impact │ HIGH Impact │ CRITICAL Impact
──────────────┼──────────────┼───────────────┼─────────────┼────────────────
HIGH Prob.    │              │               │             │ Authentication
              │              │               │             │ Article Mgmt
              │              │               │             │ Feed & Pagination
──────────────┼──────────────┼───────────────┼─────────────┼────────────────
MEDIUM Prob.  │              │               │             │
              │              │               │             │
──────────────┼──────────────┼───────────────┼─────────────┼────────────────
LOW Prob.     │  Favorites   │ Comments      │             │
              │              │ User Profile  │             │
```

---

## 4. Risk Prioritization

### HIGH Risk — Test First, Automate Fully

**User Authentication**  
JWT is the single security boundary of the application. Without a valid token, all write endpoints (POST/PUT/DELETE) and personalized endpoints return 401. Both registration (new token) and login (existing user token) must work correctly. Token expiry and missing-auth-header scenarios must be validated.

**Article Management**  
Creating, editing, and deleting articles is the primary business process. Slug generation (derived from title) affects routing — if the slug changes unexpectedly on update, subsequent GET/PUT/DELETE requests will 404. The entire article lifecycle must be tested as a sequential flow.

**Global Feed & Pagination**  
The home page renders the global article feed with limit/offset pagination and tag filtering. This is the first screen for all unauthenticated visitors and the default view for authenticated users. A broken feed or incorrect pagination makes the app functionally unusable.

### MEDIUM Risk — Test After HIGH

**User Profile / Settings**  
Failure limits personalization (bio, avatar, username changes) and the social graph (follow/unfollow). Does not block core article creation or reading flows.

**Comments**  
Secondary interaction feature. Comment creation and deletion are straightforward write operations. Failure is visible to users but does not affect the article flow.

### LOW Risk — Manual Testing Sufficient

**Favorites**  
Isolated toggle with a counter. No other feature depends on the favorites state. Manual spot-check is sufficient for this assignment.

---

## 5. Assumptions

1. JWT authentication (`JWT_KEY` env var) is the single most critical configuration — expiry, invalid tokens, and missing auth headers must all be validated in API tests.
2. Slug generation from article title is a derived field — any update to `title` changes the slug, which must be re-captured for subsequent test steps.
3. Feed rendering with pagination is treated as high-risk because it is the landing page for all unauthenticated and authenticated users.
4. Performance testing, security penetration testing, mobile/responsive testing, and database migration testing are out of scope.
5. The application runs locally with frontend on port 3000 and backend API on port 3001.
