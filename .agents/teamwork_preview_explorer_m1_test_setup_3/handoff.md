# Handoff Report: Social Companion Test Setup Investigation

This report proposes a detailed testing setup for the Social Companion browser extension, covering environmental details, unit testing of content script helpers using Vitest, E2E testing using Playwright, and recommended file structure changes.

---

## 1. Observation

### Environmental Inspection
Running `node --version && npm --version` in the workspace context yielded the following results:
```
v25.9.0
11.12.1
```
This confirms that both **Node.js** (v25.9.0) and **npm** (11.12.1) are available and ready on the system.

### Codebase and Architecture Inspection
The extension files in `/Users/paranjay/Developer/yt notes` are:
1. **`manifest.json`**: Configures the chrome extension.
2. **`background.js`**: Service worker script.
3. **`content.js`**: Main content script containing UI injection, page scraping, and helper methods.

Inside `/Users/paranjay/Developer/yt notes/content.js`:
- The script is wrapped inside an Immediately Invoked Function Expression (IIFE):
  ```javascript
  (function () {
    'use strict';
    ...
  })();
  ```
- Helper functions like `formatTime` (line 768), `escapeHtml` (line 1409), and `decodeHtmlEntities` (line 1420) are private to this IIFE.
- `decodeHtmlEntities` depends on `document` (specifically `document.createElement('textarea')`).
- Page scraping functions like `scrapeXThread` (line 1368) and `scrapeRedditPost` (line 1381) depend on selectors specific to X and Reddit DOM elements (e.g. `[data-testid="User-Name"]`, `[data-testid="tweetText"]`, `shreddit-title`, etc.).
- Playlist/queue metadata extraction `extractYouTubeMetadata` (line 1088) parses query parameters (`list`, `index`) and DOM elements (`ytd-playlist-panel-renderer`).
- Screenshot downloads in `capturePlayerScreenshot` (line 702) draw the `<video>` element contents onto a `<canvas>` and programmatically trigger a download via a generated link.

---

## 2. Logic Chain

1. **Environmental Verification**: Since Node.js and npm are installed, we can safely initialize a Node-based testing suite (Vitest + Playwright) in the project root.
2. **Unit Test Strategy for Helpers**:
   - Because `content.js` helpers are enclosed within an IIFE (Observation 1), they cannot be accessed by external test suites.
   - Refactoring these helpers (`formatTime`, `escapeHtml`, `decodeHtmlEntities`, `formatSocialMarkdown`) into a dedicated `helpers.js` file allows us to isolate pure logic from page UI rendering side-effects.
   - In `helpers.js`, we can conditionally export functions for Node.js (`typeof module !== 'undefined'`) while allowing them to run globally in the Chrome extension.
   - We must update `manifest.json` to load `helpers.js` before `content.js` in the content scripts array, ensuring the globals are available to `content.js`.
   - Since `decodeHtmlEntities` uses `document` (Observation 1), the unit tests must run in a browser-like DOM environment. **Vitest** with the `jsdom` environment is ideal for this, as it is fast, modern, and provides out-of-the-box support.
3. **E2E Test Strategy**:
   - Chrome extensions cannot be loaded in standard headless mode (except with `--headless=new`). Playwright provides native APIs to launch persistent contexts with custom Chrome extensions loaded.
   - To avoid hitting live networks and dealing with changing/flaky web pages, we can use Playwright's `page.route()` API to intercept URL navigations (to YouTube, X, Reddit) and serve local, static, structured HTML matching the expected DOM selectors (Observation 1).
   - Once loaded, Playwright can simulate user notes input, click actions (screenshots, markdown copying), and inspect the resulting DOM updates, clipboard status, and download triggers (e.g., matching the generated file download in `capturePlayerScreenshot`).

---

## 3. Caveats

- **Headed vs Headless E2E Tests**: Chrome extensions in Playwright must run with `headless: false` or using the new headless mode `--headless=new`. In CI environments (like GitHub Actions), a virtual framebuffer (XVFB) may be needed.
- **Strict Selector Deprecation**: The E2E tests mock specific DOM selectors present in the current `content.js` implementation. If YouTube, X, or Reddit change their DOM selectors, the scrapers will fail E2E validation, which is the intended behavior of regressions alerts.
- **Canvas Taint**: Capturing video screenshot via `canvas.toDataURL` can throw security errors if the mock video source is cross-origin. In tests, the video must have no source or use a local mock stream/data URL.

