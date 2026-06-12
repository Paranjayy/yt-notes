# Handoff Report: Milestone 1 Verification and Strategy Proposal

## 1. Observation
We observed the following architectural configurations and lines of code:
- **Unit Tests**: Executed `npm run test:unit` yielding:
  ```
  ✓ tests/unit/helpers.test.js (5 tests) 5ms
  Test Files  1 passed (1)
  Tests  5 passed (5)
  ```
- **E2E Tests**: Executed `npx playwright test --workers=1` yielding `7 passed` across mock YouTube, X, and Reddit page contexts.
- **Interface Contract**: `PROJECT.md` specifies that:
  > Intercepted network requests to `youtube.com/api/timedtext` are sent from the page context to the content script using window postMessage. Format: `window.postMessage({ type: 'YT_TIMEDTEXT_URL', url: string })`
- **Network Interception Omission**: Neither `content.js` nor `manifest.json` contains any listener or injection code referencing `YT_TIMEDTEXT_URL`. Transcripts are loaded by reading static DOM script elements containing `ytInitialPlayerResponse =` (lines 958-974):
  ```javascript
  958:   function getPlayerResponseFromScripts() {
  959:     const scripts = document.querySelectorAll('script');
  960:     for (const script of scripts) {
  961:       const text = script.textContent;
  962:       if (text && text.includes('ytInitialPlayerResponse =')) {
  ```
- **CORS Screenshot Capture**: Capturing screenshots uses HTML5 canvas directly drawing the video frame (lines 727-732):
  ```javascript
  727:       const canvas = document.createElement('canvas');
  728:       canvas.width = video.videoWidth || video.clientWidth;
  729:       canvas.height = video.videoHeight || video.clientHeight;
  730:       const ctx = canvas.getContext('2d');
  731:       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  732:       const dataUrl = canvas.toDataURL('image/jpeg');
  ```
- **CSP Download Block Risk**: Downloads in `content.js` are triggered by creating a temporary anchor tag with a `blob:` URL (lines 1252-1259):
  ```javascript
  1252:     const blob = new Blob([md], { type: 'text/markdown' });
  1253:     const url = URL.createObjectURL(blob);
  1254:     const a = document.createElement('a');
  1255:     a.href = url;
  ...
  1258:     a.click();
  ```
- **Storage Bypass**: `generateMarkdown` calls `chrome.storage.local` directly (line 1182):
  ```javascript
  1182:     const notesData = await chrome.storage.local.get([notesKey]);
  ```
- **Time Precision Bug**: The `formatTime` helper computes milliseconds using floating point modulo (line 10):
  ```javascript
  10:   const ms = Math.floor((secs % 1) * 100);
  ```
  And `tests/unit/helpers.test.js` expects:
  ```javascript
  18:       expect(formatTime(7322.9)).toBe('2:02:02.89');
  ```

---

## 2. Logic Chain
- **Contract Violation**: The absence of any `postMessage` listener for `YT_TIMEDTEXT_URL` is a direct violation of the contract.
- **SPA Stale Data**: Script tags loaded via SSR are static. YouTube client-side SPA navigation changes the URL and video context without a full page reload, rendering script tags static and stale. As a result, the widget displays the transcript of the first video loaded, not the current one.
- **Tainted Canvas Error**: HTML5 security standards restrict exporting canvas pixels drawn from cross-origin media (`*.googlevideo.com`). In production, calling `canvas.toDataURL()` on a video canvas throws a `SecurityError` and breaks the screenshot feature.
- **CSP Download Blocks**: Strict CSPs on modern platforms like YouTube, X, and Reddit block `blob:` navigation. Page-context file downloads via blob links fail.
- **Direct Storage Bypass**: Bypassing the storage wrapper bypasses error-recovery fallbacks (like localStorage) if `chrome.storage` is unavailable.
- **Precision Loss**: Due to IEEE 754 double precision limits in JS, `7322.9 % 1` yields `0.8999999999996362`, causing `Math.floor` to evaluate to `89` instead of `90`.

