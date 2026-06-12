const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const { mockXPage } = require('./proposed_mock-pages.js');

test.describe('X (Twitter) Extension E2E Suite', () => {
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

  test('should scrape tweet content and show floating companion panel', async () => {
    // Mock X Tweet page
    await mockXPage(page, {
      author: 'Elon Musk',
      text: 'Mars is the goal. 🚀 #space',
      replies: '5.2K',
      retweets: '10K',
      likes: '80K',
    });

    // Navigate to status page (the mock matches this)
    await page.goto('https://x.com/elonmusk/status/123456');

    // Verify floating action button is present and click it
    const fab = page.locator('.sc-floating-action-button');
    await expect(fab).toBeVisible({ timeout: 10000 });
    await fab.click();

    // Verify floating panel is open
    const panel = page.locator('.sc-floating-panel');
    await expect(panel).toBeVisible();

    // Verify title contains platform name
    await expect(panel.locator('.sc-header-title')).toContainText('Social Companion (X)');

    // Verify extracted preview text contains scraped data
    const preview = page.locator('#sc-social-preview');
    const md = await preview.innerText();
    expect(md).toContain('Platform: X');
    expect(md).toContain('Author: Elon Musk');
    expect(md).toContain('Mars is the goal.');
    expect(md).toContain('Stats: 5.2K | 10K | 80K');

    // Intercept download request
    const downloadPromise = page.waitForEvent('download');
    await page.click('#sc-social-btn-dl');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('x_scraped_post.md');
  });
});
