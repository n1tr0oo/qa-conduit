/**
 * Unit Tests — slugify helper function
 * TC-UNIT-01 / TC-UNIT-02 / TC-UNIT-03 / TC-UNIT-04 / TC-UNIT-05
 *
 * Tests the pure slugify() logic in isolation (no DB, no HTTP).
 * Function source: conduit-realworld-example-app/backend/helper/helpers.js
 * Inlined here so the QA suite runs without depending on the app repo.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Pure function under test ──────────────────────────────────────────────────
function slugify(string) {
  return string.trim().toLowerCase().replace(/\W|_/g, '-');
}

// ── TC-UNIT-01: Standard happy-path cases (regression from A2 baseline) ───────
describe('TC-UNIT-01 — slugify standard inputs', () => {
  const cases = [
    ['Hello World',   'hello-world'],
    ['  Hello World  ', 'hello-world'],
    ['Hello_world',   'hello-world'],
    ['Hello-world',   'hello-world'],
  ];

  for (const [input, expected] of cases) {
    test(`slugify(${JSON.stringify(input)}) === "${expected}"`, () => {
      assert.equal(slugify(input), expected);
    });
  }
});

// ── TC-UNIT-02: Edge case — empty and whitespace-only strings ─────────────────
describe('TC-UNIT-02 — slugify edge: empty / whitespace inputs', () => {
  test('empty string returns empty string', () => {
    assert.equal(slugify(''), '');
  });

  test('whitespace-only string returns empty string after trim', () => {
    // "   ".trim() → "" → no chars → ""
    assert.equal(slugify('   '), '');
  });
});

// ── TC-UNIT-03: Edge case — numeric and alphanumeric inputs ───────────────────
describe('TC-UNIT-03 — slugify edge: numbers', () => {
  test('digits are preserved unchanged', () => {
    assert.equal(slugify('article 42'), 'article-42');
  });

  test('leading digits are preserved', () => {
    assert.equal(slugify('123 test'), '123-test');
  });

  test('mixed alphanumeric string', () => {
    assert.equal(slugify('Hello World 2026'), 'hello-world-2026');
  });
});

// ── TC-UNIT-04: Edge case — special characters and injection-like inputs ───────
describe('TC-UNIT-04 — slugify edge: special characters', () => {
  test('ampersand is replaced with dash', () => {
    // "bread & butter" → each non-word char (space, &, space) → dash individually
    // result: "bread---butter" (3 dashes for " & ")
    assert.equal(slugify('bread & butter'), 'bread---butter');
  });

  test('XSS-like input is sanitised to dashes (no angle brackets in slug)', () => {
    const result = slugify('<script>alert(1)</script>');
    assert.ok(!result.includes('<'), 'slug must not contain <');
    assert.ok(!result.includes('>'), 'slug must not contain >');
  });

  test('SQL-injection-like input is sanitised', () => {
    const result = slugify("'; DROP TABLE articles; --");
    assert.ok(!result.includes("'"), 'slug must not contain single quote');
    assert.ok(!result.includes(';'), 'slug must not contain semicolon');
  });

  test('emoji characters are replaced with dashes', () => {
    const result = slugify('hello 🌍 world');
    assert.ok(!result.includes('🌍'), 'slug must not contain emoji');
  });
});

// ── TC-UNIT-05: Edge case — multiple consecutive special characters ────────────
describe('TC-UNIT-05 — slugify edge: consecutive delimiters', () => {
  test('double space becomes double dash', () => {
    // trim does not collapse internal spaces — each space → dash
    assert.equal(slugify('hello  world'), 'hello--world');
  });

  test('tab character is replaced with dash', () => {
    assert.equal(slugify('hello\tworld'), 'hello-world');
  });

  test('newline character is replaced with dash', () => {
    assert.equal(slugify('hello\nworld'), 'hello-world');
  });
});