---

## 3. Caveats
- No live production environments were tested due to target network isolation constraints. Code designs are constructed defensively based on known browser security constraints (CORS, CSP).
- Moving to `chrome.downloads.download` means Playwright E2E tests using `page.waitForEvent('download')` will no longer capture the download event on the page, as it executes inside the background worker scope. The E2E tests should be updated to verify data passing or mock the downloads API call.

---

## 4. Conclusion
We propose a detailed strategy to address all 6 issues. The proposed code changes are outlined below:

### Proposal 1: Permissions Update (`manifest.json`)
Add `"downloads"` and `"activeTab"` to the permissions list:
```json
  "permissions": [
    "storage",
    "downloads",
    "activeTab"
  ],
```

### Proposal 2: Background Interception and Downloads Worker (`background.js`)
Implement a message listener to fetch transcripts, capture visible tabs, and trigger downloads:
```javascript
chrome.runtime.onInstalled.addListener(() => {
  console.log("Goated Social Companion Extension installed successfully.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Capture Visible Tab (solves CORS canvas issue)
  if (message.type === 'CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true; // async response
  }

  // 2. Fetch Intercepted Timedtext URL (solves CSP fetch restrictions)
  if (message.type === 'YT_TIMEDTEXT_URL') {
    fetch(message.url)
      .then(res => res.text())
      .then(text => sendResponse({ success: true, data: text }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  // 3. Trigger Download (solves CSP blob blocks)
  if (message.type === 'DOWNLOAD_FILE') {
    let downloadUrl = message.url;
    if (!downloadUrl && message.content) {
      downloadUrl = 'data:' + (message.contentType || 'text/plain') + ';charset=utf-8,' + encodeURIComponent(message.content);
    }
    chrome.downloads.download({
      url: downloadUrl,
      filename: message.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true; // async response
  }
});
```