---

## 4. Conclusion

A robust test setup can be built using **Vitest** for unit tests and **Playwright** for E2E tests. The implementation will require extracting helper functions, modifying `manifest.json`, and creating configuration files.

### Recommended Files to Create & Modify

#### 1. Modify `manifest.json`
Load `helpers.js` before `content.js`:
```json
      "js": ["helpers.js", "content.js"],
```

#### 2. Create `helpers.js` (Extracted Helpers)
```javascript
// helpers.js
function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 100);
  
  const msStr = ms.toString().padStart(2, '0');
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${msStr}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}.${msStr}`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function decodeHtmlEntities(str) {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function formatSocialMarkdown(data, platform) {
  let md = `---\n`;
  md += `Platform: ${platform.toUpperCase()}\n`;
  md += `Author: ${data.author}\n`;
  if (data.title) md += `Title: ${data.title}\n`;
  md += `URL: ${data.url}\n`;
  md += `---\n\n`;
  md += `# Post/Thread Content\n\n`;
  md += `${data.text}\n\n`;
  if (data.stats) {
    md += `**Stats**: ${data.stats}\n`;
  }
  return md;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatTime,
    escapeHtml,
    decodeHtmlEntities,
    formatSocialMarkdown
  };
}
```

#### 3. Modify `content.js`
Remove the local definitions of `formatTime`, `escapeHtml`, `decodeHtmlEntities`, and `formatSocialMarkdown` (lines 768-779, 1394-1424) as they are now provided by `helpers.js`.

#### 4. Create `package.json`
```json
{
  "name": "social-companion-yt-notes",
  "version": "1.0.0",
  "description": "Premium companion for YouTube, X, and Reddit",
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test": "npm run test:unit && npm run test:e2e"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.5"
  },
  "type": "module"
}
```

#### 5. Create `vitest.config.js`
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

#### 6. Create `playwright.config.js`
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  workers: 1, // Runs sequentially to avoid chrome extension conflicts
  reporter: 'html',
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

#### 7. Create `tests/unit/helpers.test.js`
```javascript
import { describe, it, expect } from 'vitest';
import { formatTime, escapeHtml, decodeHtmlEntities, formatSocialMarkdown } from '../../helpers.js';

describe('Helpers Unit Tests', () => {
  describe('formatTime', () => {
    it('formats 0 seconds correctly', () => {
      expect(formatTime(0)).toBe('0:00.00');
    });

    it('formats less than a minute correctly', () => {
      expect(formatTime(59.5)).toBe('0:59.50');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatTime(65.25)).toBe('1:05.25');
    });

    it('formats hours, minutes, and seconds correctly', () => {
      expect(formatTime(3605)).toBe('1:00:05.00');
    });
  });

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      const input = '<div>Hello & "World"</div>';
      const expected = '&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });

  describe('decodeHtmlEntities', () => {
    it('decodes HTML entities back to text', () => {
      const input = '&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;';
      const expected = '<div>Hello & "World"</div>';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });

  describe('formatSocialMarkdown', () => {
    it('formats X/Twitter scraped data correctly', () => {
      const data = {
        author: 'John Doe',
        text: 'Hello world! #testing',
        stats: '5 replies | 10 retweets | 100 likes',
        url: 'https://twitter.com/johndoe/status/123'
      };
      const result = formatSocialMarkdown(data, 'x');
      expect(result).toContain('Platform: X');
      expect(result).toContain('Author: John Doe');
      expect(result).toContain('Stats: 5 replies | 10 retweets | 100 likes');
      expect(result).toContain('Hello world! #testing');
    });
  });
});
```

#### 8. Create `tests/e2e/extension.fixture.js`
```javascript
import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, '../../');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
```

#### 9. Create `tests/e2e/youtube.spec.js`
```javascript
import { test, expect } from './extension.fixture.js';

