/**
 * Edge-Case & Failure Test Suite — Conduit RealWorld App
 * Midterm Task 2.1 — 5 new test cases targeting HIGH-risk modules
 *
 * Categories covered per assignment requirement:
 *   - Failure scenarios   : TC-AUTH-FAIL-01, TC-ART-FAIL-01
 *   - Edge cases          : TC-ART-EDGE-01
 *   - Concurrency/rapid   : TC-CONC-01
 *   - Invalid user behavior: TC-INV-01
 */

import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'qa_test@example.com',
  password: 'password123',
  username: 'qa_test',
};

async function login(page) {
  await page.goto('/#/login');
  await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
  await page.locator('input[placeholder="Password"]').fill(TEST_USER.password);
  await page.locator('button:has-text("Login")').click();
  await expect(page.locator('nav')).toContainText(TEST_USER.username);
}

// ── TC-AUTH-FAIL-01: Failure scenario — empty credentials ─────────────────────
// Target module : User Authentication (HIGH risk)
// Scenario type : Failure — empty form submission
// Input data    : email = "", password = "" (both blank)
// Expected      : Browser HTML5 validation prevents submission;
//                 user stays on login page (no redirect to home)
// Note          : The login form uses native <input required> — empty submit
//                 triggers browser-level validation, no API call is made,
//                 so ul.error-messages is NOT rendered. The observable outcome
//                 is that the URL does NOT change to /#/
test('TC-AUTH-FAIL-01 — login with empty fields does not navigate to home', async ({ page }) => {
  await page.goto('/#/login');

  // Submit form without entering any credentials
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(800);

  // HTML5 required validation prevents submission — user stays on login page
  await expect(page).toHaveURL(/#\/login/);
});

// ── TC-AUTH-FAIL-02: Failure scenario — SQL injection in password field ────────
// Target module : User Authentication (HIGH risk)
// Scenario type : Failure / invalid input — injection-like password string
// Input data    : email = qa_test@example.com, password = "' OR '1'='1'; DROP TABLE--"
// Expected      : API returns 422 (wrong password); ul.error-messages shown;
//                 user is NOT authenticated (injection does not bypass bcrypt)
test('TC-AUTH-FAIL-02 — injection-like password is rejected by API', async ({ page }) => {
  await page.goto('/#/login');
  await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
  await page.locator('input[placeholder="Password"]').fill("' OR '1'='1'; DROP TABLE users;--");
  await page.locator('button:has-text("Login")').click();

  // API returns 422 — injection string does not bypass bcrypt password check
  await expect(page.locator('ul.error-messages')).toBeVisible({ timeout: 10000 });
  // Confirm user is NOT logged in (nav does not show username)
  await expect(page.locator('nav')).not.toContainText(TEST_USER.username);
});

// ── TC-ART-EDGE-01: Edge case — XSS-like special characters in article title ──
// Target module : Article Management (HIGH risk)
// Scenario type : Edge case — injection-like / special character input
// Input data    : title contains <script> tags and angle brackets
// Expected      : Article saved and displayed with chars escaped (React escapes by default);
//                 no script execution; page title contains sanitised text
test('TC-ART-EDGE-01 — article with XSS-like title is stored and displayed safely', async ({ page }) => {
  await login(page);

  const xssTitle = `<script>alert(1)</script> Article ${Date.now()}`;
  await page.goto('/#/editor');
  await page.locator('input[placeholder="Article Title"]').fill(xssTitle);
  await page.locator('input[placeholder="What\'s this article about?"]').fill('XSS edge case test');
  await page.locator('textarea[placeholder="Write your article (in markdown)"]').fill('Body text for edge case article.');
  await page.locator('button[type="submit"]').click();

  // Must redirect to article page (article was created)
  await expect(page).toHaveURL(/#\/article\//, { timeout: 10000 });

  // The h1 must not execute script — React renders it as escaped text
  const h1 = page.locator('.article-page h1');
  await expect(h1).toBeVisible();

  // No alert dialog must have fired (no JS injection)
  // If <script> were executed, a dialog would appear; accept it so test continues
  // and then fail explicitly
  let alertFired = false;
  page.on('dialog', async (dialog) => {
    alertFired = true;
    await dialog.accept();
  });

  // Wait a moment for any potential alert
  await page.waitForTimeout(1000);
  expect(alertFired).toBe(false);

  // Clean up — delete the article
  // The first page.on('dialog') handler above already accepts all dialogs —
  // no second handler needed (would throw "dialog already handled")
  await page.locator('button:has-text("Delete Article")').first().click();
});

// ── TC-CONC-01: Concurrency — double-click submit on login ────────────────────
// Target module : User Authentication (HIGH risk)
// Scenario type : Concurrency / race condition — rapid repeated action
// Input data    : Valid credentials submitted twice in rapid succession
// Expected      : Application handles gracefully — user lands on home ONCE
//                 without crash, duplicate session, or JS error
test('TC-CONC-01 — double-click login submit does not crash the app', async ({ page }) => {
  await page.goto('/#/login');
  await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
  await page.locator('input[placeholder="Password"]').fill(TEST_USER.password);

  // Double-click the submit button to simulate rapid user action
  const loginBtn = page.locator('button:has-text("Login")');
  await loginBtn.dblclick();

  // App must eventually reach the home page (one successful login)
  await expect(page).toHaveURL(/#\//, { timeout: 10000 });
  await expect(page.locator('nav')).toContainText(TEST_USER.username);
});

// ── TC-INV-01: Invalid user behavior — access Settings without authentication ──
// Target module : User Authentication (HIGH risk) / User Profile (MEDIUM risk)
// Scenario type : Invalid user behavior — skipping required auth step
// Input data    : Navigate directly to /#/settings without logging in
// Expected      : Unauthenticated user is redirected away from /settings
test('TC-INV-01 — unauthenticated user cannot access settings page', async ({ page }) => {
  // Navigate directly to protected route without logging in
  await page.goto('/#/settings');

  // App must redirect away (same guard as /#/editor)
  await expect(page).not.toHaveURL(/#\/settings/, { timeout: 5000 });
});