### Proposal 3: Time Precision Bug Fix (`helpers.js`)
Rewrite `formatTime` using centiseconds to bypass IEEE 754 precision issues:
```javascript
function formatTime(secs) {
  const totalCentiseconds = Math.round(secs * 100);
  const h = Math.floor(totalCentiseconds / 360000);
  const m = Math.floor((totalCentiseconds % 360000) / 6000);
  const s = Math.floor((totalCentiseconds % 6000) / 100);
  const ms = totalCentiseconds % 100;
  
  const msStr = ms.toString().padStart(2, '0');
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${msStr}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}.${msStr}`;
}
```
*Note: Also update line 18 of `tests/unit/helpers.test.js` to expect `'2:02:02.90'` for `formatTime(7322.9)`.*

### Proposal 4: Network Interception & SPA Navigation Stale Data Bug (`content.js`)
Inject a page-world script to intercept `/api/timedtext` network requests and monitor `ytInitialPlayerResponse` changes:
```javascript
  // --- Page Context Injection ---
  function injectPageContextInterception() {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        // Intercept XMLHttpRequest
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
          if (typeof url === 'string' && (url.includes('/api/timedtext') || url.includes('youtube.com/api/timedtext'))) {
            window.postMessage({ type: 'YT_TIMEDTEXT_URL', url: url }, '*');
          }
          return origOpen.apply(this, arguments);
        };

        // Intercept fetch
        const origFetch = window.fetch;
        window.fetch = async function(input, init) {
          const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
          if (url && (url.includes('/api/timedtext') || url.includes('youtube.com/api/timedtext'))) {
            window.postMessage({ type: 'YT_TIMEDTEXT_URL', url: url }, '*');
          }
          return origFetch.apply(this, arguments);
        };

        // Intercept ytInitialPlayerResponse updates
        let playerResponse = window.ytInitialPlayerResponse;
        Object.defineProperty(window, 'ytInitialPlayerResponse', {
          get() { return playerResponse; },
          set(newVal) {
            playerResponse = newVal;
            if (newVal) {
              window.postMessage({ type: 'YT_PLAYER_RESPONSE', playerResponse: newVal }, '*');
            }
          },
          configurable: true
        });

        function postCurrentPlayerResponse() {
          if (window.ytInitialPlayerResponse) {
            window.postMessage({ type: 'YT_PLAYER_RESPONSE', playerResponse: window.ytInitialPlayerResponse }, '*');
          }
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          postCurrentPlayerResponse();
        } else {
          window.addEventListener('DOMContentLoaded', postCurrentPlayerResponse);
        }

        document.addEventListener('yt-navigate-finish', postCurrentPlayerResponse);
        document.addEventListener('yt-page-data-updated', postCurrentPlayerResponse);
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }
```

Then, in `content.js`, setup listeners to receive the posted messages, and use them to fetch transcripts dynamically on URL updates:
```javascript
  let latestPlayerResponse = null;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data) {
      if (event.data.type === 'YT_PLAYER_RESPONSE') {
        latestPlayerResponse = event.data.playerResponse;
        const responseVideoId = latestPlayerResponse?.videoDetails?.videoId;
        if (responseVideoId && responseVideoId === currentVideoId) {
          fetchYouTubeTranscript();
        }
      } else if (event.data.type === 'YT_TIMEDTEXT_URL') {
        const timedtextUrl = event.data.url;
        if (timedtextUrl.includes(currentVideoId) || timedtextUrl.includes('v=' + currentVideoId)) {
          chrome.runtime.sendMessage({ type: 'YT_TIMEDTEXT_URL', url: timedtextUrl }, (response) => {
            if (response && response.success) {
              parseAndLoadTranscript(response.data);
            }
          });
        }
      }
    }
  });

  function parseAndLoadTranscript(text) {
    try {
      if (text.trim().startsWith('{')) {
        const data = JSON.parse(text);
        if (data.events) {
          ytCaptions = data.events
            .filter(e => e.segs)
            .map(e => ({
              start: e.tStartMs / 1000,
              duration: (e.dDurationMs || 0) / 1000,
              text: decodeHtmlEntities(e.segs.map(s => s.utf8).join(''))
            }));
          renderTranscript();
        }
      } else {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const textNodes = xmlDoc.getElementsByTagName('text');
        ytCaptions = Array.from(textNodes).map(node => ({
          start: parseFloat(node.getAttribute('start')),
          duration: parseFloat(node.getAttribute('dur')) || 0.0,
          text: decodeHtmlEntities(node.textContent)
        }));
        renderTranscript();
      }
    } catch (e) {
      console.error("Failed to parse intercepted transcript data", e);
      scrapeNativeYouTubeTranscript();
    }
  }

  function fetchYouTubeTranscript() {
    ytCaptions = [];
    let playerResponse = latestPlayerResponse || getPlayerResponseFromScripts();
    if (playerResponse && playerResponse.captions && playerResponse.captions.playerCaptionsTracklistRenderer && playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks) {
      const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      loadTranscriptFromTracks(tracks);
    } else {
      scrapeNativeYouTubeTranscript();
    }
  }
```

Inject this helper at the initialization:
```javascript
  const host = location.hostname;
  if (host.includes('youtube.com')) {
    injectPageContextInterception();
    initYouTubeWatcher();
  }
```

And in `onYouTubeUrlChange()` reset the stale response:
```javascript
  function onYouTubeUrlChange() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');

    if (videoId) {
      currentVideoId = videoId;
      latestPlayerResponse = null; // Reset
      injectYouTubeWidget();
      injectTimelineMarkers();
      fetchYouTubeTranscript();
    }
  }