test.describe('YouTube Companion E2E Tests', () => {
  test('Injects widget, takes notes, captures screenshots, and exports playlist metadata', async ({ context, page }) => {
    // 1. Mock the YouTube watch page
    await page.route('https://www.youtube.com/watch?v=mock_video&list=mock_playlist_123&index=3', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Mock YouTube Video</title>
          </head>
          <body>
            <div id="secondary">
              <div id="secondary-inner"></div>
            </div>
            
            <h1 class="ytd-watch-metadata">
              <yt-formatted-string>Mock Video Title</yt-formatted-string>
            </h1>
            
            <ytd-video-owner-renderer>
              <div id="channel-name">
                <a href="/@mockchannel">Mock Channel</a>
              </div>
              <div id="owner-sub-count">1.2M subscribers</div>
            </ytd-video-owner-renderer>

            <div id="info-container">
              <div id="info">
                <span>150,000 views</span>
              </div>
            </div>

            <ytd-playlist-panel-renderer>
              <div id="title-container">
                <div id="title">My Awesome Playlist</div>
              </div>
            </ytd-playlist-panel-renderer>

            <video id="player-video" width="640" height="360" controls></video>

            <script>
              var ytInitialPlayerResponse = {
                videoDetails: {
                  title: "Mock Video Title",
                  videoId: "mock_video",
                  author: "Mock Channel"
                },
                captions: {
                  playerCaptionsTracklistRenderer: {
                    captionTracks: [
                      {
                        baseUrl: "https://www.youtube.com/api/timedtext?v=mock_video",
                        languageCode: "en"
                      }
                    ]
                  }
                }
              };
            </script>
          </body>
          </html>
        `
      });
    });

    // Mock transcript network request
    await page.route('https://www.youtube.com/api/timedtext?v=mock_video', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/xml',
        body: `
          <transcript>
            <text start="0.5" dur="2.0">Hello and welcome to the mock video.</text>
            <text start="5.0" dur="3.0">Today we are demonstrating the extension testing.</text>
          </transcript>
        `
      });
    });

    // 2. Navigate to page
    await page.goto('https://www.youtube.com/watch?v=mock_video&list=mock_playlist_123&index=3');

    // 3. Verify widget injection
    const widget = page.locator('#sc-youtube-widget');
    await expect(widget).toBeVisible();

    // 4. Verify transcript is fetched and rendered
    const transcriptTab = page.locator('.sc-tab[data-tab="transcript"]');
    await transcriptTab.click();
    
    const firstLineTime = page.locator('.sc-transcript-time').first();
    await expect(firstLineTime).toHaveText('0:00.50');
    const firstLineText = page.locator('.sc-transcript-line').first();
    await expect(firstLineText).toContainText('Hello and welcome to the mock video.');

    // 5. Test Note-Taking
    const notesTab = page.locator('.sc-tab[data-tab="notes"]');
    await notesTab.click();

    // Set video current time to 12.5s for note-taking
    await page.evaluate(() => {
      const v = document.querySelector('video');
      v.currentTime = 12.5;
    });

    const noteTextarea = page.locator('#sc-note-input');
    await noteTextarea.fill('This is a test note at 12.5s');
    
    const addNoteBtn = page.locator('#sc-btn-add-note');
    await addNoteBtn.click();

    // Verify note is rendered
    const noteItem = page.locator('.sc-note-item').first();
    await expect(noteItem.locator('.sc-note-timestamp')).toHaveText('0:12.50');
    await expect(noteItem.locator('.sc-note-text')).toHaveText('This is a test note at 12.5s');

    // 6. Test Playlist/Queue Metadata in Export Markdown
    const exportTab = page.locator('.sc-tab[data-tab="export"]');
    await exportTab.click();

    // Grant clipboard access
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    const copyBtn = page.locator('#sc-btn-copy-all');
    await copyBtn.click();

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('# Personal Notes & Markers');
    expect(clipboardText).toContain('- **[0:12.50]**: This is a test note at 12.5s');
    expect(clipboardText).toContain('Playlist: My Awesome Playlist');
    expect(clipboardText).toContain('Playlist URL: https://www.youtube.com/playlist?list=mock_playlist_123');
    expect(clipboardText).toContain('Playlist Index: 3');

    // 7. Test Screenshot Download
    const downloadPromise = page.waitForEvent('download');
    await notesTab.click();
    await page.locator('#sc-btn-ss').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('screenshot_mock_video_title');
  });
});
```

#### 10. Create `tests/e2e/x.spec.js`
```javascript
import { test, expect } from './extension.fixture.js';

test.describe('X/Twitter Companion E2E Tests', () => {
  test('Injects FAB, clicks, loads panel, and scrapes thread', async ({ page }) => {
    // 1. Mock X Thread Page
    await page.route('https://x.com/elonmusk/status/9999999999', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Mock X Thread</title>
          </head>
          <body>
            <div data-testid="User-Name">
              <span>Elon Musk</span>
            </div>
            <div data-testid="tweetText">
              This is a mock tweet about spaceships and Mars.
            </div>
            <div data-testid="reply">1.2K</div>
            <div data-testid="retweet">5.4K</div>
            <div data-testid="like">42K</div>
          </body>
          </html>
        `
      });
    });

    // 2. Navigate to page
    await page.goto('https://x.com/elonmusk/status/9999999999');

    // 3. Verify FAB exists
    const fab = page.locator('.sc-floating-action-button');
    await expect(fab).toBeVisible();

    // 4. Click FAB to open panel
    await fab.click();

    // 5. Verify Panel exists and scraped preview text matches DOM
    const panel = page.locator('.sc-floating-panel');
    await expect(panel).toBeVisible();

    const preview = page.locator('#sc-social-preview');
    await expect(preview).toContainText('Platform: X');
    await expect(preview).toContainText('Author: Elon Musk');
    await expect(preview).toContainText('This is a mock tweet about spaceships and Mars.');
    await expect(preview).toContainText('Stats: 1.2K | 5.4K | 42K');
  });
});
```

#### 11. Create `tests/e2e/reddit.spec.js`
```javascript
import { test, expect } from './extension.fixture.js';

