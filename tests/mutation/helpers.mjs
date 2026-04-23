/**
 * Standalone ESM module — backend helper functions under mutation
 * Source: conduit-realworld-example-app/backend/helper/helpers.js
 *
 * Extracted as pure functions for Stryker mutation testing.
 * No Express/Sequelize dependencies — pure logic only.
 */

// ── slugify ───────────────────────────────────────────────────────────────────
// Used by: Article creation (title → URL slug), Profile routing
export function slugify(string) {
  return string.trim().toLowerCase().replace(/\W|_/g, '-');
}

// ── appendTagList ─────────────────────────────────────────────────────────────
// Used by: Article GET/LIST responses — attaches tagList to article payload
export function appendTagList(articleTags, article) {
  const tagList = articleTags.map((tag) => tag.name);
  if (!article) return tagList;
  article.dataValues = article.dataValues || {};
  article.dataValues.tagList = tagList;
}

// ── validateRequiredFields ────────────────────────────────────────────────────
// Mirrors the validation logic from users.js and articles.js controllers
export function validateRequiredFields(fields) {
  const missing = Object.entries(fields)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return missing;
}

// ── isValidEmail ──────────────────────────────────────────────────────────────
// Mirrors the implicit email validation in the User model / login flow
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── paginationParams ──────────────────────────────────────────────────────────
// Mirrors the limit/offset extraction used in articles controller
export function paginationParams(query) {
  const limit  = parseInt(query.limit,  10);
  const offset = parseInt(query.offset, 10);
  return {
    limit:  Number.isFinite(limit)  && limit  > 0 ? limit  : 20,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  };
}
