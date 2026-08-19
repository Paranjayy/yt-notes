# Popup Playlist Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three YouTube features to the extension popup: (1) a "Go to Uploads" button replacing the bookmarklet, (2) a consolidated view of all saved playlist/queue backups with metadata, and (3) batch transcript extraction from playlist/queue videos.

**Architecture:** Extend the existing popup (dist/popup.html + dist/popup.js) with new UI sections. Add message handlers in dist/content.js and dist/background.js for channel ID extraction and playlist backup listing. The popup communicates with content scripts via `chrome.tabs.sendMessage` and with background via `chrome.runtime.sendMessage`, following existing patterns.

**Tech Stack:** Vanilla JavaScript, Chrome Extension Manifest V3, `chrome.storage.local`, `chrome.tabs`, `chrome.scripting`. No new dependencies.

## File Structure

| File | Role |
|---|---|
| `dist/popup.html` | Add 3 new card sections: Uploads shortcut, Playlist hub, Batch transcript |
| `dist/popup.js` | Add logic for channel ID extraction, playlist backup listing, transcript batching |
| `dist/content.js` | Add `sc_get_channel_id` message handler (extracts channel ID from page) |
| `dist/background.js` | Add `sc_list_playlist_backups` handler (reads all playlist backup keys from storage) |
| `dist/manifest.json` | No changes needed (existing permissions cover everything) |

## Global Constraints

- All code is vanilla JS (no frameworks, no build step for dist/)
- Follow existing dark-mode glassmorphism CSS variables (`--sc-primary`, `--sc-bg-dark`, etc.)
- All storage uses `chrome.storage.local` with `sc_` prefix keys
- Popup width is 330px, all UI must fit within that constraint
- Playlist backup data lives in `sc_playlist_backup_{playlistId}` keys
- Transcript data lives in `sc_transcript_{videoId}` keys
- Work directly in `dist/` files (the active extension codebase)

---

### Task 1: Add "Go to Uploads" button to popup

**Files:**
- Modify: `dist/popup.html` — add a new card after the page status card
- Modify: `dist/popup.js` — add channel ID extraction logic and click handler
- Modify: `dist/content.js` — add `sc_get_channel_id` message handler

**Interfaces:**
- Consumes: Active YouTube tab (detected via `chrome.tabs.query`)
- Produces: Opens `https://www.youtube.com/playlist?list=UU{channelIdsubstr(2)}` in a new tab

- [ ] **Step 1: Add "sc_get_channel_id" message handler in dist/content.js**

Find the `chrome.runtime.onMessage.addListener` block (around line 643). Add a new handler before the existing `sc_get_capture_status` handler:

```javascript
if (message.type === "sc_get_channel_id") {
  let cid = null;
  // Method 1: ytInitialData
  try {
    if (window.ytInitialData?.metadata?.channelMetadataRenderer?.externalId) {
      cid = window.ytInitialData.metadata.channelMetadataRenderer.externalId;
    }
  } catch (e) {}
  // Method 2: meta itemprop
  if (!cid) {
    const m = document.querySelector('meta[itemprop="channelId"]');
    if (m) cid = m.content;
  }
  // Method 3: canonical link
  if (!cid) {
    const c = document.querySelector('link[rel="canonical"]');
    if (c) {
      const p = c.href.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
      if (p) cid = p[1];
    }
  }
  // Method 4: channel name link
  if (!cid) {
    const a = document.querySelector('ytd-channel-name a, ytd-video-owner-renderer a, #owner-name a');
    if (a) {
      const p = a.href.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
      if (p) cid = p[1];
    }
  }
  sendResponse({ ok: Boolean(cid), channelId: cid });
}
```

- [ ] **Step 2: Add "Go to Uploads" card in dist/popup.html**

Insert after the page status card (after line 16, the `<div class="card">` with id `pageTitle`):

```html
<div class="card" id="uploadsCard" hidden>
  <span class="prompt-label">Channel Uploads</span>
  <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
    <span id="uploadsChannelName" style="flex:1;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
    <button class="btn" id="goToUploads" style="white-space:nowrap;">Go to Uploads</button>
  </div>
</div>
```

- [ ] **Step 3: Add uploads logic in dist/popup.js**

