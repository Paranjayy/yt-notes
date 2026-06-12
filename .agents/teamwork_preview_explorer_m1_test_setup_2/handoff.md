# Handoff Report - Testing Setup Investigation

## 1. Observation

### System Environment
Checking the system for Node.js and npm via `node -v && npm -v` returned:
- Node.js: `v25.9.0`
- npm: `11.12.1`

### Code Structure
- **Root Directory Contents**: `background.js`, `content.js`, `manifest.json`.
- **Encapsulation in `content.js`**: The content script is wrapped in a top-level Immediately Invoked Function Expression (IIFE):
  - Line 4: `(function () {`
  - Line 5: `  'use strict';`
  - Line 1426: `})();`
- **Helper Functions in `content.js`**:
  - `formatTime(secs)` (Lines 768-779):
    ```javascript
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
    ```
  - `escapeHtml(text)` (Lines 1409-1418):
    ```javascript
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
    ```
  - `decodeHtmlEntities(str)` (Lines 1420-1424):
    ```javascript
    function decodeHtmlEntities(str) {
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      return txt.value;
    }
    ```
- **DOM Dependencies**: `decodeHtmlEntities` invokes `document.createElement('textarea')` to decode HTML entities using the browser parser.

### Scraper Selector Targets
- **YouTube Metadata**:
  - Title: `h1.ytd-watch-metadata yt-formatted-string` or `document.title`
  - Channel: `ytd-video-owner-renderer #channel-name a`
  - Subscribers: `ytd-video-owner-renderer #owner-sub-count`
  - Views: `#info-container #info span` or `ytd-watch-info-text #info span`
  - Description: `ytd-text-inline-expander span` or `#description-inline-expander span`
  - Comments count: `ytd-comments #title`
  - Recommendation items: `ytd-compact-video-renderer`
  - Playlist details: `ytd-playlist-panel-renderer #title-container #title` and URL parameter `list`
- **X (Twitter)**:
  - Author: `[data-testid="User-Name"] span`
  - Tweet Text: `[data-testid="tweetText"]`
  - Stats: `[data-testid="reply"]`, `[data-testid="retweet"]`, `[data-testid="like"]`
- **Reddit**:
  - Title: `shreddit-title` (`title` attribute)
  - Author: `a[href*="/user/"]`
  - Content Text: `div[id*="-post-rtjson-content"]`

---

## 2. Logic Chain

1. **Unit Testing Isolation**:
   - Because `content.js` is wrapped in an IIFE, helper functions like `formatTime` and `escapeHtml` cannot be imported directly into a test runner like Vitest.
   - Simply modifying `content.js` to use ES modules (`export`) would break the browser execution because Chrome Extensions do not support ES module content scripts natively without complex build-bundler pipelines (e.g., Vite/Rollup) or registering scripts as `"type": "module"` in `manifest.json`.
   - To keep the extension vanilla and highly testable, we should extract these helper functions into a separate `helpers.js` file and include it in `manifest.json`'s content script array: `"js": ["helpers.js", "content.js"]`.
   - In `helpers.js`, we can conditionally check `typeof module !== 'undefined'` to export them for Node/Vitest, while binding them to the `window` object for content script execution. This avoids running the rest of `content.js` (which sets intervals and manipulates page-specific DOM structures) during unit tests.

2. **DOM Environment Requirement**:
   - Since `decodeHtmlEntities` relies on `document.createElement`, running tests in a standard Node.js environment will throw a reference error (`document is not defined`).
   - Therefore, Vitest must be configured with a browser-like DOM environment using `jsdom` or `happy-dom`.

3. **E2E Extension Loading**:
   - To test Chrome extensions, browser automation tool configs must load the extension unpacked. Playwright supports this via `chromium.launchPersistentContext` by passing `--load-extension` and `--disable-extensions-except` arguments.
   - Crucially, Chrome extensions are NOT supported in headless mode (headless browser launches). The E2E tests must launch Chromium with `headless: false`.