```

### Proposal 5: CORS-Safe Screenshot Capture (`content.js`)
Modify `capturePlayerScreenshot` to fetch the visible tab, crop it with a local canvas, and trigger download:
```javascript
  function capturePlayerScreenshot() {
    const video = document.querySelector('video');
    if (!video) return;

    const rect = video.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, (response) => {
      if (response && response.success && response.dataUrl) {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = rect.width;
            canvas.height = rect.height;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(
              img,
              rect.left * dpr,
              rect.top * dpr,
              rect.width * dpr,
              rect.height * dpr,
              0,
              0,
              rect.width,
              rect.height
            );
            
            const croppedDataUrl = canvas.toDataURL('image/jpeg');
            
            screenshotList.unshift(croppedDataUrl);
            if (screenshotList.length > 5) screenshotList.pop();
            renderScreenshotsList();
            
            const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.innerText || "youtube";
            const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const time = video ? Math.floor(video.currentTime) : 0;
            const filename = `screenshot_${cleanTitle}_${time}s.jpg`;
            
            chrome.runtime.sendMessage({
              type: 'DOWNLOAD_FILE',
              url: croppedDataUrl,
              filename: filename
            });
          } catch (err) {
            console.error("Failed to crop screenshot", err);
          }
        };
        img.src = response.dataUrl;
      } else {
        console.error("Background screenshot capture failed", response?.error);
      }
    });
  }
```

### Proposal 6: Promise-Supporting Storage Wrapper & Direct Storage Bypass Fix (`content.js`)
Update the bulletproof storage wrapper definition in `content.js` to return Promises when callbacks are omitted, then update the call inside `generateMarkdown`:
```javascript
  // Bulletproof Storage Wrapper
  const storage = {
    get: (keys, callback) => {
      const runGet = (resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, (data) => {
            if (chrome.runtime.lastError) {
              fallbackGet(keys, (res) => {
                if (callback) callback(res);
                if (resolve) resolve(res);
              });
            } else {
              if (callback) callback(data);
              if (resolve) resolve(data);
            }
          });
        } else {
          fallbackGet(keys, (res) => {
            if (callback) callback(res);
            if (resolve) resolve(res);
          });
        }
      };
      if (callback) {
        runGet();
      } else {
        return new Promise((resolve) => runGet(resolve));
      }
    },
    set: (items, callback) => {
      const runSet = (resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(items, () => {
            if (chrome.runtime.lastError) {
              fallbackSet(items, () => {
                if (callback) callback();
                if (resolve) resolve();
              });
            } else {
              if (callback) callback();
              if (resolve) resolve();
            }
          });
        } else {
          fallbackSet(items, () => {
            if (callback) callback();
            if (resolve) resolve();
          });
        }
      };
      if (callback) {
        runSet();
      } else {
        return new Promise((resolve) => runSet(resolve));
      }
    }
  };
```

Update `generateMarkdown()` to use `storage.get`:
```javascript
  async function generateMarkdown() {
    const meta = extractYouTubeMetadata();
    const notesKey = `sc_notes_${currentVideoId}`;
    const notesData = await storage.get([notesKey]); // Uses wrapper!
    const notes = notesData[notesKey] || [];
```

### Proposal 7: CSP-Safe Markdown Downloads (`content.js`)
Update `downloadMarkdownFile()` (for YouTube) and the `#sc-social-btn-dl` click listener (for Reddit/X):

**YouTube Markdown Download**:
```javascript
  async function downloadMarkdownFile() {
    const md = await generateMarkdown();
    const meta = extractYouTubeMetadata();
    const filename = `${meta.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.md`;
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      content: md,
      contentType: 'text/markdown',
      filename: filename
    });
  }
```

**Reddit/X Markdown Download**:
```javascript
    panel.querySelector('#sc-social-btn-dl').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_FILE',
        content: md,
        contentType: 'text/markdown',
        filename: `${platform}_scraped_post.md`
      });
    });
```

---

## 5. Verification Method
1. Run Unit Tests: `npm run test:unit` to verify `helpers.js` works and the updated vitest tests in `tests/unit/helpers.test.js` pass.
2. Run E2E Tests: `npx playwright test --workers=1` to verify E2E suite passes.
3. Validate layout compliance: The extension's metadata files are in `.agents/` and code files are kept in the root directory.
4. Verify lack of `SecurityError` and CSP blocks in browser console logs during screenshot capture or markdown download on youtube.com, x.com, or reddit.com.