Add after the `refreshStatus` function (around line 54). Insert before the `pageContextLimit` function:

```javascript
async function checkUploadsShortcut() {
  const card = document.getElementById('uploadsCard');
  const nameEl = document.getElementById('uploadsChannelName');
  try {
    const tab = await activeTab();
    if (!tab?.url || !tab.url.includes('youtube.com')) {
      card.hidden = true;
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'sc_get_channel_id' }).catch(() => null);
    if (response?.ok && response.channelId) {
      card.hidden = false;
      nameEl.textContent = response.channelId;
      // Try to get channel name from page
      const nameResponse = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const el = document.querySelector('ytd-channel-name #channel-name, #owner-name a, ytd-video-owner-renderer a');
          return el?.textContent?.trim() || '';
        },
      }).catch(() => null);
      if (nameResponse?.[0]?.result) nameEl.textContent = nameResponse[0].result;
    } else {
      card.hidden = true;
    }
  } catch {
    card.hidden = true;
  }
}
```

Add the click handler at the bottom of popup.js, near the other event listeners:

```javascript
document.getElementById('goToUploads').addEventListener('click', async () => {
  try {
    const tab = await activeTab();
    if (!tab?.id) return setStatus('No active tab.', 'error');
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'sc_get_channel_id' });
    if (!response?.ok || !response.channelId) return setStatus('Could not find channel ID.', 'error');
    const uploadsUrl = `https://www.youtube.com/playlist?list=UU${response.channelId.substr(2)}`;
    chrome.tabs.create({ url: uploadsUrl });
    setStatus('Opening uploads playlist…', 'success');
  } catch (e) {
    setStatus('Could not find channel ID. Open a video or channel page first.', 'error');
  }
});
```

Add `checkUploadsShortcut()` call inside `refreshStatus()` at the end, and also call it on load:

```javascript
// At end of refreshStatus function, before the closing brace:
await checkUploadsShortcut();
```

- [ ] **Step 4: Test the uploads shortcut**

1. Load the extension in Chrome
2. Open any YouTube video page
3. Click the extension icon to open popup
4. Verify the "Channel Uploads" card appears with channel name
5. Click "Go to Uploads" and verify it opens the channel's uploads playlist

---

### Task 2: Add Playlist Hub section to popup

**Files:**
- Modify: `dist/popup.html` — add playlist hub card
- Modify: `dist/popup.js` — add playlist backup listing logic
- Modify: `dist/background.js` — add `sc_list_playlist_backups` handler

**Interfaces:**
- Consumes: `chrome.storage.local` keys matching `sc_playlist_backup_*`
- Produces: Renders a scrollable list of saved playlists with video count and title

- [ ] **Step 1: Add playlist backup listing handler in dist/background.js**

Add inside the `chrome.runtime.onMessage.addListener` block, before the `sc_download_archive_file` handler (around line 120):

```javascript
if (msg.type === "sc_list_playlist_backups") {
  chrome.storage.local.get(null).then((all) => {
    const backups = [];
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith("sc_playlist_backup_")) continue;
      if (!value || typeof value !== "object") continue;
      const playlistId = key.replace("sc_playlist_backup_", "");
      const itemCount = Array.isArray(value.items) ? value.items.length : 0;
      const collectedCount = Array.isArray(value.items)
        ? value.items.filter((item) => item.transcriptCollection?.collectedAt).length
        : 0;
      const totalDuration = Array.isArray(value.items)
        ? value.items.reduce((sum, item) => {
            const d = item.duration || "";
            const parts = d.split(":").map(Number);
            if (parts.length === 3) return sum + parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return sum + parts[0] * 60 + parts[1];
            return sum;
          }, 0)
        : 0;
      backups.push({
        playlistId,
        title: value.title || "Untitled Playlist",
        url: value.url || `https://www.youtube.com/playlist?list=${playlistId}`,
        itemCount,
        collectedCount,
        totalDuration,
        exportedAt: value.exportedAt || null,
        source: value.source || "visible",
      });
    }
    backups.sort((a, b) => {
      if (a.exportedAt && b.exportedAt) return new Date(b.exportedAt) - new Date(a.exportedAt);
      if (a.exportedAt) return -1;
      if (b.exportedAt) return 1;
      return 0;
    });
    sendResponse({ ok: true, backups });
  }).catch((error) => sendResponse({ ok: false, reason: error?.message || "Could not list playlist backups.", backups: [] }));
  return true;
}
```

- [ ] **Step 2: Add playlist hub card in dist/popup.html**

Insert a new card after the uploads card (from Task 1):

```html
<div class="card" id="playlistHubCard">
  <span class="prompt-label">Saved Playlists & Queues</span>
  <div id="playlistHubList" style="max-height:180px;overflow-y:auto;margin-top:6px;">
    <span class="history-empty">Loading saved playlists…</span>
  </div>
