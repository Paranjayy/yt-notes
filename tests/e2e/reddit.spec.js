const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const { mockRedditPage } = require('./helpers/mock-pages.js');

test.describe('Reddit Extension E2E Suite', () => {
  let context;
  let page;

  test.beforeEach(async () => {
    const pathToExtension = path.resolve(__dirname, '../../');

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    page = await context.newPage();
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('should scrape Reddit post content and render floating companion panel', async () => {
    // Mock Reddit page
    await mockRedditPage(page, {
      title: 'How to setup Vitest?',
      author: 'javascript_dev',
      text: 'Just use npm install vitest and it works out of the box!',
    });

    // Navigate to post page (the mock matches this)
    await page.goto('https://www.reddit.com/r/javascript/comments/98765/how_to_setup_vitest/');

    // Verify floating action button is present and click it
    const fab = page.locator('.sc-floating-action-button');
    await expect(fab).toBeVisible({ timeout: 10000 });
    await fab.click();

    // Verify floating panel is open
    const panel = page.locator('.sc-floating-panel');
    await expect(panel).toBeVisible();

    // Verify title contains platform name
    await expect(panel.locator('.sc-header-title')).toContainText('Social Companion (Reddit)');

    // Verify extracted preview text contains scraped data
    const preview = page.locator('#sc-social-preview');
    const md = await preview.innerText();
    expect(md).toContain('Platform: REDDIT');
    expect(md).toContain('Author: javascript_dev');
    expect(md).toContain('Title: How to setup Vitest?');
    expect(md).toContain('Just use npm install vitest');

    // Intercept download request
    const downloadPromise = page.waitForEvent('download');
    await page.click('#sc-social-btn-dl');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('reddit_scraped_post.md');
  });
});
