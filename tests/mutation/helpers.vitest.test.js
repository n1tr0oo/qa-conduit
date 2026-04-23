/**
 * Vitest test suite for Stryker mutation testing
 * Targets: slugify, appendTagList, validateRequiredFields, isValidEmail, paginationParams
 *
 * Runs via: npx vitest run --config vitest.mutation.config.js
 * Or via Stryker: npx stryker run
 */

import { describe, test, expect } from 'vitest';
import {
  slugify,
  appendTagList,
  validateRequiredFields,
  isValidEmail,
  paginationParams,
} from './helpers.mjs';

// ── slugify ───────────────────────────────────────────────────────────────────
describe('slugify — standard inputs', () => {
  test.each([
    ['Hello World',     'hello-world'],
    ['  Hello World  ', 'hello-world'],
    ['Hello_world',     'hello-world'],
    ['Hello-world',     'hello-world'],
    ['UPPER CASE',      'upper-case'],
  ])('slugify(%s) === %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('slugify — edge cases', () => {
  test('empty string returns empty string', () => {
    expect(slugify('')).toBe('');
  });

  test('whitespace-only returns empty string', () => {
    expect(slugify('   ')).toBe('');
  });

  test('numbers are preserved', () => {
    expect(slugify('article 42')).toBe('article-42');
    expect(slugify('123 test')).toBe('123-test');
  });

  test('special chars replaced with dashes', () => {
    expect(slugify('bread & butter')).toBe('bread---butter');
  });

  test('XSS input is sanitised', () => {
    const result = slugify('<script>alert(1)</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  test('SQL injection input is sanitised', () => {
    const result = slugify("'; DROP TABLE articles; --");
    expect(result).not.toContain("'");
    expect(result).not.toContain(';');
  });

  test('tab is replaced with dash', () => {
    expect(slugify('hello\tworld')).toBe('hello-world');
  });

  test('newline is replaced with dash', () => {
    expect(slugify('hello\nworld')).toBe('hello-world');
  });

  test('double space becomes double dash', () => {
    expect(slugify('hello  world')).toBe('hello--world');
  });

  test('result is always lowercase', () => {
    const result = slugify('HELLO WORLD');
    expect(result).toBe(result.toLowerCase());
  });

  test('result has no leading/trailing dashes from whitespace', () => {
    const result = slugify('  hello  ');
    expect(result).toBe('hello');
  });
});

// ── appendTagList ─────────────────────────────────────────────────────────────
describe('appendTagList — returns tagList when no article', () => {
  test('returns array of tag names', () => {
    const tags = [{ name: 'react' }, { name: 'testing' }];
    expect(appendTagList(tags, null)).toEqual(['react', 'testing']);
  });

  test('returns empty array for empty tags', () => {
    expect(appendTagList([], null)).toEqual([]);
  });
});

describe('appendTagList — mutates article.dataValues', () => {
  test('sets tagList on article.dataValues', () => {
    const article = { dataValues: {} };
    const tags    = [{ name: 'node' }, { name: 'js' }];
    appendTagList(tags, article);
    expect(article.dataValues.tagList).toEqual(['node', 'js']);
  });

  test('does not return anything when article is provided', () => {
    const article = { dataValues: {} };
    const result  = appendTagList([{ name: 'x' }], article);
    expect(result).toBeUndefined();
  });

  test('overwrites existing tagList', () => {
    const article = { dataValues: { tagList: ['old'] } };
    appendTagList([{ name: 'new' }], article);
    expect(article.dataValues.tagList).toEqual(['new']);
  });
});

// ── validateRequiredFields ────────────────────────────────────────────────────
describe('validateRequiredFields', () => {
  test('returns empty array when all fields present', () => {
    expect(validateRequiredFields({ username: 'alice', email: 'a@b.com', password: 'pass' }))
      .toEqual([]);
  });

  test('returns missing field names', () => {
    const missing = validateRequiredFields({ username: '', email: 'a@b.com', password: '' });
    expect(missing).toContain('username');
    expect(missing).toContain('password');
    expect(missing).not.toContain('email');
  });

  test('null and undefined are treated as missing', () => {
    const missing = validateRequiredFields({ username: null, email: undefined, password: 'x' });
    expect(missing).toContain('username');
    expect(missing).toContain('email');
  });

  test('empty object returns empty array', () => {
    expect(validateRequiredFields({})).toEqual([]);
  });
});

// ── isValidEmail ──────────────────────────────────────────────────────────────
describe('isValidEmail', () => {
  test.each([
    'user@example.com',
    'qa_test@example.com',
    'user+tag@domain.co.uk',
  ])('valid email: %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  test.each([
    'notanemail',
    '@nodomain.com',
    'no@',
    '',
    '   ',
  ])('invalid email: %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  test('null returns false', () => {
    expect(isValidEmail(null)).toBe(false);
  });

  test('number returns false', () => {
    expect(isValidEmail(42)).toBe(false);
  });
});

// ── paginationParams ──────────────────────────────────────────────────────────
describe('paginationParams — defaults', () => {
  test('defaults to limit=20, offset=0 for empty query', () => {
    expect(paginationParams({})).toEqual({ limit: 20, offset: 0 });
  });

  test('defaults to limit=20 for missing limit', () => {
    expect(paginationParams({ offset: '5' })).toEqual({ limit: 20, offset: 5 });
  });

  test('defaults to offset=0 for missing offset', () => {
    expect(paginationParams({ limit: '10' })).toEqual({ limit: 10, offset: 0 });
  });
});

describe('paginationParams — valid values', () => {
  test('parses string numbers correctly', () => {
    expect(paginationParams({ limit: '10', offset: '20' })).toEqual({ limit: 10, offset: 20 });
  });

  test('zero offset is valid', () => {
    expect(paginationParams({ limit: '5', offset: '0' })).toEqual({ limit: 5, offset: 0 });
  });
});

describe('paginationParams — invalid values fall back to defaults', () => {
  test('negative limit falls back to 20', () => {
    expect(paginationParams({ limit: '-5' }).limit).toBe(20);
  });

  test('zero limit falls back to 20', () => {
    expect(paginationParams({ limit: '0' }).limit).toBe(20);
  });

  test('negative offset falls back to 0', () => {
    expect(paginationParams({ offset: '-1' }).offset).toBe(0);
  });

  test('NaN falls back to defaults', () => {
    expect(paginationParams({ limit: 'abc', offset: 'xyz' })).toEqual({ limit: 20, offset: 0 });
  });
});
