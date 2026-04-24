/**
 * generate-allure-results.mjs
 *
 * Runs the unit tests via node:test's built-in JSON reporter,
 * then converts each result into an Allure-compatible JSON file
 * written to the allure-results/ directory.
 *
 * Usage:  node tests/unit/generate-allure-results.mjs
 */

import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ALLURE_RESULTS_DIR = join(ROOT, 'allure-results');

// Ensure output directory exists
mkdirSync(ALLURE_RESULTS_DIR, { recursive: true });

// Label helpers for known describe blocks → feature/story/severity mapping
const SUITE_META = {
  'TC-UNIT-01': { feature: 'Slugify Helper', story: 'Standard Inputs', severity: 'normal' },
  'TC-UNIT-02': { feature: 'Slugify Helper', story: 'Empty / Whitespace', severity: 'normal' },
  'TC-UNIT-03': { feature: 'Slugify Helper', story: 'Numeric Inputs', severity: 'normal' },
  'TC-UNIT-04': { feature: 'Slugify Helper', story: 'Special Characters', severity: 'critical' },
  'TC-UNIT-05': { feature: 'Slugify Helper', story: 'Consecutive Delimiters', severity: 'normal' },
};

function getSuiteMeta(suiteName) {
  for (const [key, meta] of Object.entries(SUITE_META)) {
    if (suiteName && suiteName.startsWith(key)) return meta;
  }
  return { feature: 'Unit Tests', story: 'General', severity: 'normal' };
}

function buildAllureResult({ name, suiteName, status, start, stop, statusDetails }) {
  const meta = getSuiteMeta(suiteName);
  const uuid = randomUUID();

  const result = {
    uuid,
    historyId: Buffer.from(`${suiteName}::${name}`).toString('base64'),
    name,
    status,
    start,
    stop,
    labels: [
      { name: 'parentSuite', value: 'Conduit RealWorld App' },
      { name: 'suite',       value: 'Unit Tests' },
      { name: 'subSuite',    value: suiteName || 'ungrouped' },
      { name: 'feature',     value: meta.feature },
      { name: 'story',       value: meta.story },
      { name: 'severity',    value: meta.severity },
      { name: 'layer',       value: 'unit' },
      { name: 'owner',       value: 'qa-team' },
      { name: 'tag',         value: 'unit' },
      { name: 'tag',         value: 'slugify' },
    ],
    steps: [],
  };

  if (statusDetails) {
    result.statusDetails = statusDetails;
  }

  return result;
}

// Run node --test with JSON reporter and collect output lines
function runTests() {
  return new Promise((resolve, reject) => {
    const lines = [];
    const proc = spawn(
      process.execPath,
      ['--test', '--test-reporter=json', 'tests/unit/slugify.test.mjs'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stdout = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', () => {}); // suppress stderr noise

    proc.on('close', () => {
      // JSON reporter emits one JSON object per line
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          lines.push(JSON.parse(trimmed));
        } catch {
          // skip non-JSON lines (e.g. coverage output)
        }
      }
      resolve(lines);
    });

    proc.on('error', reject);
  });
}

const events = await runTests();

// Build a map: testNumber → suite name (from test:start with nesting > 0)
// node:test JSON reporter emits nested structure via nesting field
const suiteStack = [];    // track current describe name
const testMeta = {};      // testNumber → { name, suiteName, start }

for (const event of events) {
  const { type, data } = event;

  if (type === 'test:start') {
    if (data.nesting === 0) {
      // top-level describe block or standalone test
      suiteStack.length = 0;
      suiteStack.push(data.name);
    } else {
      // nested test inside a describe
      testMeta[data.testNumber] = {
        name: data.name,
        suiteName: suiteStack[suiteStack.length - 1] || '',
        start: Date.now(),
      };
    }
  }

  if (type === 'test:pass' || type === 'test:fail') {
    if (data.nesting === 0) {
      // end of describe block
      suiteStack.pop();
      continue;
    }

    const meta = testMeta[data.testNumber] || { name: data.name, suiteName: '', start: Date.now() };
    const duration = data.details?.duration ?? 0;
    const startMs = meta.start;
    const stopMs = startMs + Math.round(duration);

    let status = type === 'test:pass' ? 'passed' : 'failed';
    let statusDetails;

    if (type === 'test:fail') {
      const err = data.details?.error;
      statusDetails = {
        message: err?.message ?? String(err ?? 'Test failed'),
        trace: err?.stack ?? '',
      };
    }

    const allureResult = buildAllureResult({
      name: meta.name,
      suiteName: meta.suiteName,
      status,
      start: startMs,
      stop: stopMs,
      statusDetails,
    });

    const outFile = join(ALLURE_RESULTS_DIR, `${allureResult.uuid}-result.json`);
    import('node:fs').then(({ writeFileSync }) => {
      writeFileSync(outFile, JSON.stringify(allureResult, null, 2));
    });
  }
}

console.log('✓ Unit test Allure results written to allure-results/');