4. **Page Mocking for Web Independence**:
   - Running E2E tests against live YouTube, X, or Reddit pages is slow, brittle (DOM changes break tests), subject to CAPTCHAs, and depends on external network connectivity (which is disabled in our environment).
   - Using Playwright's `page.route` feature, we can intercept network requests targeting `youtube.com`, `x.com`, and `reddit.com`, and serve minimal, locally defined HTML containing the expected DOM structures and JSON script states.
   - The browser registers the page under the authentic origin (e.g., `https://www.youtube.com`), triggering the extension content script matches automatically. This provides deterministic, high-speed, offline-capable E2E coverage.

---

## 3. Caveats

- **Headful E2E Requirement**: Because Chrome extensions require headful browser mode, running E2E tests on headless CI environments (like GitHub Actions runners) will require setting up virtual framebuffers (e.g., running tests using `xvfb-run` on Linux).
- **DOM Structure Desynchronization**: Our E2E tests mock the target site selectors. If YouTube, X, or Reddit modifies their production DOM structure, the mock pages must be updated accordingly to match the selectors used by the content script scrapers.
- **LocalStorage Fallbacks**: The storage API wrapper in `content.js` falls back to `localStorage` if `chrome.storage.local` fails. Our E2E tests verify behavior assuming `chrome.storage.local` is present in the extension context.

---

## 4. Conclusion

The Social Companion extension can be thoroughly tested using:
1. **Vitest** + **jsdom** for unit testing pure utility helpers.
2. **Playwright** (running headful Chromium) for E2E testing of the extension.
3. **`page.route` Route Interception** to feed the content script mock pages corresponding to YouTube, X, and Reddit.
4. **Helpers Extraction** to a separate file (`helpers.js`) to facilitate clean module exports for Vitest unit tests.

To make implementing this setup trivial, the following proposed files have been created in the working directory:
- `proposed_package.json`: Configured with `vitest` and `@playwright/test` dependencies and test execution scripts.
- `proposed_vitest.config.js`: Configured with the `jsdom` test environment.
- `proposed_playwright.config.js`: Configured for Chromium extension testing with `headless: false`.
- `proposed_helpers.js`: The extracted helper functions, formatted with dual-mode exports (CommonJS / global namespace).
- `proposed_helpers.test.js`: Vitest unit tests verifying `formatTime`, `escapeHtml`, and `decodeHtmlEntities`.
- `proposed_mock-pages.js`: Playwright network route mocks defining the expected HTML structures for YouTube, X, and Reddit.
- `proposed_youtube.spec.js`: Playwright E2E spec verifying notes management, screenshot downloads, playlist metadata, and transcript parsing.
- `proposed_twitter.spec.js` & `proposed_reddit.spec.js`: Playwright E2E specs for the floating companion panels and scrapers.
- `proposed_manifest.json`: Shows the integration of `helpers.js` in the content scripts.

---

## 5. Verification Method

To independently verify the test setup:
1. Copy the proposed files to the project root:
   ```bash
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_package.json ./package.json
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_vitest.config.js ./vitest.config.js
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_playwright.config.js ./playwright.config.js
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_helpers.js ./helpers.js
   
   mkdir -p tests/unit tests/e2e/helpers
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_helpers.test.js ./tests/unit/helpers.test.js
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_mock-pages.js ./tests/e2e/helpers/mock-pages.js
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_youtube.spec.js ./tests/e2e/youtube.spec.js
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_twitter.spec.js ./tests/e2e/twitter.spec.js
   cp .agents/teamwork_preview_explorer_m1_test_setup_2/proposed_reddit.spec.js ./tests/e2e/reddit.spec.js
   ```
2. Update the main `manifest.json` to load `helpers.js` before `content.js`:
   - Replace the `"js": ["content.js"]` line in `manifest.json` with `"js": ["helpers.js", "content.js"]`.
3. Update `content.js` to remove the local definitions of `formatTime`, `escapeHtml`, and `decodeHtmlEntities`, as they are now provided by `helpers.js`.
4. Install dependencies and run tests:
   ```bash
   npm install
   npx playwright install chromium
   
   # Run Unit Tests
   npm run test:unit
   
   # Run E2E Tests (requires headful window)
   npm run test:e2e
   ```
5. **Invalidation Condition**: If the unit or E2E tests fail or throw undefined function errors, the manifest updates, helper exports, or DOM mocks are invalid.
