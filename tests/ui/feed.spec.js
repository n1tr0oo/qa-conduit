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

test.describe('Global Feed & Navigation', () => {
  test('global feed shows feed toggle', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.feed-toggle')).toBeVisible();
  });

  test('global feed tab is active by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.feed-toggle')).toBeVisible();
    await expect(page.locator('.feed-toggle button.active')).toContainText('Global Feed');
  });

  test('article previews or no-articles message is shown', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('.article-preview', { timeout: 10000 });
    await expect(page.locator('.article-preview').first()).toBeVisible();
  });

  test('sidebar with popular tags is visible', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('tag filter changes active tab label', async ({ page }) => {
    await page.goto('/');

    const tags = page.locator('.sidebar button.tag-pill');
    await tags.first().waitFor({ timeout: 10000 });
    const tagCount = await tags.count();

    if (tagCount > 0) {
      const tagText = (await tags.first().textContent()).trim();
      await tags.first().click();

      await expect(page.locator('.feed-toggle button.active')).toContainText(tagText);
    } else {
      test.skip();
    }
  });

  test('authenticated user sees Your Feed tab', async ({ page }) => {
    await login(page);
    await page.goto('/');

    await expect(page.locator('.feed-toggle')).toContainText('Your Feed');
  });

  test('Your Feed tab is clickable and shows results', async ({ page }) => {
    await login(page);
    await page.goto('/');

    await page.locator('.feed-toggle button:has-text("Your Feed")').click();

    await expect(page.locator('.feed-toggle button.active')).toContainText('Your Feed');
    await expect(page.locator('.article-preview').first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking article preview opens article page', async ({ page }) => {
    await page.goto('/');

    const firstArticle = page.locator('a.preview-link').first();
    await firstArticle.waitFor({ timeout: 10000 });
    await firstArticle.click();

    await expect(page).toHaveURL(/#\/article\//);
    await expect(page.locator('.article-page h1')).toBeVisible();
  });
});
