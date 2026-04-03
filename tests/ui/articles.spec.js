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

test.describe('Article Management', () => {
  test('create new article', async ({ page }) => {
    await login(page);

    const title = `New Article ${Date.now()}`;
    await page.goto('/#/editor');
    await page.locator('input[placeholder="Article Title"]').fill(title);
    await page.locator('input[placeholder="What\'s this article about?"]').fill('Test description');
    await page.locator('textarea[placeholder="Write your article (in markdown)"]').fill('Test body content');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/#\/article\//);
    await expect(page.locator('.article-page h1')).toContainText(title);
  });

  test('view article page shows content', async ({ page }) => {
    await page.goto('/');
    const firstArticle = page.locator('a.preview-link').first();
    await expect(firstArticle).toBeVisible({ timeout: 10000 });
    await firstArticle.click();

    await expect(page).toHaveURL(/#\/article\//);
    await expect(page.locator('.article-page h1')).toBeVisible();
    await expect(page.locator('.article-content')).toBeVisible();
  });

  test('create and delete article', async ({ page }) => {
    await login(page);

    // accept the confirm dialog automatically
    page.on('dialog', (dialog) => dialog.accept());

    const title = `Delete Me ${Date.now()}`;
    await page.goto('/#/editor');
    await page.locator('input[placeholder="Article Title"]').fill(title);
    await page.locator('input[placeholder="What\'s this article about?"]').fill('To be deleted');
    await page.locator('textarea[placeholder="Write your article (in markdown)"]').fill('Delete test body');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('h1')).toContainText(title);

    await page.locator('button:has-text("Delete Article")').first().click();

    await expect(page).toHaveURL(/#\//);
  });

  test('edit existing article', async ({ page }) => {
    await login(page);

    const title = `Edit Me ${Date.now()}`;
    await page.goto('/#/editor');
    await page.locator('input[placeholder="Article Title"]').fill(title);
    await page.locator('input[placeholder="What\'s this article about?"]').fill('Original description');
    await page.locator('textarea[placeholder="Write your article (in markdown)"]').fill('Original body');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('h1')).toContainText(title);

    // edit link is a <Link className="nav-link"> inside a button
    await page.locator('a.nav-link:has-text("Edit Article")').first().click();

    await page.locator('input[placeholder="Article Title"]').fill('Updated Title');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('h1')).toContainText('Updated Title');
  });

  test('article editor requires login', async ({ page }) => {
    await page.goto('/#/editor');

    // unauthenticated user is redirected away from editor
    await expect(page).not.toHaveURL(/#\/editor/);
  });
});