test.describe('Reddit Companion E2E Tests', () => {
  test('Injects FAB, clicks, loads panel, and scrapes post', async ({ page }) => {
    // 1. Mock Reddit Post Page
    await page.route('https://www.reddit.com/r/javascript/comments/123/mock_reddit/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Mock Reddit Post</title>
          </head>
          <body>
            <shreddit-title title="How to test chrome extensions in Playwright"></shreddit-title>
            <a href="/user/js_dev_coder/">js_dev_coder</a>
            <div id="any-post-rtjson-content">
              This is a post content describing how Playwright intercepts routes to mock extension testing.
            </div>
          </body>
          </html>
        `
      });
    });

    // 2. Navigate to page
    await page.goto('https://www.reddit.com/r/javascript/comments/123/mock_reddit/');

    // 3. Verify FAB exists
    const fab = page.locator('.sc-floating-action-button');
    await expect(fab).toBeVisible();

    // 4. Click FAB to open panel
    await fab.click();

    // 5. Verify Panel exists and scraped preview text matches DOM
    const panel = page.locator('.sc-floating-panel');
    await expect(panel).toBeVisible();

    const preview = page.locator('#sc-social-preview');
    await expect(preview).toContainText('Platform: REDDIT');
    await expect(preview).toContainText('Author: js_dev_coder');
    expect(await preview.textContent()).toContain('Title: How to test chrome extensions in Playwright');
    expect(await preview.textContent()).toContain('This is a post content describing how Playwright intercepts routes to mock extension testing.');
  });
});
```

---

## 5. Verification Method

To verify the setup once created:
1. **Dependency Installation**:
   ```bash
   npm install
   npx playwright install chromium
   ```
2. **Unit Tests Execution**:
   Run the unit tests:
   ```bash
   npm run test:unit
   ```
   *Expected outcome*: All helper tests (formatTime, escapeHtml, decodeHtmlEntities, formatSocialMarkdown) pass.
3. **E2E Tests Execution**:
   Run the E2E tests:
   ```bash
   npm run test:e2e
   ```
   *Expected outcome*: Chromium opens, executes the mock page traversals, completes all user assertions, and exits with 100% success.