</div>
```

- [ ] **Step 3: Add playlist hub rendering logic in dist/popup.js**

Add this function near the other render functions:

```javascript
async function renderPlaylistHub() {
  const root = document.getElementById('playlistHubList');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'sc_list_playlist_backups' });
    const backups = response?.backups || [];
    if (!backups.length) {
      root.innerHTML = '<span class="history-empty">No saved playlists yet. Open a playlist and use the page widget to collect videos.</span>';
      return;
    }
    root.innerHTML = '';
    backups.forEach((backup) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'flex-start';
      item.style.gap = '3px';
      item.style.cursor = 'pointer';
      item.title = `Open ${backup.title}`;

      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;';
      const titleSpan = document.createElement('span');
      titleSpan.style.cssText = 'flex:1;font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      titleSpan.textContent = backup.title;
      titleRow.appendChild(titleSpan);

      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'font-size:10px;color:var(--muted);display:flex;gap:8px;width:100%;';
      const vidCount = document.createElement('span');
      vidCount.textContent = `${backup.itemCount} vids`;
      metaRow.appendChild(vidCount);

      if (backup.collectedCount > 0) {
        const transcriptBadge = document.createElement('span');
        transcriptBadge.style.color = 'var(--good)';
        transcriptBadge.textContent = `${backup.collectedCount} transcripts`;
        metaRow.appendChild(transcriptBadge);
      }

      if (backup.totalDuration > 0) {
        const durationSpan = document.createElement('span');
        const h = Math.floor(backup.totalDuration / 3600);
        const m = Math.floor((backup.totalDuration % 3600) / 60);
        const s = backup.totalDuration % 60;
        durationSpan.textContent = h > 0
          ? `${h}h ${m}m`
          : m > 0 ? `${m}m ${s}s` : `${s}s`;
        metaRow.appendChild(durationSpan);
      }

      if (backup.exportedAt) {
        const dateSpan = document.createElement('span');
        dateSpan.textContent = new Date(backup.exportedAt).toLocaleDateString();
        metaRow.appendChild(dateSpan);
      }

      item.append(titleRow, metaRow);
      item.addEventListener('click', () => {
        chrome.tabs.create({ url: backup.url });
      });
      root.appendChild(item);
    });
  } catch {
    root.innerHTML = '<span class="history-empty">Could not load playlist backups.</span>';
  }
}
```

Call `renderPlaylistHub()` on popup load (add near the other render calls at the bottom):

```javascript
renderPlaylistHub();
```

- [ ] **Step 4: Test playlist hub**

1. Open a YouTube playlist page
2. Use the "Load all videos" button in the playlist widget to collect items
3. Click "JSON" to save a backup
4. Reopen the popup and verify the playlist appears in "Saved Playlists & Queues"
5. Verify video count, transcript count, and duration are shown correctly
6. Click a playlist entry and verify it opens the playlist URL

---

### Task 3: Add Batch Transcript Extraction to popup

**Files:**
- Modify: `dist/popup.html` — add batch transcript card with controls
- Modify: `dist/popup.js` — add batch transcript logic (select videos, copy transcripts)
- Modify: `dist/content.js` — add `sc_get_playlist_videos` handler (returns current playlist items with transcript status)

**Interfaces:**
- Consumes: Current playlist page context, `sc_playlist_backup_*` storage, `sc_transcript_*` storage
- Produces: Copies selected/all transcripts to clipboard as formatted text

- [ ] **Step 1: Add playlist video listing handler in dist/content.js**

Add inside the `chrome.runtime.onMessage.addListener` block, after the `sc_collect_visible_playlist_transcripts` handler:

```javascript
if (message.type === "sc_get_playlist_videos") {
  const listId = new URL(window.location.href).searchParams.get("list");
  if (!listId) {
    sendResponse({ ok: false, reason: "Not on a playlist page.", videos: [] });
    return;
  }
  const backupKey = `sc_playlist_backup_${listId}`;
  chrome.storage.local.get([backupKey]).then((stored) => {
    const backup = stored[backupKey];
    const items = Array.isArray(backup?.items) ? backup.items : [];
    sendResponse({
      ok: true,
      playlistId: listId,
      title: backup?.title || document.querySelector("ytd-playlist-header-renderer #title, ytd-playlist-header-renderer h1")?.innerText?.trim() || "Playlist",
      videos: items.map((item) => ({
        videoId: item.videoId,
        title: item.title,
        position: item.position,
        hasTranscript: Boolean(item.transcriptCollection?.collectedAt && item.transcriptCollection?.segments?.length),
        transcriptSegments: item.transcriptCollection?.segments || [],
      })),
    });
  }).catch((error) => sendResponse({ ok: false, reason: error?.message || "Could not load playlist.", videos: [] }));
  return true;
}
```

- [ ] **Step 2: Add batch transcript card in dist/popup.html**

Insert after the playlist hub card:

```html
<div class="card" id="batchTranscriptCard" hidden>
  <span class="prompt-label">Batch Transcript Extract</span>
  <div id="batchTranscriptStatus" style="font-size:11px;color:var(--muted);margin-bottom:8px;">Open a playlist to extract transcripts.</div>
  <div id="batchTranscriptList" style="max-height:200px;overflow-y:auto;margin-bottom:8px;"></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;">
    <button class="btn" id="selectAllVideos" style="font-size:11px;">Select All</button>
    <button class="btn" id="deselectAllVideos" style="font-size:11px;">Deselect All</button>
    <button class="btn primary" id="copySelectedTranscripts" style="font-size:11px;">Copy Selected</button>
    <button class="btn" id="copyAllTranscripts" style="font-size:11px;">Copy All</button>
  </div>
