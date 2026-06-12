# Adversarial Challenge Report

**Overall Risk Assessment**: HIGH

---

## Challenges

### [Critical] Challenge 1: Video Transition in SPA Causes Stale Metadata / Transcripts
- **Assumption Challenged**: The content script assumes that parsing static `<script>` tags for `ytInitialPlayerResponse` is sufficient for fetching video transcripts.
- **Attack Scenario**: User loads video A (with transcript). Content script parses Video A transcript. User then clicks on a recommendation link to navigate to video B. YouTube transitions to Video B dynamically without doing a full-page reload. The `<script>` tag in the DOM remains the one loaded for video A.
- **Blast Radius**: The widget displays the transcript, metadata, and playlist details of video A while the user is watching video B. Any notes the user takes will be linked to Video B's ID but their exported markdown will contain Video A's transcript and metadata.
- **Mitigation**: Implement the window `postMessage` network interception scheme (as defined in `PROJECT.md` interface contract) or inject a script into the page context that polls or intercepts `ytInitialPlayerResponse` changes and posts the current data to the content script.

### [High] Challenge 2: Production Video Stream Taints Canvas
- **Assumption Challenged**: Using `<canvas>` to capture video frames and retrieve data URLs is safe and functional for screenshots.
- **Attack Scenario**: Real YouTube video sources are served from domains matching `*.googlevideo.com`, which is cross-origin to `youtube.com`. When `ctx.drawImage(video, 0, 0)` is called, the canvas is marked as tainted. Calling `canvas.toDataURL()` immediately throws:
  `SecurityError: Failed to execute 'toDataURL' on 'HTMLCanvasElement': The canvas has been tainted by cross-origin data.`
- **Blast Radius**: The screenshot button will fail completely in production and log an error to the console. No screenshot will be saved or downloaded.
- **Mitigation**: Implement screenshotting via the extension's background worker using `chrome.tabs.captureVisibleTab`, which is immune to CORS constraints because it runs in a privileged scope.

### [High] Challenge 3: Page CSP Blocks Blob Download Links
- **Assumption Challenged**: Injecting a `<a>` tag with a `blob:` URL as `href` and calling `a.click()` will download the file successfully.
- **Attack Scenario**: Modern web applications like X (Twitter) or Reddit implement strict Content Security Policies (`default-src` or `sandbox` directives) that restrict the loading or creation of `blob:` resources. Clicking the download button results in a browser CSP block.
- **Blast Radius**: The download buttons for exported markdown will be blocked by the browser in production.
- **Mitigation**: Communicate the file contents to the background service worker via `chrome.runtime.sendMessage` and trigger the download using `chrome.downloads.download`.

### [Medium] Challenge 4: Floating Point Precision Loss in formatting
- **Assumption Challenged**: Subtracting `Math.floor(secs)` and multiplying by 100 will always yield correct milliseconds.
- **Attack Scenario**: In JavaScript, `7322.9 % 1` produces `0.8999999999996362`.
- **Blast Radius**: The formatted time shows `2:02:02.89` instead of `2:02:02.90`.
- **Mitigation**: Use a rounding method like `Math.round((secs % 1) * 100)` or standard formatting libraries/custom logic that handles floating point error.

---

## Stress Test Results

- **Run Playwright E2E Tests** → All 7 tests pass under ideal mocked page conditions (no CSP, no cross-origin video, no SPA transitions) → **PASS**
- **Test SPA Navigation Scenario** → Predict fail because script tags containing player response are static → **FAIL**
- **Test Cross-Origin Video Capture** → Predict fail because of Canvas security exceptions (tainted canvas) → **FAIL**
- **Test Host Page CSP limits** → Predict fail if hosts block `blob:` navigation → **FAIL**

---

## Unchallenged Areas

- **Storage performance/quota limits** — Not stress-tested since we did not write large amounts of data to `chrome.storage.local`.
- **Concurrency conflicts** — The playwright tests are run with `--workers=1` which prevents checking concurrent storage edits, though in actual usage, multiple tabs could edit storage simultaneously.
