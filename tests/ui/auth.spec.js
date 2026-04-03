import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'qa_test@example.com',
  password: 'password123',
  username: 'qa_test',
};

test.describe('Authentication', () => {
  test('login with valid credentials', async ({ page }) => {
    await page.goto('/#/login');
    await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
    await page.locator('input[placeholder="Password"]').fill(TEST_USER.password);
    await page.locator('button:has-text("Login")').click();

    await expect(page).toHaveURL(/#\//);
    await expect(page.locator('nav')).toContainText(TEST_USER.username);
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/#/login');
    await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
    await page.locator('input[placeholder="Password"]').fill('wrongpassword');
    await page.locator('button:has-text("Login")').click();

    await expect(page.locator('ul.error-messages')).toBeVisible({ timeout: 10000 });
  });

  test('login with non-existent user shows error', async ({ page }) => {
    await page.goto('/#/login');
    await page.locator('input[placeholder="Email"]').fill('nouser@example.com');
    await page.locator('input[placeholder="Password"]').fill('password123');
    await page.locator('button:has-text("Login")').click();

    await expect(page.locator('ul.error-messages')).toBeVisible({ timeout: 10000 });
  });

  test('register form submits and redirects', async ({ page }) => {
    const unique = Date.now();
    await page.goto('/#/register');
    await page.locator('input[placeholder="Your Name"]').fill(`user${unique}`);
    await page.locator('input[placeholder="Email"]').fill(`user${unique}@example.com`);
    await page.locator('input[placeholder="Password"]').fill('password123');
    await page.locator('button:has-text("Sign up")').click();

    await expect(page).toHaveURL(/#\//);
    await expect(page.locator('nav')).toContainText(`user${unique}`);
  });

  test('register with existing email shows error', async ({ page }) => {
    await page.goto('/#/register');
    await page.locator('input[placeholder="Your Name"]').fill('someuser');
    await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
    await page.locator('input[placeholder="Password"]').fill('password123');
    await page.locator('button:has-text("Sign up")').click();

    await expect(page.locator('ul.error-messages')).toBeVisible({ timeout: 10000 });
  });

  test('logout returns to home page', async ({ page }) => {
    await page.goto('/#/login');
    await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
    await page.locator('input[placeholder="Password"]').fill(TEST_USER.password);
    await page.locator('button:has-text("Login")').click();
    await expect(page.locator('nav')).toContainText(TEST_USER.username);

    // open dropdown menu
    await page.locator('.nav-link.dropdown-toggle').click();
    await page.locator('.dropdown-item:has-text("Logout")').click();

    await expect(page).toHaveURL(/#\//);
    await expect(page.locator('nav')).toContainText('Login');
  });
});