</div>
```

- [ ] **Step 3: Add batch transcript logic in dist/popup.js**

Add these functions and event handlers:

```javascript
let currentPlaylistVideos = [];

async function checkBatchTranscriptContext() {
  const card = document.getElementById('batchTranscriptCard');
  const statusEl = document.getElementById('batchTranscriptStatus');
  try {
    const tab = await activeTab();
    if (!tab?.url || !tab.url.includes('youtube.com/playlist')) {
      card.hidden = true;
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'sc_get_playlist_videos' }).catch(() => null);
    if (!response?.ok || !response.videos?.length) {
      card.hidden = false;
      statusEl.textContent = 'Collect videos in the playlist widget first.';
      document.getElementById('batchTranscriptList').innerHTML = '';
      currentPlaylistVideos = [];
      return;
    }
    card.hidden = false;
    currentPlaylistVideos = response.videos;
    statusEl.textContent = `${response.title} — ${response.videos.length} videos`;
    renderBatchTranscriptList(response.videos);
  } catch {
    card.hidden = true;
  }
}

function renderBatchTranscriptList(videos) {
  const root = document.getElementById('batchTranscriptList');
  root.innerHTML = '';
  videos.forEach((video, index) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;cursor:pointer;border-bottom:1px solid var(--line);';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = video.hasTranscript;
    checkbox.disabled = !video.hasTranscript;
    checkbox.dataset.videoIndex = index;
    const titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    titleSpan.textContent = video.title || `Video ${video.position}`;
    const badge = document.createElement('span');
    badge.style.cssText = `font-size:10px;color:${video.hasTranscript ? 'var(--good)' : 'var(--muted)'};`;
    badge.textContent = video.hasTranscript ? '✓' : 'no transcript';
    row.append(checkbox, titleSpan, badge);
    root.appendChild(row);
  });
}

function getSelectedVideoIndices() {
  const checkboxes = document.querySelectorAll('#batchTranscriptList input[type="checkbox"]:checked');
  return Array.from(checkboxes).map((cb) => Number.parseInt(cb.dataset.videoIndex, 10));
}

