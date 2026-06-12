# Quality Review Report

**Verdict**: REQUEST_CHANGES

---

## Findings

### [Critical] Finding 1: Interface Contract Violation (No Network Interception Listener)
- **What**: The code completely omits the implementation of the network interception interface contract.
- **Where**: `content.js` and `manifest.json`.
- **Why**: `PROJECT.md` specifies that intercepted network requests to `youtube.com/api/timedtext` must be sent from the page context to the content script using window `postMessage` (format: `{ type: 'YT_TIMEDTEXT_URL', url: string }`). However, there is no listener for this message in `content.js`, nor is there any injection mechanism to intercept these requests in the page context.
- **Suggestion**: Implement a page-context script injection (e.g., monkey-patching `XMLHttpRequest` or `fetch`) to intercept `/api/timedtext` requests and post them back to the content script. Add a `message` event listener in `content.js` to receive and process the URL.

### [Major] Finding 2: SPA Navigation Stale Data Bug in YouTube Transcript Fetching
- **What**: The primary method to fetch transcript metadata (`getPlayerResponseFromScripts()`) fails to retrieve current data after SPA navigation.
- **Where**: `content.js` (lines 943-973).
- **Why**: Script tags containing `ytInitialPlayerResponse =` are static and only populated on the initial server-rendered HTML page load. When the user navigates to a new video via YouTube's client-side router, these script tags are not updated. As a result, the widget continues to fetch and display the transcript of the first video loaded.
- **Suggestion**: Transition to the network-interception approach as required by the interface contract, or dynamically query the page-level `ytInitialPlayerResponse` variable via page-world execution.

### [Major] Finding 3: CORS Screenshot Security Error Risk
- **What**: Capturing video screenshots using canvas drawing will fail with a `SecurityError` in production.
- **Where**: `content.js` (lines 722-752).
- **Why**: YouTube video streams are loaded from the cross-origin `*.googlevideo.com` CDN. Drawing a cross-origin video frame to a `<canvas>` element and calling `canvas.toDataURL()` taints the canvas and throws a browser security exception. The E2E tests pass only because they use a local w3schools video source.
- **Suggestion**: Use the chrome extension API `chrome.tabs.captureVisibleTab` (or a similar background worker message) to capture screenshots to avoid CORS restrictions, or set `crossOrigin="anonymous"` on the video element (though this requires support from YouTube's CDN headers).

### [Major] Finding 4: CSP Download Block Risk
- **What**: Generating and clicking a `blob:` download link inside the page context is likely to be blocked by Host Page CSPs.
- **Where**: `content.js` (lines 1248-1259, 1352-1361).
- **Why**: YouTube, X, and Reddit enforce strict Content Security Policies (CSP) that frequently restrict or block `blob:` navigation and source creation.
- **Suggestion**: Send the file content to the background service worker and use the privileged `chrome.downloads` API to trigger the file download.

### [Minor] Finding 5: Precision/Rounding Bug in `formatTime`
- **What**: `formatTime` is susceptible to floating-point representation errors.
- **Where**: `helpers.js` (lines 6-17).
- **Why**: `7322.9 % 1` in JS yields `0.8999999999996362`, causing `Math.floor((secs % 1) * 100)` to evaluate to `89` (representing `.89` seconds) instead of `.90` seconds.
- **Suggestion**: Use `Math.round()` or a rounding factor (e.g. `Math.round((secs % 1) * 100)`) to avoid precision losses.

### [Minor] Finding 6: Bypassing Storage Wrapper in Export Preview
- **What**: `generateMarkdown` directly calls `chrome.storage.local.get` instead of the wrapper.
- **Where**: `content.js` (line 1181).
- **Why**: If the storage context becomes invalidated or if the environment does not have `chrome.storage.local`, this line will throw an unhandled `TypeError`, whereas the custom `storage` wrapper handles fallback and error recovery.
- **Suggestion**: Adapt the `storage` wrapper to return a Promise or handle async/await to preserve fallback integrity.

---

## Verified Claims

- **Unit tests pass** → Verified via `npm run test:unit` → **PASS**
- **E2E tests pass** → Verified via `npx playwright test --workers=1` → **PASS** (7 tests passed in 57.3s)
- **Widget loads in mock YouTube page** → Verified via Playwright assertion → **PASS**

---

## Coverage Gaps

- **SPA/Client-Side Navigation** — Risk Level: **HIGH** — The E2E tests do not cover transitioning from one video to another using page links. This is why the stale-script-tag-data bug went undetected.
- **CORS/Tainted Canvas Video Screenshotting** — Risk Level: **HIGH** — The E2E tests mock the video source with a local w3schools file instead of a cross-origin resource, failing to verify CORS canvas safety.

---

## Unverified Items

- **Behavior on live websites** — Reason: Out of scope for automated E2E test setup checking, but inferred from security standards (CORS/CSP rules).
