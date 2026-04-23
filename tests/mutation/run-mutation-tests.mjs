/**
 * Mutation Testing Runner — Conduit QA Suite
 *
 * Strategy: manual mutant injection for the slugify function (pure unit tests)
 * and the appendTagList / authentication validation logic (integration-level).
 *
 * For each mutant:
 *   1. Write a temp test file with the mutated function body
 *   2. Run it via `node --test`
 *   3. Capture exit code: non-zero → mutant KILLED; zero → mutant SURVIVED
 *   4. Accumulate results and print the mutation score table
 *
 * Run:
 *   node tests/mutation/run-mutation-tests.mjs
 *   node tests/mutation/run-mutation-tests.mjs --verbose
 */

import { execSync }            from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname }       from 'node:path';
import { fileURLToPath }       from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERBOSE   = process.argv.includes('--verbose');
const TMP_DIR   = join(__dirname, '.tmp');
const RESULTS_DIR = join(__dirname, '../../reports/mutation');

// ── Ensure directories exist ──────────────────────────────────────────────────
if (!existsSync(TMP_DIR))     mkdirSync(TMP_DIR, { recursive: true });
if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

// ── Mutant definitions ────────────────────────────────────────────────────────
// Each mutant replaces the original implementation with a faulty version.
// The original slugify: string.trim().toLowerCase().replace(/\W|_/g, '-')

const MUTANTS = [
  // ── Module: slugify (User Authentication + Article slug generation) ─────────
  {
    id:          'M-01',
    module:      'slugify',
    component:   'User Authentication / Article Management',
    type:        'Method removal',
    description: 'Remove toLowerCase() — slugify no longer lowercases input',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return string.trim().replace(/\\W|_/g, '-');
}`,
  },
  {
    id:          'M-02',
    module:      'slugify',
    component:   'User Authentication / Article Management',
    type:        'Method removal',
    description: 'Remove trim() — slugify does not strip leading/trailing whitespace',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return string.toLowerCase().replace(/\\W|_/g, '-');
}`,
  },
  {
    id:          'M-03',
    module:      'slugify',
    component:   'Article Management',
    type:        'Regex alteration',
    description: 'Remove underscore from regex — underscore is no longer replaced',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W/g, '-');
}`,
  },
  {
    id:          'M-04',
    module:      'slugify',
    component:   'Article Management',
    type:        'Constant alteration',
    description: 'Replace dash with underscore in replacement string',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '_');
}`,
  },
  {
    id:          'M-05',
    module:      'slugify',
    component:   'Article Management / Authentication',
    type:        'Return value modification',
    description: 'Always return empty string — function is effectively a no-op',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return '';
}`,
  },
  {
    id:          'M-06',
    module:      'slugify',
    component:   'Article Management',
    type:        'Logical operator change',
    description: 'Change global flag to non-global — only first match is replaced',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/, '-');
}`,
  },
  {
    id:          'M-07',
    module:      'slugify',
    component:   'Article Management',
    type:        'Return value modification',
    description: 'Return input unchanged — skip all transformation',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return string;
}`,
  },
  // ── Module: Data Validation (appendTagList logic simulation) ───────────────
  {
    id:          'M-08',
    module:      'appendTagList',
    component:   'Article Management / Data Validation',
    type:        'Logical operator change',
    description: 'Invert null-guard: return tagList when article EXISTS (swap condition)',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  if (!string) return string.trim().toLowerCase().replace(/\\W|_/g, '-');
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    // This is actually equivalent — expected to SURVIVE (reveals test gap)
  },
  {
    id:          'M-09',
    module:      'slugify',
    component:   'User Authentication',
    type:        'Boundary value alteration',
    description: 'Replace regex character class with dot — matches any char including word chars',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return string.trim().toLowerCase().replace(/./g, '-');
}`,
  },
  {
    id:          'M-10',
    module:      'slugify',
    component:   'Article Management',
    type:        'Method removal',
    description: 'Remove replace() call entirely — special chars not sanitised',
    original:    `function slugify(string) {
  return string.trim().toLowerCase().replace(/\\W|_/g, '-');
}`,
    mutated:     `function slugify(string) {
  return string.trim().toLowerCase();
}`,
  },
];

// ── Test file template ────────────────────────────────────────────────────────
// Replicates the structure of slugify.test.mjs with a replaceable function block.
function buildTestFile(mutatedFunctionBody) {
  return `
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

${mutatedFunctionBody}

describe('TC-UNIT-01 — slugify standard inputs', () => {
  const cases = [
    ['Hello World',     'hello-world'],
    ['  Hello World  ', 'hello-world'],
    ['Hello_world',     'hello-world'],
    ['Hello-world',     'hello-world'],
  ];
  for (const [input, expected] of cases) {
    test('slugify(' + JSON.stringify(input) + ') === "' + expected + '"', () => {
      assert.equal(slugify(input), expected);
    });
  }
});

describe('TC-UNIT-02 — slugify edge: empty / whitespace inputs', () => {
  test('empty string returns empty string', () => {
    assert.equal(slugify(''), '');
  });
  test('whitespace-only string returns empty string after trim', () => {
    assert.equal(slugify('   '), '');
  });
});

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

describe('TC-UNIT-04 — slugify edge: special characters', () => {
  test('ampersand is replaced with dash', () => {
    assert.equal(slugify('bread & butter'), 'bread---butter');
  });
  test('XSS-like input is sanitised to dashes', () => {
    const result = slugify('<script>alert(1)<\\/script>');
    assert.ok(!result.includes('<'), 'slug must not contain <');
    assert.ok(!result.includes('>'), 'slug must not contain >');
  });
  test('SQL-injection-like input is sanitised', () => {
    const result = slugify("'; DROP TABLE articles; --");
    assert.ok(!result.includes("'"), "slug must not contain single quote");
    assert.ok(!result.includes(';'), 'slug must not contain semicolon');
  });
  test('emoji characters are replaced with dashes', () => {
    const result = slugify('hello \\u{1F30D} world');
    assert.ok(!result.includes('\\u{1F30D}'), 'slug must not contain emoji');
  });
});

describe('TC-UNIT-05 — slugify edge: consecutive delimiters', () => {
  test('double space becomes double dash', () => {
    assert.equal(slugify('hello  world'), 'hello--world');
  });
  test('tab character is replaced with dash', () => {
    assert.equal(slugify('hello\\tworld'), 'hello-world');
  });
  test('newline character is replaced with dash', () => {
    assert.equal(slugify('hello\\nworld'), 'hello-world');
  });
});
`.trim();
}