function formatTranscriptForClipboard(segments, video) {
  if (!segments?.length) return '';
  let text = `## ${video.title}\n`;
  text += `Position: ${video.position}\n\n`;
  segments.forEach((seg) => {
    const start = seg.start || 0;
    const mins = Math.floor(start / 60);
    const secs = Math.floor(start % 60);
    const ts = `${mins}:${String(secs).padStart(2, '0')}`;
    text += `[${ts}] ${seg.text}\n`;
  });
  text += '\n';
  return text;
}

async function copyTranscriptsForIndices(indices) {
  const videos = indices.map((i) => currentPlaylistVideos[i]).filter(Boolean);
  if (!videos.length) return setStatus('No videos with transcripts selected.', 'error');
  let combined = '';
  let copied = 0;
  videos.forEach((video) => {
    if (video.transcriptSegments?.length) {
      combined += formatTranscriptForClipboard(video.transcriptSegments, video);
      copied++;
    }
  });
  if (!combined) return setStatus('No transcript data found for selected videos.', 'error');
  try {
    await navigator.clipboard.writeText(combined);
    setStatus(`Copied transcripts for ${copied} video${copied === 1 ? '' : 's}.`, 'success');
  } catch {
    setStatus('Could not copy to clipboard.', 'error');
  }
}
```

Add event handlers at the bottom of popup.js:

```javascript
document.getElementById('selectAllVideos').addEventListener('click', () => {
  document.querySelectorAll('#batchTranscriptList input[type="checkbox"]:not(:disabled)').forEach((cb) => { cb.checked = true; });
});

document.getElementById('deselectAllVideos').addEventListener('click', () => {
  document.querySelectorAll('#batchTranscriptList input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
});

document.getElementById('copySelectedTranscripts').addEventListener('click', () => {
  const indices = getSelectedVideoIndices();
  copyTranscriptsForIndices(indices);
});

document.getElementById('copyAllTranscripts').addEventListener('click', () => {
  const allIndices = currentPlaylistVideos.map((_, i) => i);
  copyTranscriptsForIndices(allIndices);
});
```

Add `checkBatchTranscriptContext()` call inside `refreshStatus()` at the end:

```javascript
await checkBatchTranscriptContext();
```

- [ ] **Step 4: Test batch transcript extraction**

1. Open a YouTube playlist page
2. Use the playlist widget to collect videos and run transcript collection
3. Open the popup
4. Verify the "Batch Transcript Extract" card appears with video list
5. Check which videos have transcripts (green checkmarks)
6. Select a few videos and click "Copy Selected"
7. Paste into a text editor and verify transcripts are formatted correctly
8. Test "Select All" / "Deselect All" buttons
9. Test "Copy All" button

---

### Task 4: Final integration testing and polish

**Files:**
- Modify: `dist/popup.html` — ensure card ordering and spacing is correct
- Modify: `dist/popup.js` — ensure all functions are called in the right order

**Interfaces:**
- All three features work independently and together

- [ ] **Step 1: Verify popup layout and ordering**

Open the popup on a YouTube playlist page and verify the card order:
1. Page status card (existing)
2. Channel Uploads card (Task 1)
3. Saved Playlists & Queues card (Task 2)
4. Batch Transcript Extract card (Task 3)
5. Ask with page context card (existing)
6. Quick asks card (existing)
7. Recipes card (existing)
8. Prompt history card (existing)
9. Provider activity card (existing)
10. Provider replies card (existing)
11. Action buttons (existing)

- [ ] **Step 2: Test non-YouTube pages**

1. Open a non-YouTube page (e.g., google.com)
2. Open the popup
3. Verify Uploads card is hidden
4. Verify Playlist Hub shows saved playlists (from storage)
5. Verify Batch Transcript card is hidden
6. All existing features should work as before

- [ ] **Step 3: Test edge cases**

1. Open a YouTube video (not playlist) — Uploads card should show, Playlist Hub should show saved playlists, Batch Transcript should be hidden
2. Open a playlist with no collected videos — Batch Transcript should show "Collect videos first"
3. Open a playlist with collected videos but no transcripts — Batch Transcript should show videos with "no transcript" badges
4. Test with empty storage — Playlist Hub should show "No saved playlists yet"

- [ ] **Step 4: Run existing tests**

```bash
npm run test:unit
```

Verify no regressions in existing functionality.
