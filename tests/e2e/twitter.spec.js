const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const { mockXPage } = require('./helpers/mock-pages.js');

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
      handle: 'elonmusk',
      text: 'Mars is the goal. 🚀 #space',
      replies: '5.2K',
      retweets: '10K',
      likes: '80K',
    });

    // Navigate to status page (the mock matches this)
    await page.goto('https://x.com/elonmusk/status/123456');

    // Legacy 🚀 FAB is retired — dedicated widget owns this surface now.
    await expect(page.locator('.sc-floating-action-button')).toHaveCount(0, { timeout: 10000 });

    // Dedicated X widget should inject and capture the mocked tweet.
    const widget = page.locator('#sc-x-widget');
    await expect(widget).toBeVisible({ timeout: 15000 });
    await expect(widget.locator('#sc-x-status')).toContainText('posts', { timeout: 15000 });
    await expect(widget.locator('#sc-x-lines')).toContainText('Mars is the goal.', { timeout: 15000 });
  });
});