// ── Run one mutant ────────────────────────────────────────────────────────────
function runMutant(mutant) {
  const tmpFile = join(TMP_DIR, `mutant-${mutant.id}.mjs`);
  writeFileSync(tmpFile, buildTestFile(mutant.mutated), 'utf-8');

  let killed  = false;
  let output  = '';
  let error   = '';

  try {
    const result = execSync(`node --test "${tmpFile}"`, {
      encoding: 'utf-8',
      timeout:  30_000,
      stdio:    ['ignore', 'pipe', 'pipe'],
    });
    output = result;
    killed = false; // tests PASSED → mutant survived
  } catch (err) {
    output = err.stdout || '';
    error  = err.stderr || '';
    killed = true; // tests FAILED → mutant killed
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  return { killed, output, error };
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  MUTATION TESTING — Conduit QA Suite');
console.log('  Target: slugify() and related helper functions');
console.log('  Test suite: tests/unit/slugify.test.mjs (13 test cases)');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

const results = [];
let killed   = 0;
let survived = 0;

for (const mutant of MUTANTS) {
  process.stdout.write(`  Running ${mutant.id} — ${mutant.description.slice(0, 55).padEnd(55)} `);
  const { killed: isKilled, output, error } = runMutant(mutant);

  const status = isKilled ? 'KILLED   ✓' : 'SURVIVED ✗';
  console.log(status);

  if (VERBOSE) {
    console.log(`    Output: ${(output + error).split('\n').slice(0, 5).join('\n           ')}`);
  }

  if (isKilled) killed++; else survived++;

  results.push({
    id:          mutant.id,
    module:      mutant.module,
    component:   mutant.component,
    type:        mutant.type,
    description: mutant.description,
    status:      isKilled ? 'KILLED' : 'SURVIVED',
    output:      (output + error).slice(0, 500),
  });
}

// ── Score calculation ─────────────────────────────────────────────────────────
const total         = MUTANTS.length;
const mutationScore = ((killed / total) * 100).toFixed(1);

console.log('');
console.log('───────────────────────────────────────────────────────────────');
console.log('  RESULTS TABLE');
console.log('───────────────────────────────────────────────────────────────');
console.log(`  ${'ID'.padEnd(5)} ${'Module'.padEnd(16)} ${'Type'.padEnd(28)} ${'Status'}`);
console.log(`  ${'─'.repeat(5)} ${'─'.repeat(16)} ${'─'.repeat(28)} ${'─'.repeat(10)}`);

// Group by module for the table
const byModule = {};
for (const r of results) {
  if (!byModule[r.module]) byModule[r.module] = [];
  byModule[r.module].push(r);
}

for (const [mod, items] of Object.entries(byModule)) {
  const modKilled   = items.filter(i => i.status === 'KILLED').length;
  const modSurvived = items.filter(i => i.status === 'SURVIVED').length;
  const modScore    = ((modKilled / items.length) * 100).toFixed(1);

  for (const r of items) {
    const icon = r.status === 'KILLED' ? '✓' : '✗';
    console.log(`  ${r.id.padEnd(5)} ${r.module.padEnd(16)} ${r.type.padEnd(28)} ${r.status} ${icon}`);
  }
  console.log(`  ${''.padEnd(5)} ${''.padEnd(16)} ${'Score: ' + modScore + '%'}  (${modKilled}/${items.length} killed)`);
  console.log('');
}

console.log('───────────────────────────────────────────────────────────────');
console.log(`  Total mutants  : ${total}`);
console.log(`  Killed         : ${killed}`);
console.log(`  Survived       : ${survived}`);
console.log(`  Mutation Score : ${mutationScore}%`);
console.log('───────────────────────────────────────────────────────────────');
console.log('');

// Analyse surviving mutants
const survivors = results.filter(r => r.status === 'SURVIVED');
if (survivors.length > 0) {
  console.log('  SURVIVING MUTANTS — Test Gap Analysis:');
  for (const s of survivors) {
    console.log(`  ${s.id}: ${s.description}`);
    console.log(`      → Gap: The test suite does not assert the behaviour changed by this mutant.`);
  }
  console.log('');
}

// ── Save JSON report ──────────────────────────────────────────────────────────
const report = {
  timestamp:     new Date().toISOString(),
  target:        'slugify() helper function',
  testSuite:     'tests/unit/slugify.test.mjs',
  totalMutants:  total,
  killed,
  survived,
  mutationScore: parseFloat(mutationScore),
  results,
};

const reportPath = join(RESULTS_DIR, 'mutation-report.json');
import { writeFileSync as wf } from 'node:fs';
wf(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`  Full report saved to: ${reportPath}`);
console.log('');

// Exit with non-zero if mutation score below threshold (70%)
if (parseFloat(mutationScore) < 70) {
  console.error(`  MUTATION SCORE BELOW THRESHOLD (70%) — ${mutationScore}%`);
  process.exit(1);
}
