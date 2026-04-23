/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',

  // ── Test runner ─────────────────────────────────────────────────────────────
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.mutation.config.js',
  },

  // ── Source files to mutate ───────────────────────────────────────────────────
  // Pure backend helper functions extracted to ESM for Stryker compatibility
  mutate: ['tests/mutation/helpers.mjs'],

  // ── Coverage analysis (perTest = most granular, fastest kill detection) ───────
  coverageAnalysis: 'perTest',

  // ── Mutation types to apply ──────────────────────────────────────────────────
  // Default: all mutators. Explicitly listed here for documentation purposes.
  // ArithmeticOperator, BooleanLiteral, ConditionalExpression,
  // EqualityOperator, LogicalOperator, MethodExpression (remove call),
  // OptionalChaining, RegexMutator, StringLiteral, UpdateOperator
  plugins: ['@stryker-mutator/vitest-runner'],

  // ── Reporting ────────────────────────────────────────────────────────────────
  reporters: ['html', 'clear-text', 'progress', 'json'],
  htmlReporter: {
    fileName: 'reports/mutation/stryker-report.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/stryker-report.json',
  },

  // ── Quality thresholds ────────────────────────────────────────────────────────
  thresholds: {
    high:  80,
    low:   60,
    break: 50,   // exit code 1 if score < 50%
  },

  // ── Concurrency ──────────────────────────────────────────────────────────────
  concurrency: 4,

  // ── Temp dir ─────────────────────────────────────────────────────────────────
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};
