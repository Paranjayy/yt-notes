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

    // Legacy 🚀 FAB is retired — dedicated widget owns this surface now.
    await expect(page.locator('.sc-floating-action-button')).toHaveCount(0, { timeout: 10000 });

    // Dedicated Reddit widget should inject and capture incl. image-post body.
    const widget = page.locator('#sc-rd-widget');
    await expect(widget).toBeVisible({ timeout: 15000 });
    await expect(widget.locator('#sc-rd-status')).toContainText('captured', { timeout: 15000 });

    // Capture via the widget and verify the body made it into the export.
    await widget.locator('#sc-rd-capture').click();
    await expect(widget.locator('#sc-rd-lines')).toContainText('javascript_dev', { timeout: 15000 });
  });
});
