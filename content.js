// Social Companion & YT Note-Taker Content Script
// Handles YouTube, X (Twitter), and Reddit pages

(function () {
  "use strict";

  const PLAYLIST_BACKUP_FORMAT = "social-companion-playlist-backup";
  const PLAYLIST_BACKUP_SCHEMA_VERSION = 1;

  // Destructure helpers from global scope
  const { formatTime, escapeHtml, decodeHtmlEntities } = window;

  // Inject CSS styles into the page (Glassmorphism, High Aesthetics)
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    /* Common Design System & Variables */
    :root {
      --sc-primary: #8b5cf6;
      --sc-primary-hover: #7c3aed;
      --sc-secondary: #a78bfa;
      --sc-bg-light: rgba(18, 18, 22, 0.96); /* Enforce dark theme by default */
      --sc-bg-dark: rgba(18, 18, 22, 0.96);
      --sc-text-light: #f8fafc; /* Dark mode colors by default */
      --sc-text-dark: #f8fafc;
      --sc-text-muted-light: #94a3b8;
      --sc-text-muted-dark: #94a3b8;
      --sc-border-light: rgba(255, 255, 255, 0.08);
      --sc-border-dark: rgba(255, 255, 255, 0.08);
      --sc-accent-red: #f43f5e;
      --sc-accent-green: #10b981;
      --sc-glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      --sc-glass-blur: blur(12px);
    }

    /* Embedded Companion Widget Container */
    #sc-youtube-widget {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin-bottom: 20px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--sc-border-dark);
      background: var(--sc-bg-dark);
      color: var(--sc-text-dark);
      backdrop-filter: var(--sc-glass-blur);
      -webkit-backdrop-filter: var(--sc-glass-blur);
      box-shadow: var(--sc-glass-shadow);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    html[theme="dark"] #sc-youtube-widget,
    body.ytd-masthead-dark #sc-youtube-widget,
    @media (prefers-color-scheme: dark) {
      #sc-youtube-widget.sc-adaptive-theme {
        background: var(--sc-bg-dark);
        color: var(--sc-text-dark);
        border-color: var(--sc-border-dark);
      }
    }

    .sc-header {
      background: #24212d;
      border-bottom: 1px solid rgba(167, 139, 250, 0.28);
      color: white;
      padding: 16px 20px;
      font-weight: 800;
      font-size: 17px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      letter-spacing: 0.5px;
      position: relative;
    }

    .sc-header-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sc-logo-icon {
      font-size: 20px;
    }

    .sc-tabs {
      display: flex;
      background: rgba(0,0,0,0.2);
      border-bottom: 1px solid var(--sc-border-dark);
      padding: 4px;
      gap: 4px;
    }

    .sc-quick-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin: 0 0 12px;
      padding: 9px;
      border: 1px solid var(--sc-border-dark);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.025);
    }

    .sc-quick-actions-label {
      color: var(--sc-text-muted-light);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .sc-quick-actions-head {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }

    .sc-quick-actions .sc-btn {
      min-width: 0;
      justify-content: center;
      padding: 7px 6px;
      font-size: 11px;
    }

    #sc-transcript-quick-status {
      max-width: 52%;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 3px 7px;
      border: 1px solid;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
    }

    @media (max-width: 420px) {
      .sc-quick-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    html[theme="dark"] .sc-tabs,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-tabs {
        background: rgba(255,255,255,0.01);
        border-color: var(--sc-border-dark);
      }
    }

    .sc-tab {
      flex: 1;
      padding: 12px;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border-radius: 8px;
      color: var(--sc-text-muted-dark);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    html[theme="dark"] .sc-tab,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-tab {
        color: var(--sc-text-muted-dark);
      }
    }
    .sc-tab.active {
      color: white;
      background: var(--sc-primary);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
    }

    .sc-content-panel {
      display: none;
      padding: 18px;
      max-height: 480px;
      overflow-y: auto;
    }
    .sc-content-panel.active {
      display: block;
    }

    /* Notes UI */
    .sc-notes-input-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }

    .sc-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--sc-border-dark);
      background: rgba(255,255,255,0.02);
      color: inherit;
      resize: vertical;
      min-height: 70px;
      font-size: 13.5px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    html[theme="dark"] .sc-textarea,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-textarea {
        background: rgba(255,255,255,0.02);
        border-color: var(--sc-border-dark);
      }
    }
    .sc-textarea:focus {
      border-color: var(--sc-primary);
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
    }

    .sc-btn-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .sc-btn {
      padding: 9px 15px;
      border-radius: 8px;
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .sc-btn:active {
      transform: scale(0.96);
    }
    .sc-btn-primary {
      background: var(--sc-primary);
      color: white;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
    }
    .sc-btn-primary:hover {
      background: var(--sc-primary-hover);
    }
    .sc-btn-secondary {
      background: rgba(255,255,255,0.05);
      color: inherit;
      border: 1px solid var(--sc-border-dark);
    }
    html[theme="dark"] .sc-btn-secondary,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-btn-secondary {
        background: rgba(255,255,255,0.05);
        border-color: var(--sc-border-dark);
      }
    }
    .sc-btn-secondary:hover {
      background: rgba(255,255,255,0.08);
    }
    html[theme="dark"] .sc-btn-secondary:hover,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-btn-secondary:hover {
        background: rgba(255,255,255,0.08);
      }
    }

    .sc-options-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--sc-text-muted-dark);
    }

    .sc-note-item {
      display: flex;
      flex-direction: column;
      padding: 12px;
      border-radius: 10px;
      background: rgba(255,255,255,0.01);
      border: 1px solid var(--sc-border-dark);
      margin-bottom: 10px;
      transition: all 0.2s;
    }
    html[theme="dark"] .sc-note-item,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-note-item {
        background: rgba(255,255,255,0.01);
        border-color: var(--sc-border-dark);
      }
    }

    .sc-note-timestamp {
      font-size: 12px;
      font-weight: 800;
      color: var(--sc-primary);
      cursor: pointer;
      align-self: flex-start;
      margin-bottom: 6px;
      background: rgba(139, 92, 246, 0.15);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .sc-note-text {
      font-size: 13.5px;
      word-break: break-word;
      line-height: 1.4;
    }

    .sc-note-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 8px;
      border-top: 1px solid var(--sc-border-dark);
      padding-top: 6px;
    }
    html[theme="dark"] .sc-note-actions,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-note-actions {
        border-color: var(--sc-border-dark);
      }
    }

    .sc-note-action-btn {
      font-size: 11px;
      background: none;
      border: none;
      cursor: pointer;
      font-weight: 600;
      color: var(--sc-text-muted-dark);
    }
    .sc-note-action-btn:hover {
      color: var(--sc-primary);
    }
    .sc-note-action-btn.sc-delete:hover {
      color: var(--sc-accent-red);
    }

    /* Timeline Markers */
    .sc-timeline-marker {
      position: absolute;
      width: 12px;
      height: 12px;
      background: var(--sc-primary);
      border: 2px solid white;
      border-radius: 50%;
      top: 50%;
      transform: translateY(-50%) scale(1);
      cursor: pointer;
      z-index: 50;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .sc-marker-tooltip {
      position: absolute;
      bottom: 25px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 100;
      display: none;
    }
    .sc-timeline-marker:hover .sc-marker-tooltip {
      display: block;
    }

    /* Transcript UI & Tools */
    .sc-search-bar {
      width: 100%;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--sc-border-dark);
      background: rgba(255,255,255,0.02);
      color: inherit;
      font-size: 12.5px;
      outline: none;
      box-sizing: border-box;
      margin-bottom: 8px;
    }
    html[theme="dark"] .sc-search-bar,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-search-bar {
        background: rgba(255,255,255,0.02);
        border-color: var(--sc-border-dark);
      }
    }

    .sc-transcript-list {
      max-height: 280px;
      overflow-y: auto;
      border: 1px solid var(--sc-border-dark);
      border-radius: 10px;
      padding: 10px;
      font-size: 12.5px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    html[theme="dark"] .sc-transcript-list,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-transcript-list {
        border-color: var(--sc-border-dark);
      }
    }

    .sc-transcript-line {
      display: flex;
      gap: 10px;
      line-height: 1.4;
    }

    .sc-transcript-time {
      font-weight: 800;
      color: var(--sc-primary);
      cursor: pointer;
      min-width: 50px;
      background: rgba(139, 92, 246, 0.15);
      padding: 0px 4px;
      border-radius: 4px;
      text-align: center;
      align-self: flex-start;
    }

    .sc-screenshots-container {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      margin-top: 4px;
      padding: 4px 0;
    }

    .sc-screenshot-thumbnail {
      width: 90px;
      height: 50px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--sc-border-dark);
      cursor: pointer;
    }

    .sc-llm-routing {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 10px;
    }

    /* Floating UI for X / Reddit */
    .sc-floating-action-button {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: linear-gradient(135deg, var(--sc-primary), var(--sc-secondary));
      color: white;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 9999;
      font-weight: 800;
      font-size: 22px;
    }

    .sc-floating-panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 520px;
      border-radius: 16px;
      border: 1px solid var(--sc-border-dark);
      background: var(--sc-bg-dark);
      color: var(--sc-text-dark);
      box-shadow: var(--sc-glass-shadow);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    html[theme="dark"] .sc-floating-panel,
    .sc-floating-panel.sc-adaptive-theme {
        background: var(--sc-bg-dark);
        color: var(--sc-text-dark);
        border-color: var(--sc-border-dark);
    }
  `;
  document.head.appendChild(styleEl);

  // Bulletproof Storage Wrapper
  const storage = {
    get: (keys, callback) => {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.get(keys, (data) => {
          if (chrome.runtime.lastError) {
            fallbackGet(keys, callback);
          } else {
            callback(data);
          }
        });
      } else {
        fallbackGet(keys, callback);
      }
    },
    set: (items, callback) => {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.set(items, () => {
          if (chrome.runtime.lastError) {
            fallbackSet(items, callback);
          } else if (callback) {
            callback();
          }
        });
      } else {
        fallbackSet(items, callback);
      }
    },
    getAsync: (keys) => {
      return new Promise((resolve) => {
        storage.get(keys, (data) => {
          resolve(data);
        });
      });
    },
    setAsync: (items) => {
      return new Promise((resolve) => {
        storage.set(items, () => {
          resolve();
        });
      });
    },
  };

  function fallbackGet(keys, callback) {
    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach((k) => {
      try {
        const val = localStorage.getItem(k);
        result[k] = val ? JSON.parse(val) : undefined;
      } catch (e) {
        result[k] = undefined;
      }
    });
    callback(result);
  }

  function fallbackSet(items, callback) {
    Object.keys(items).forEach((k) => {
      try {
        localStorage.setItem(k, JSON.stringify(items[k]));
      } catch (e) {}
    });
    if (callback) callback();
  }

  // Global variables
  let currentVideoId = "";
  let activeTabName = "notes";
  let ytCaptions = [];
  let transcriptState = { status: "idle", videoId: "", message: "Waiting for this video…", source: "" };
  let screenshotList = [];
  let autoPauseOnType = false;
  let notesSearchQuery = "";
  let transcriptSearchQuery = "";
  let cachedMarkdown = ""; // pre-cached export markdown for sync clipboard copy
  const autoCaptureAttempts = new Set();
  let hasAttemptedAutoClick = false; // flag to prevent duplicate auto-clicks per video
  let playlistBackupItems = [];
  let playlistTranscriptQueueActive = false;

  function setTranscriptState(status, message, source = "") {
    transcriptState = { status, videoId: currentVideoId, message, source, updatedAt: new Date().toISOString() };
    renderTranscriptStatus();
    if (status === "ready") maybeAutoCaptureCurrentVideo().catch((error) => console.warn("Auto-capture check failed", error));
  }

  async function maybeAutoCaptureCurrentVideo() {
    const captureVideoId = currentVideoId;
    if (!captureVideoId || autoCaptureAttempts.has(captureVideoId) || transcriptState.videoId !== captureVideoId || transcriptState.status !== "ready") return;
    const config = await chrome.storage.local.get(["sc_auto_capture_mode"]);
    if (!config.sc_auto_capture_mode || config.sc_auto_capture_mode === "off") return;
    autoCaptureAttempts.add(captureVideoId);
    const markdown = await generateMarkdown();
    const metadata = extractYouTubeMetadata();
    if (currentVideoId !== captureVideoId || !new RegExp(`^URL: https://www\\.youtube\\.com/watch\\?v=${captureVideoId}(?:&|$)`, "m").test(markdown)) {
      autoCaptureAttempts.delete(captureVideoId);
      return;
    }
    const response = await chrome.runtime.sendMessage({ type: "sc_auto_capture_verified", videoId: captureVideoId, channel: metadata.channel || "Unknown", title: metadata.title || "video", content: markdown });
    if (!response?.ok && !response?.skipped) autoCaptureAttempts.delete(captureVideoId);
  }

  function renderTranscriptStatus() {
    const status = document.getElementById("sc-transcript-status");
    const quickStatus = document.getElementById("sc-transcript-quick-status");
    const palette = {
      ready: "#34d399",
      waiting: "#fbbf24",
      mismatch: "#fb7185",
      unavailable: "#94a3b8",
      error: "#fb7185",
    };
    const color = palette[transcriptState.status] || "#94a3b8";
    if (status) {
      status.textContent = transcriptState.message;
      status.style.color = color;
      status.style.borderColor = `${color}55`;
      status.style.background = `${color}12`;
    }
    if (quickStatus) {
      quickStatus.textContent = transcriptState.status === "ready" ? "Transcript verified" : transcriptState.status === "waiting" ? "Checking transcript…" : transcriptState.status === "unavailable" ? "No transcript" : "Transcript mismatch/error";
      quickStatus.style.color = color;
      quickStatus.style.borderColor = `${color}55`;
      quickStatus.style.background = `${color}12`;
    }
  }

  // Load user auto-pause preference from storage
  storage.get(["sc_preference_autopause"], (data) => {
    if (data && data.sc_preference_autopause !== undefined) {
      autoPauseOnType = data.sc_preference_autopause;
    }
  });

  // Initialize script depending on host
  const host = location.hostname;
  if (host.includes("youtube.com") || host === "youtu.be") {
    initYouTubeWatcher();
  } else if (host.includes("twitter.com") || host.includes("x.com")) {
    initSocialCompanion("x");
  } else if (host.includes("reddit.com")) {
    initSocialCompanion("reddit");
  }

  // Used by the background-owned playlist queue. This intentionally avoids the
  // normal widget/UI path: the inactive queue tab should only return factual
  // caption-track results, never click controls or surface a toast.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "sc_collect_transcript") {
      collectTranscriptForBackground().then(sendResponse).catch((error) => {
        sendResponse({ status: "error", reason: error?.message || "Transcript collection failed.", segments: [] });
      });
      return true;
    }
    if (message.type === "sc_playlist_transcript_progress") {
      updatePlaylistTranscriptProgress(message);
    }
    if (message.type === "sc_get_capture_status") {
      sendResponse({
        ok: true,
        videoId: currentVideoId,
        title: currentVideoId ? extractYouTubeMetadata().title : "",
        transcriptAvailable: ytCaptions.length > 0,
      });
    }
    if (message.type === "sc_get_current_markdown") {
      if (!currentVideoId) {
        sendResponse({ ok: false, reason: "Open a watch, live, or Shorts video first." });
        return;
      }
      generateMarkdown().then((markdown) => {
        sendResponse({ ok: true, markdown, title: extractYouTubeMetadata().title || "YouTube capture" });
      }).catch((error) => {
        sendResponse({ ok: false, reason: error?.message || "Could not prepare this YouTube capture." });
      });
      return true;
    }
    if (message.type === "sc_download_current_markdown") {
      downloadMarkdownFile({ toast: true }).then(sendResponse).catch((error) => {
        sendResponse({ ok: false, reason: error?.message || "Couldn't save this page's capture." });
      });
      return true;
    }
    if (message.type === "sc_download_current_transcript") {
      downloadTranscriptFile({ toast: true }).then(sendResponse).catch((error) => {
        sendResponse({ ok: false, reason: error?.message || "Couldn't download this transcript." });
      });
      return true;
    }
    if (message.type === "sc_download_visible_playlist_backup") {
      downloadVisiblePlaylistBackup().then(sendResponse).catch((error) => {
        sendResponse({ ok: false, reason: error?.message || "Couldn't download the visible playlist backup." });
      });
      return true;
    }
    if (message.type === "sc_collect_visible_playlist_transcripts") {
      startVisiblePlaylistTranscriptCollection().then(sendResponse).catch((error) => {
        sendResponse({ ok: false, reason: error?.message || "Couldn't start playlist transcript collection." });
      });
      return true;
    }
    if (message.type === "sc_get_channel_id") {
      getOrExtractChannelId().then((channelId) => {
        let channelTitle = "";
        try {
          const titleEl = document.querySelector("yt-dynamic-text-view-model h1, ytd-channel-name #text, #channel-header #text, #owner-name a, ytd-video-owner-renderer #channel-name a");
          if (titleEl) channelTitle = titleEl.textContent.trim();
          if (!channelTitle && currentVideoId) {
            channelTitle = extractYouTubeMetadata()?.channel || "";
          }
        } catch {}
        sendResponse({ ok: Boolean(channelId), channelId: channelId || "", channelTitle: channelTitle || "" });
      }).catch(() => {
        sendResponse({ ok: false, channelId: "", channelTitle: "" });
      });
      return true;
    }
    if (message.type === "sc_get_playlist_videos") {
      extractPlaylistVideosFromPage().then(sendResponse).catch((error) => {
        sendResponse({ ok: false, error: error?.message || "Failed to extract playlist videos", videos: [] });
      });
      return true;
    }
  });

  // --- YouTube Scripting & Logic ---
  // Declare module-level observers BEFORE initYouTubeWatcher so they are
  // available (not in the temporal dead zone) when onYouTubeUrlChange() fires
  // on the very first call from inside initYouTubeWatcher().
  let _recoObserver = null;
  let _channelHeaderObserver = null;
  let _cachedChannelId = { url: "", id: "" };

  function initYouTubeWatcher() {
    let lastUrl = location.href;
    const requestActivation = () => {
      lastUrl = location.href;
      onYouTubeUrlChange();
    };
    window.addEventListener("yt-navigate-finish", requestActivation, true);
    window.addEventListener("yt-page-data-updated", requestActivation, true);
    window.addEventListener("popstate", requestActivation, true);
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onYouTubeUrlChange();
      }
      // Check if native transcript open, auto sync if empty
      autoSyncNativeTranscript();
    }, 1500);

    onYouTubeUrlChange();
  }



  function canonicalYouTubeUrl(videoId, timestamp = null) {
    const url = new URL("https://www.youtube.com/watch");
    url.searchParams.set("v", videoId);
    if (Number.isFinite(timestamp)) {
      url.searchParams.set("t", `${Math.max(0, Math.floor(timestamp))}s`);
    }
    return url.toString();
  }

  function isExplicitYouTubeVideoRoute(urlString = window.location.href) {
    const url = new URL(urlString, window.location.origin);
    if (url.hostname === "youtu.be") return Boolean(url.pathname.split("/").filter(Boolean)[0]);
    if (url.pathname === "/watch") return Boolean(url.searchParams.get("v"));
    const parts = url.pathname.split("/").filter(Boolean);
    return ["live", "shorts"].includes(parts[0]) && Boolean(parts[1]);
  }

  function getYouTubeVideoId(urlString = window.location.href) {
    const url = new URL(urlString, window.location.origin);

    // Only explicit video routes mount the page widget. YouTube browse/channel
    // pages often contain preloaded player data, which is not permission to
    // cover those surfaces with a video-notes panel.
    const watchVideoId = url.searchParams.get("v");
    if (watchVideoId) {
      // YouTube has experimentally emitted /watch?v=/live/<id> and
      // /watch?v=/shorts/<id>. Store the actual video ID, never the slug.
      const nestedPath = watchVideoId.match(/^\/(?:live|shorts)\/([^/?#]+)/);
      return nestedPath ? nestedPath[1] : watchVideoId;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const isShortUrl = url.hostname === "youtu.be";
    const videoPathIndex = pathParts.findIndex((part) =>
      ["live", "shorts"].includes(part),
    );
    const pathVideoId = isShortUrl ? pathParts[0] : pathParts[videoPathIndex + 1];
    if (pathVideoId) {
      try {
        return decodeURIComponent(pathVideoId);
      } catch (e) {
        return pathVideoId;
      }
    }

    return "";
  }

  async function getOrExtractChannelId() {
    const currentUrl = location.href;
    if (_cachedChannelId.url === currentUrl && _cachedChannelId.id) {
      return _cachedChannelId.id;
    }

    // 1. Direct path check if URL is /channel/UC...
    const directMatch = location.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})/);
    if (directMatch) {
      _cachedChannelId = { url: currentUrl, id: directMatch[1] };
      return directMatch[1];
    }

    // 2. RSS alternate link in <head> (present on every modern channel page)
    try {
      const rss = document.querySelector('link[rel="alternate"][type="application/rss+xml"][href*="channel_id="]');
      if (rss) {
        const m = rss.href.match(/channel_id=(UC[A-Za-z0-9_-]{22})/);
        if (m) {
          _cachedChannelId = { url: currentUrl, id: m[1] };
          return m[1];
        }
      }
    } catch {}

    // 3. Parse player response if available (on watch pages)
    try {
      const pr = getPlayerResponseFromScripts();
      if (pr?.videoDetails?.channelId && /^UC[A-Za-z0-9_-]{22}$/.test(pr.videoDetails.channelId)) {
        _cachedChannelId = { url: currentUrl, id: pr.videoDetails.channelId };
        return pr.videoDetails.channelId;
      }
    } catch {}

    // 4. Meta tags (itemprop, identifier, og:url)
    try {
      const meta = document.querySelector('meta[itemprop="channelId"], meta[itemprop="identifier"][content^="UC"]');
      if (meta?.content && /^UC[A-Za-z0-9_-]{22}$/.test(meta.content)) {
        _cachedChannelId = { url: currentUrl, id: meta.content };
        return meta.content;
      }
    } catch {}

    // 5. Scan <script> tags for ytInitialData / channel metadata
    try {
      const scripts = document.querySelectorAll("script");
      for (const s of scripts) {
        const txt = s.textContent;
        if (!txt) continue;
        const mExt = txt.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/);
        if (mExt) {
          _cachedChannelId = { url: currentUrl, id: mExt[1] };
          return mExt[1];
        }
        const mChan = txt.match(/"(?:channelId|browseId)"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/);
        if (mChan) {
          _cachedChannelId = { url: currentUrl, id: mChan[1] };
          return mChan[1];
        }
      }
    } catch {}

    // 6. Look for canonical link or channel links with UC...
    try {
      const links = document.querySelectorAll('link[rel="canonical"], a[href*="/channel/UC"]');
      for (const l of links) {
        const h = l.href || l.getAttribute("href") || "";
        const m = h.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
        if (m) {
          _cachedChannelId = { url: currentUrl, id: m[1] };
          return m[1];
        }
      }
    } catch {}

    // 7. Same-origin fetch of channel page HTML (guaranteed to contain externalId)
    try {
      const resp = await fetch(location.href, { credentials: "omit" });
      if (resp.ok) {
        const html = await resp.text();
        const mExt = html.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/);
        if (mExt) {
          _cachedChannelId = { url: currentUrl, id: mExt[1] };
          return mExt[1];
        }
        const mChan = html.match(/channel_id=(UC[A-Za-z0-9_-]{22})/);
        if (mChan) {
          _cachedChannelId = { url: currentUrl, id: mChan[1] };
          return mChan[1];
        }
      }
    } catch {}

    return null;
  }

  function extractChannelId() {
    return _cachedChannelId.id || null;
  }

  async function injectChannelPlaylistButton() {
    const host = location.hostname;
    if (!host.includes("youtube.com")) return;
    const path = location.pathname;
    const isChannel = path.startsWith("/@") || path.startsWith("/channel/") || path.startsWith("/c/") || path.startsWith("/user/");
    if (!isChannel) {
      document.getElementById("sc-channel-playlist-wrapper")?.remove();
      document.getElementById("sc-channel-playlist-btn")?.remove();
      return;
    }

    if (document.getElementById("sc-channel-playlist-btn")) return;

    const target =
      document.querySelector("yt-flexible-actions-view-model") ||
      document.querySelector("#page-header yt-page-header-view-model") ||
      document.querySelector("yt-page-header-view-model") ||
      document.querySelector("#channel-header #buttons") ||
      document.querySelector("#channel-header-container") ||
      document.querySelector("#page-header");

    if (!target) return;

    const cid = await getOrExtractChannelId();
    if (!cid) return;

    if (document.getElementById("sc-channel-playlist-btn")) return;

    const uploadsUrl = "https://www.youtube.com/playlist?list=UU" + cid.slice(2);

    const wrapper = document.createElement("div");
    wrapper.className = "ytFlexibleActionsViewModelAction";
    wrapper.id = "sc-channel-playlist-wrapper";
    wrapper.style.cssText = "display: inline-flex; align-items: center; margin-left: 8px; vertical-align: middle;";

    const btn = document.createElement("a");
    btn.id = "sc-channel-playlist-btn";
    btn.href = uploadsUrl;
    btn.title = "View all channel uploads as a playlist (Social Companion)";
    btn.setAttribute("aria-label", "View uploads as playlist");
    btn.innerHTML = `<span style="font-size:14px;line-height:1;margin-right:4px;">📋</span><span style="font-weight:600;font-size:13px;letter-spacing:0.02em;">Uploads Playlist</span>`;
    btn.style.cssText = [
      "display: inline-flex",
      "align-items: center",
      "gap: 6px",
      "padding: 0 16px",
      "height: 36px",
      "border-radius: 18px",
      "background: linear-gradient(135deg, #8b5cf6, #6d28d9)",
      "color: #ffffff !important",
      "font-size: 13px",
      "font-weight: 600",
      "text-decoration: none !important",
      "cursor: pointer",
      "box-shadow: 0 2px 10px rgba(139, 92, 246, 0.45)",
      "transition: all 0.2s ease",
      "white-space: nowrap",
      "border: 1px solid rgba(255, 255, 255, 0.2)",
      "font-family: Roboto, Arial, sans-serif",
      "user-select: none",
      "box-sizing: border-box",
      "z-index: 999",
    ].join(";");

    btn.onclick = (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        window.location.href = uploadsUrl;
      }
    };

    btn.onmouseenter = () => {
      btn.style.transform = "translateY(-1px)";
      btn.style.boxShadow = "0 4px 16px rgba(139, 92, 246, 0.65)";
      btn.style.background = "linear-gradient(135deg, #9333ea, #7c3aed)";
    };
    btn.onmouseleave = () => {
      btn.style.transform = "none";
      btn.style.boxShadow = "0 2px 10px rgba(139, 92, 246, 0.45)";
      btn.style.background = "linear-gradient(135deg, #8b5cf6, #6d28d9)";
    };

    wrapper.appendChild(btn);
    target.appendChild(wrapper);
  }

  function watchChannelHeader() {
    if (_channelHeaderObserver) {
      _channelHeaderObserver.disconnect();
      _channelHeaderObserver = null;
    }
    const path = location.pathname;
    const isChannel = path.startsWith("/@") || path.startsWith("/channel/") || path.startsWith("/c/") || path.startsWith("/user/");
    if (!isChannel) {
      document.getElementById("sc-channel-playlist-wrapper")?.remove();
      document.getElementById("sc-channel-playlist-btn")?.remove();
      return;
    }

    injectChannelPlaylistButton();

    _channelHeaderObserver = new MutationObserver(() => {
      if (document.querySelector("yt-flexible-actions-view-model, yt-page-header-view-model, #channel-header") && !document.getElementById("sc-channel-playlist-btn")) {
        injectChannelPlaylistButton();
      }
    });

    _channelHeaderObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      if (_channelHeaderObserver) {
        _channelHeaderObserver.disconnect();
        _channelHeaderObserver = null;
      }
    }, 25000);
  }

  async function extractPlaylistVideosFromPage() {
    const url = new URL(location.href);
    let listId = url.searchParams.get("list") || "";

    const videos = [];
    const seenIds = new Set();

    // Strategy 1: Playlist browse page rows (ytd-playlist-video-renderer)
    document.querySelectorAll("ytd-playlist-video-renderer").forEach((row) => {
      const titleEl = row.querySelector("#video-title");
      const channelEl = row.querySelector("#channel-name a, .ytd-channel-name a, #byline a");
      const durationEl = row.querySelector("span.ytd-thumbnail-overlay-time-status-renderer, #overlays span, ytd-thumbnail-overlay-time-status-renderer");
      const thumbEl = row.querySelector("img#img, img");

      const title = titleEl ? titleEl.textContent.trim() : "";
      const href = titleEl ? titleEl.getAttribute("href") || "" : "";
      const videoIdMatch = href.match(/[?&]v=([^&]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : "";
      const channel = channelEl ? channelEl.textContent.trim() : "";
      const duration = durationEl ? durationEl.textContent.trim() : "";
      const thumbnail = thumbEl ? thumbEl.src || thumbEl.getAttribute("data-src") || "" : "";

      if (videoId && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        videos.push({ position: videos.length + 1, videoId, title: title || `Video ${videos.length + 1}`, channel, duration, thumbnail, url: `https://www.youtube.com/watch?v=${videoId}` });
      }
    });

    // Strategy 2: Playlist panel on watch page or queue (ytd-playlist-panel-video-renderer)
    if (videos.length === 0) {
      document.querySelectorAll("ytd-playlist-panel-video-renderer").forEach((row) => {
        const titleEl = row.querySelector("#video-title");
        const channelEl = row.querySelector("#byline, #channel-name");
        const durationEl = row.querySelector("span.ytd-thumbnail-overlay-time-status-renderer, #overlays span");
        const thumbEl = row.querySelector("img#img, img");

        const title = titleEl ? titleEl.textContent.trim() : "";
        const href = row.querySelector("a#wc-endpoint")?.getAttribute("href") || (titleEl ? titleEl.getAttribute("href") : "") || "";
        const videoIdMatch = href.match(/[?&]v=([^&]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : "";
        const channel = channelEl ? channelEl.textContent.trim() : "";
        const duration = durationEl ? durationEl.textContent.trim() : "";
        const thumbnail = thumbEl ? thumbEl.src || thumbEl.getAttribute("data-src") || "" : "";

        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          videos.push({ position: videos.length + 1, videoId, title: title || `Video ${videos.length + 1}`, channel, duration, thumbnail, url: `https://www.youtube.com/watch?v=${videoId}` });
        }
      });
    }

    // Strategy 3: Modern yt-lockup-view-model
    if (videos.length === 0) {
      document.querySelectorAll("yt-lockup-view-model").forEach((lockup) => {
        const titleEl = lockup.querySelector("a#video-title-link, a.title-link, h3 a");
        const channelEl = lockup.querySelector('#channel-name a, .ytd-channel-name a, a[href*="/channel/"], a[href*="/@"]');
        const durationEl = lockup.querySelector("span.ytd-thumbnail-overlay-time-status-renderer, badge-shape .ytBadgeShapeText");
        const thumbEl = lockup.querySelector("img");

        const title = titleEl ? titleEl.textContent.trim() : "";
        const href = titleEl ? titleEl.getAttribute("href") || "" : "";
        const videoIdMatch = href.match(/[?&]v=([^&]+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : "";
        const channel = channelEl ? channelEl.textContent.trim() : "";
        const duration = durationEl ? durationEl.textContent.trim() : "";
        const thumbnail = thumbEl ? thumbEl.src || thumbEl.getAttribute("data-src") || "" : "";

        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          videos.push({ position: videos.length + 1, videoId, title: title || `Video ${videos.length + 1}`, channel, duration, thumbnail, url: `https://www.youtube.com/watch?v=${videoId}` });
        }
      });
    }

    // Determine playlist / queue title
    let playlistTitle = "";
    const isQueue = !listId || listId === "queue" || Boolean(document.querySelector("ytd-miniplayer-info-bar"));
    if (isQueue && !listId) listId = "queue";

    const titleEl = document.querySelector("yt-dynamic-text-view-model .yt-core-attributed-string, h1.ytd-playlist-header-renderer, ytd-playlist-panel-renderer #header-description h3, #title-text");
    if (titleEl) playlistTitle = titleEl.textContent.trim();
    if (!playlistTitle) {
      playlistTitle = isQueue ? "YouTube Queue" : document.title.replace(/\s*-\s*YouTube$/, "");
    }

    return {
      ok: true,
      playlistId: listId || "active",
      playlistTitle: playlistTitle || (isQueue ? "YouTube Queue" : "Active Playlist"),
      isQueue,
      videoCount: videos.length,
      videos,
    };
  }

  function onYouTubeUrlChange() {
    const videoId = getYouTubeVideoId();

    if (videoId) {
      currentVideoId = videoId;
      ytCaptions = [];
      setTranscriptState("waiting", "Waiting for captions for this video…");
      cachedMarkdown = ""; // reset cache for new video
      hasAttemptedAutoClick = false; // reset auto-trigger state
      injectYouTubeWidget(videoId, 0);
      injectTimelineMarkers();

      // Delay transcript fetch slightly to ensure page data is loaded
      setTimeout(() => fetchYouTubeTranscript(), 1500);
      // Retry once more after 4s in case YouTube loads data lazily
      setTimeout(() => {
        if (ytCaptions.length === 0) fetchYouTubeTranscript();
      }, 4000);

      // Disconnect any previous sidebar observer
      if (_recoObserver) {
        _recoObserver.disconnect();
        _recoObserver = null;
      }

      // Save initial metadata (title/channel loads fast)
      const _saveMetaNow = () => {
        try {
          const meta = extractYouTubeMetadata();
          if (meta.title) storage.set({ [`sc_meta_${videoId}`]: meta });
        } catch {}
      };

      setTimeout(_saveMetaNow, 2500);

      // Watch the sidebar for recommendation items to appear
      const sidebarTarget = document.querySelector(
        "#secondary-inner, #secondary, #related",
      );
      if (sidebarTarget) {
        let _recoSaveTimer = null;
        _recoObserver = new MutationObserver(() => {
          const hasRecs =
            sidebarTarget.querySelectorAll("yt-lockup-view-model, ytd-compact-video-renderer").length > 0;
          if (hasRecs) {
            clearTimeout(_recoSaveTimer);
            _recoSaveTimer = setTimeout(() => {
              _saveMetaNow();
              updateExportPreview();
            }, 600);
          }
        });
        _recoObserver.observe(sidebarTarget, {
          childList: true,
          subtree: true,
        });
        setTimeout(() => {
          if (_recoObserver) {
            _recoObserver.disconnect();
            _recoObserver = null;
          }
        }, 30000);
      }
    } else {
      currentVideoId = "";
      if (_recoObserver) {
        _recoObserver.disconnect();
        _recoObserver = null;
      }
      const existingVideoWidget = document.getElementById("sc-youtube-widget");
      if (existingVideoWidget) existingVideoWidget.remove();

      const path = location.pathname;
      if (path.startsWith("/playlist")) {
        injectPlaylistBackupWidget();
      } else {
        document.getElementById("sc-playlist-backup-widget")?.remove();
      }

      if (path.startsWith("/@") || path.startsWith("/channel/") || path.startsWith("/c/") || path.startsWith("/user/")) {
        watchChannelHeader();
      } else {
        document.getElementById("sc-channel-playlist-wrapper")?.remove();
        document.getElementById("sc-channel-playlist-btn")?.remove();
      }
    }
  }

  function getPlaylistContext() {
    const listId = new URL(window.location.href).searchParams.get("list");
    if (!listId) return null;
    const title =
      document.querySelector("ytd-playlist-header-renderer #title, ytd-playlist-header-renderer h1, #container #text")?.innerText?.trim() ||
      "YouTube playlist";
    return {
      id: listId,
      title,
      url: `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`,
    };
  }

  function injectPlaylistBackupWidget() {
    const target =
      document.querySelector("ytd-browse #primary, ytd-two-column-browse-results-renderer #primary, #primary");
    if (!target) {
      setTimeout(injectPlaylistBackupWidget, 1200);
      return;
    }
    let widget = document.getElementById("sc-playlist-backup-widget");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "sc-playlist-backup-widget";
      widget.className = "sc-adaptive-theme";
      widget.style.cssText = "margin: 0 0 18px; border-radius: 16px; overflow: hidden; border: 1px solid var(--sc-border-dark); background: var(--sc-bg-dark); color: var(--sc-text-dark); box-shadow: var(--sc-glass-shadow);";
      target.insertBefore(widget, target.firstChild);
    }
    const context = getPlaylistContext();
    widget.innerHTML = `
      <div class="sc-header"><div class="sc-header-title"><span class="sc-logo-icon">🔮</span><span>Playlist Backup</span></div></div>
      <div style="padding: 14px 16px;">
        <div style="font-size:12px;color:var(--sc-text-muted-light);margin-bottom:10px;">Exports what you can view — no API key or quota needed.</div>
        <div class="sc-btn-row">
          <button class="sc-btn sc-btn-primary" id="sc-playlist-load">Load all videos</button>
          <button class="sc-btn sc-btn-secondary" id="sc-playlist-transcripts">Collect transcripts</button>
          <button class="sc-btn sc-btn-secondary" id="sc-playlist-transcripts-stop" disabled>Stop</button>
          <button class="sc-btn sc-btn-secondary" id="sc-playlist-api-load">Fetch with API</button>
          <button class="sc-btn sc-btn-secondary" id="sc-playlist-json">JSON</button>
          <button class="sc-btn sc-btn-secondary" id="sc-playlist-csv">CSV</button>
          <button class="sc-btn sc-btn-secondary" id="sc-playlist-md">Markdown</button>
        </div>
        <details style="margin-top:10px;color:var(--sc-text-muted-light);font-size:11px;">
          <summary style="cursor:pointer;">Optional API key for complete public/unlisted backups</summary>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <input id="sc-playlist-api-key" type="password" placeholder="Your YouTube Data API key" class="sc-search-bar" style="margin:0;min-width:0;">
            <button class="sc-btn sc-btn-secondary" id="sc-playlist-api-save">Save</button>
          </div>
          <div style="margin-top:6px;">Your key stays in this browser. Keyless export remains available for playlists you can open.</div>
        </details>
        <div id="sc-playlist-status" style="font-size:11px;color:var(--sc-text-muted-light);margin-top:10px;">Ready to collect visible videos.</div>
      </div>`;
    collectPlaylistItems();
    widget.querySelector("#sc-playlist-load").onclick = () => loadAllPlaylistItems();
    widget.querySelector("#sc-playlist-transcripts").onclick = () => startPlaylistTranscriptCollection();
    widget.querySelector("#sc-playlist-transcripts-stop").onclick = () => stopPlaylistTranscriptCollection();
    widget.querySelector("#sc-playlist-api-load").onclick = () => loadPlaylistWithApi();
    widget.querySelector("#sc-playlist-api-save").onclick = () => {
      const key = widget.querySelector("#sc-playlist-api-key").value.trim();
      storage.set({ sc_youtube_api_key: key });
      playlistStatus(key ? "API key saved locally." : "API key cleared.");
    };
    storage.get(["sc_youtube_api_key"], (data) => {
      if (data.sc_youtube_api_key) widget.querySelector("#sc-playlist-api-key").value = data.sc_youtube_api_key;
    });
    widget.querySelector("#sc-playlist-json").onclick = () => downloadPlaylistBackup("json");
    widget.querySelector("#sc-playlist-csv").onclick = () => downloadPlaylistBackup("csv");
    widget.querySelector("#sc-playlist-md").onclick = () => downloadPlaylistBackup("markdown");
    if (!context) widget.remove();
  }

  function playlistStatus(message) {
    const status = document.getElementById("sc-playlist-status");
    if (status) status.textContent = message;
  }

  function setPlaylistTranscriptControls({ running }) {
    const start = document.getElementById("sc-playlist-transcripts");
    const stop = document.getElementById("sc-playlist-transcripts-stop");
    if (start) start.disabled = running;
    if (stop) stop.disabled = !running;
  }

  function startPlaylistTranscriptCollection() {
    const context = getPlaylistContext();
    playlistTranscriptQueueActive = true;
    const items = collectPlaylistItems();
    if (!context || !items.length) {
      playlistTranscriptQueueActive = false;
      playlistStatus("Collect playlist videos first, then choose Collect transcripts.");
      return;
    }
    playlistStatus(`Starting transcript collection for ${items.length} videos…`);
    chrome.runtime.sendMessage({
      type: "sc_playlist_transcript_queue_start",
      playlist: { format: PLAYLIST_BACKUP_FORMAT, schemaVersion: PLAYLIST_BACKUP_SCHEMA_VERSION, ...context },
      items,
    }, (response) => {
      if (chrome.runtime.lastError) {
        playlistTranscriptQueueActive = false;
        playlistStatus(`Couldn't start transcript collection: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (!response?.ok) {
        playlistTranscriptQueueActive = false;
        playlistStatus(response?.reason || "Couldn't start transcript collection.");
        return;
      }
      setPlaylistTranscriptControls({ running: true });
      playlistStatus(`Transcript collection started — 0/${response.total}.`);
    });
  }

  function stopPlaylistTranscriptCollection() {
    chrome.runtime.sendMessage({ type: "sc_playlist_transcript_queue_stop" }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        playlistStatus(response?.reason || "Couldn't stop transcript collection.");
        return;
      }
      playlistStatus("Stopping after the current video…");
    });
  }

  function updatePlaylistTranscriptProgress(progress) {
    const context = getPlaylistContext();
    if (!context || progress.playlistId !== context.id) return;
    const counts = `${progress.completeCount || 0} collected · ${progress.noTranscriptCount || 0} no transcript · ${progress.errorCount || 0} errors · ${progress.stoppedCount || 0} stopped`;
    playlistStatus(`${progress.message || "Collecting transcripts…"} (${progress.completed || 0}/${progress.total || 0}; ${counts})`);
    setPlaylistTranscriptControls({ running: progress.status === "running" });
    playlistTranscriptQueueActive = progress.status === "running";
    if (progress.status === "complete" || progress.status === "stopped" || progress.status === "error") {
      // Refresh in-memory data so subsequent exports include queue outcomes.
      storage.get([`sc_playlist_backup_${context.id}`], (data) => {
        if (Array.isArray(data[`sc_playlist_backup_${context.id}`]?.items)) {
          playlistBackupItems = data[`sc_playlist_backup_${context.id}`].items;
        }
      });
      if (progress.status === "complete") {
        showToast(`✅ Playlist transcript collection finished — ${progress.completeCount || 0} collected, ${progress.noTranscriptCount || 0} unavailable, ${progress.errorCount || 0} errors.`);
      } else if (progress.status === "error") {
        showToast(`❌ Playlist transcript collection stopped with an error: ${progress.message || "open the archive for completed results."}`);
      }
    }
  }

  function collectPlaylistItems() {
    const found = [];
    document
      .querySelectorAll("ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer, yt-lockup-view-model")
      .forEach((row, index) => {
        const link = row.querySelector('a[href*="watch?v="], a[href*="/shorts/"], a[href*="/live/"]');
        const videoId = link ? getYouTubeVideoId(link.href) : "";
        const title =
          row.querySelector("#video-title, a#video-title, .yt-lockup-metadata-view-model-wiz__title, h3")?.textContent?.trim() ||
          link?.textContent?.trim() ||
          "Unavailable video";
        const channel = row.querySelector("ytd-channel-name #text, #channel-name #text, .yt-lockup-metadata-view-model__metadata-row")?.textContent?.trim() || "";
        const duration = row.querySelector("ytd-thumbnail-overlay-time-status-renderer span, .ytd-thumbnail-overlay-time-status-renderer")?.textContent?.trim() || "";
        const thumbnail = row.querySelector("img")?.src || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : "");
        const positionText = row.querySelector("#index, .index")?.textContent?.trim() || `${index + 1}`;
        if (!videoId && title === "Unavailable video") return;
        found.push({
          position: Number.parseInt(positionText, 10) || index + 1,
          videoId,
          title,
          channel,
          duration,
          url: videoId ? canonicalYouTubeUrl(videoId) : "",
          thumbnail,
          unavailable: !videoId,
        });
      });
    const byKey = new Map(playlistBackupItems.map((item) => [item.videoId || `${item.position}:${item.title}`, item]));
    found.forEach((item) => {
      const key = item.videoId || `${item.position}:${item.title}`;
      // Keep transcript queue outcomes (and any richer API fields) when the
      // visible playlist DOM is re-collected immediately before export.
      byKey.set(key, { ...byKey.get(key), ...item });
    });
    playlistBackupItems = [...byKey.values()].sort((a, b) => a.position - b.position);
    // Collection is deliberately in-memory only. The queue initializes its
    // authoritative backup immediately before it starts; exports save through
    // their explicit queue-aware path. This avoids delayed stale writes racing
    // background transcript outcomes.
    playlistStatus(`${playlistBackupItems.length} videos collected${found.length ? "." : " — scroll the playlist or load all."}`);
    return playlistBackupItems;
  }

  async function downloadVisiblePlaylistBackup() {
    const context = getPlaylistContext();
    const items = collectPlaylistItems();
    if (!context || !items.length) {
      const reason = "Open a playlist and let at least one video row load before exporting.";
      showToast(`ℹ️ ${reason}`);
      return { ok: false, reason };
    }
    const saved = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "sc_save_playlist_export_backup",
        playlist: { format: PLAYLIST_BACKUP_FORMAT, schemaVersion: PLAYLIST_BACKUP_SCHEMA_VERSION, ...context },
        items,
      }, (response) => {
        if (chrome.runtime.lastError) resolve({ ok: false, reason: chrome.runtime.lastError.message, items: [] });
        else resolve(response || { ok: false, reason: "Background did not confirm the playlist save.", items: [] });
      });
    });
    if (!saved.ok && !saved.items?.length) {
      const reason = saved.reason || "Couldn't prepare this playlist backup.";
      showToast(`❌ ${reason}`);
      return { ok: false, reason };
    }
    const backupItems = saved.items?.length ? saved.items : items;
    const safeName = context.title.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "youtube_playlist";
    const content = JSON.stringify({
      format: PLAYLIST_BACKUP_FORMAT,
      schemaVersion: PLAYLIST_BACKUP_SCHEMA_VERSION,
      ...context,
      exportedAt: new Date().toISOString(),
      items: backupItems,
    }, null, 2);
    const archived = await downloadCaptureText(content, `${safeName}_visible_playlist_backup.json`, "application/json", "captures");
    showToast(archived
      ? `📥 Playlist backup saved — ${backupItems.length} visible videos.`
      : `📥 Playlist backup downloaded — ${backupItems.length} visible videos.`);
    return { ok: true, items: backupItems.length };
  }

  async function startVisiblePlaylistTranscriptCollection() {
    const context = getPlaylistContext();
    const items = collectPlaylistItems();
    if (!context || !items.length) {
      const reason = "Open a playlist and let video rows load before starting collection.";
      showToast(`ℹ️ ${reason}`);
      return { ok: false, reason };
    }
    if (playlistTranscriptQueueActive) {
      const reason = "A playlist transcript collection is already running.";
      showToast(`ℹ️ ${reason}`);
      return { ok: false, reason };
    }
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "sc_playlist_transcript_queue_start",
        playlist: { format: PLAYLIST_BACKUP_FORMAT, schemaVersion: PLAYLIST_BACKUP_SCHEMA_VERSION, ...context },
        items,
      }, (result) => {
        if (chrome.runtime.lastError) resolve({ ok: false, reason: chrome.runtime.lastError.message });
        else resolve(result || { ok: false, reason: "Background did not start the transcript queue." });
      });
    });
    if (!response?.ok) {
      const reason = response?.reason || "Couldn't start transcript collection.";
      showToast(`❌ ${reason}`);
      return { ok: false, reason };
    }
    playlistTranscriptQueueActive = true;
    showToast(`🔮 Collecting transcripts for ${response.total} visible videos in the background.`);
    return { ok: true, total: response.total };
  }

  async function loadAllPlaylistItems() {
    const button = document.getElementById("sc-playlist-load");
    if (button) button.disabled = true;
    let unchangedPasses = 0;
    let previousCount = playlistBackupItems.length;
    for (let pass = 0; pass < 120 && unchangedPasses < 3; pass++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      playlistStatus(`Loading playlist… ${playlistBackupItems.length} videos collected`);
      await new Promise((resolve) => setTimeout(resolve, 900));
      collectPlaylistItems();
      if (playlistBackupItems.length === previousCount) unchangedPasses++;
      else unchangedPasses = 0;
      previousCount = playlistBackupItems.length;
    }
    if (button) button.disabled = false;
    playlistStatus(`Finished — ${playlistBackupItems.length} videos ready to export.`);
  }

  function youTubeApiUrl(resource, params) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  }

  async function fetchYouTubeApi(resource, params) {
    const response = await fetch(youTubeApiUrl(resource, params));
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || `YouTube API request failed (${response.status})`);
    return body;
  }

  async function loadPlaylistWithApi() {
    const context = getPlaylistContext();
    const keyInput = document.getElementById("sc-playlist-api-key");
    const apiKey = keyInput?.value.trim();
    if (!context || !apiKey) {
      playlistStatus("Add your own YouTube Data API key, then try Fetch with API.");
      return;
    }
    const queueState = await storage.getAsync(["sc_playlist_transcript_queue_state"]);
    if (playlistTranscriptQueueActive || queueState.sc_playlist_transcript_queue_state?.playlist?.id === context.id) {
      playlistStatus("Transcript collection is running for this playlist. Finish or stop it before Fetch with API.");
      return;
    }
    const button = document.getElementById("sc-playlist-api-load");
    if (button) button.disabled = true;
    try {
      storage.set({ sc_youtube_api_key: apiKey });
      const playlistItems = [];
      let pageToken = "";
      do {
        playlistStatus(`Fetching playlist with API… ${playlistItems.length} videos received`);
        const page = await fetchYouTubeApi("playlistItems", {
          part: "snippet,contentDetails",
          playlistId: context.id,
          maxResults: "50",
          key: apiKey,
          ...(pageToken ? { pageToken } : {}),
        });
        playlistItems.push(...(page.items || []));
        pageToken = page.nextPageToken || "";
      } while (pageToken);

      const videoIds = playlistItems.map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId).filter(Boolean);
      const videos = new Map();
      for (let index = 0; index < videoIds.length; index += 50) {
        const page = await fetchYouTubeApi("videos", {
          part: "snippet,contentDetails",
          id: videoIds.slice(index, index + 50).join(","),
          key: apiKey,
        });
        (page.items || []).forEach((video) => videos.set(video.id, video));
      }
      const apiItems = playlistItems.map((item, index) => {
        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || "";
        const video = videos.get(videoId);
        const snippet = video?.snippet || item.snippet || {};
        return {
          position: (item.snippet?.position ?? index) + 1,
          videoId,
          title: snippet.title || "Unavailable video",
          channel: snippet.channelTitle || "",
          duration: video?.contentDetails?.duration || "",
          url: videoId ? canonicalYouTubeUrl(videoId) : "",
          thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "",
          unavailable: !video,
          addedAt: item.snippet?.publishedAt || "",
          publishedAt: video?.snippet?.publishedAt || "",
          description: video?.snippet?.description || "",
        };
      });
      // The background worker serializes this owner-aware write with queue
      // initialization. A content script never writes API backup objects.
      const saved = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: "sc_save_playlist_api_backup",
          playlist: { format: PLAYLIST_BACKUP_FORMAT, schemaVersion: PLAYLIST_BACKUP_SCHEMA_VERSION, ...context },
          items: apiItems,
        }, (response) => {
          if (chrome.runtime.lastError) resolve({ ok: false, reason: chrome.runtime.lastError.message });
          else resolve(response || { ok: false, reason: "Background did not confirm the API backup write." });
        });
      });
      if (!saved.ok) {
        playlistStatus(saved.reason || "API metadata was not saved.");
        return;
      }
      playlistBackupItems = saved.items || apiItems;
      playlistStatus(`API backup ready — ${playlistBackupItems.length} videos, including metadata not loaded on the page.`);
    } catch (error) {
      playlistStatus(`API backup failed: ${error.message}`);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function playlistCsvField(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function playlistTranscriptSummary(item) {
    const transcript = item.transcriptCollection;
    if (!transcript) return { status: "not-collected", segmentCount: 0, reason: "" };
    return {
      status: transcript.status || "unknown",
      segmentCount: Array.isArray(transcript.segments) ? transcript.segments.length : 0,
      reason: transcript.reason || "",
    };
  }

  async function downloadPlaylistBackup(format) {
    const context = getPlaylistContext();
    const collectedItems = collectPlaylistItems();
    if (!context || !collectedItems.length) {
      playlistStatus("No playlist videos found yet. Scroll or click Load all videos first.");
      return;
    }
    const key = `sc_playlist_backup_${context.id}`;
    const stored = await storage.getAsync([key, "sc_playlist_transcript_queue_state"]);
    const queueOwnsBackup = playlistTranscriptQueueActive || stored.sc_playlist_transcript_queue_state?.playlist?.id === context.id;
    const savedBackup = stored[key];
    const savedByKey = new Map((savedBackup?.items || []).map((item) => [item.videoId || `${item.position}:${item.title}`, item]));
    let items = (queueOwnsBackup && savedBackup?.items?.length ? savedBackup.items : collectedItems).map((item) => {
      const saved = savedByKey.get(item.videoId || `${item.position}:${item.title}`);
      return saved?.transcriptCollection ? { ...item, transcriptCollection: saved.transcriptCollection } : item;
    });
    if (!queueOwnsBackup) {
      // All playlist-backup writes go through the background's serialized
      // owner-aware protocol. It may return queue-owned authoritative items if
      // collection started between this page's read and the save request.
      const saved = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: "sc_save_playlist_export_backup",
          playlist: { format: PLAYLIST_BACKUP_FORMAT, schemaVersion: PLAYLIST_BACKUP_SCHEMA_VERSION, ...context },
          items,
        }, (response) => {
          if (chrome.runtime.lastError) resolve({ ok: false, reason: chrome.runtime.lastError.message, items: [] });
          else resolve(response || { ok: false, reason: "Background did not confirm the export snapshot.", items: [] });
        });
      });
      if (!saved.ok && !saved.items?.length) {
        playlistStatus(saved.reason || "Couldn't prepare playlist export.");
        return;
      }
      if (saved.items?.length) items = saved.items;
      if (!saved.ok) playlistStatus(saved.reason);
    }
    const safeName = context.title.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "youtube_playlist";
    let content;
    let mimeType;
    if (format === "json") {
      content = JSON.stringify({ format: PLAYLIST_BACKUP_FORMAT, schemaVersion: PLAYLIST_BACKUP_SCHEMA_VERSION, ...context, exportedAt: new Date().toISOString(), items }, null, 2);
      mimeType = "application/json";
    } else if (format === "csv") {
      const columns = ["position", "videoId", "title", "channel", "duration", "url", "thumbnail", "unavailable", "transcriptStatus", "transcriptSegmentCount", "transcriptReason"];
      content = ["# Social Companion Playlist Backup v1", columns.join(","), ...items.map((item) => {
        const transcript = playlistTranscriptSummary(item);
        const row = { ...item, transcriptStatus: transcript.status, transcriptSegmentCount: transcript.segmentCount, transcriptReason: transcript.reason };
        return columns.map((column) => playlistCsvField(row[column])).join(",");
      })].join("\n");
      mimeType = "text/csv";
    } else {
      content = `# ${context.title}\n\nSource: ${context.url}\nExported: ${new Date().toISOString()}\n\n` + items.map((item) => {
        const transcript = playlistTranscriptSummary(item);
        const transcriptLine = `Transcript: ${transcript.status}${transcript.segmentCount ? ` (${transcript.segmentCount} segments)` : ""}${transcript.reason ? ` — ${transcript.reason}` : ""}`;
        return `${item.position}. **${item.title}**${item.channel ? ` — ${item.channel}` : ""}${item.duration ? ` [${item.duration}]` : ""}\n   ${item.url || "Unavailable / private video"}\n   ${transcriptLine}`;
      }).join("\n");
      mimeType = "text/markdown";
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}_backup.${format === "markdown" ? "md" : format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    playlistStatus(`${format.toUpperCase()} backup downloaded — ${items.length} videos.`);
  }

  function injectYouTubeWidget(expectedVideoId = currentVideoId, attempt = 0) {
    if (!expectedVideoId || currentVideoId !== expectedVideoId || !isExplicitYouTubeVideoRoute()) {
      document.getElementById("sc-youtube-widget")?.remove();
      return;
    }
    const target =
      document.querySelector("#secondary-inner") ||
      document.querySelector("#secondary");
    if (!target) {
      // YouTube's SPA can emit its navigation event before the sidebar exists.
      // Retry only for this still-active video, then stop instead of looping forever.
      if (attempt < 20) setTimeout(() => injectYouTubeWidget(expectedVideoId, attempt + 1), 500);
      return;
    }

    let widget = document.getElementById("sc-youtube-widget");
    if (!widget) {
      widget = document.createElement("div");
      widget.id = "sc-youtube-widget";
      widget.className = "sc-adaptive-theme";
      target.insertBefore(widget, target.firstChild);
    }

    renderYouTubeWidgetContent(widget);
  }

  function renderYouTubeWidgetContent(container) {
    container.innerHTML = `
      <div class="sc-header">
        <div class="sc-header-title">
          <span class="sc-logo-icon">🔮</span>
          <span>Social Companion</span>
        </div>
      </div>
      <div class="sc-tabs">
        <div class="sc-tab ${activeTabName === "notes" ? "active" : ""}" data-tab="notes">Notes</div>
        <div class="sc-tab ${activeTabName === "transcript" ? "active" : ""}" data-tab="transcript">Transcript</div>
        <div class="sc-tab ${activeTabName === "export" ? "active" : ""}" data-tab="export">Export</div>
      </div>

      <!-- Notes tab -->
      <div class="sc-content-panel ${activeTabName === "notes" ? "active" : ""}" id="sc-panel-notes">
        <div class="sc-quick-actions" role="group" aria-labelledby="sc-quick-actions-label">
          <div class="sc-quick-actions-head"><span class="sc-quick-actions-label" id="sc-quick-actions-label">Quick copy</span><span id="sc-transcript-quick-status" role="status" aria-live="polite"></span></div>
          <button class="sc-btn sc-btn-primary" id="sc-btn-copy-everything">Everything</button>
          <button class="sc-btn sc-btn-secondary" id="sc-btn-copy-notes">Notes</button>
          <button class="sc-btn sc-btn-secondary" id="sc-btn-copy-description">Description</button>
          <button class="sc-btn sc-btn-secondary" id="sc-btn-copy-metadata">Stats & Info</button>
          <button class="sc-btn sc-btn-secondary" id="sc-btn-copy-transcript-quick">Transcript</button>
          <button class="sc-btn sc-btn-secondary" id="sc-btn-sync-transcript-quick">↻ Sync transcript</button>
        </div>
        <div class="sc-notes-input-group">
          <textarea class="sc-textarea" id="sc-note-input" placeholder="Type a timestamped note... (Auto-pauses video)"></textarea>
          <div class="sc-btn-row">
            <button class="sc-btn sc-btn-primary" id="sc-btn-add-note">Add Note</button>
            <button class="sc-btn sc-btn-secondary" id="sc-btn-ss">📸 Screenshot</button>
            <div class="sc-options-row">
              <input type="checkbox" id="sc-chk-autopause" ${autoPauseOnType ? "checked" : ""}>
              <label for="sc-chk-autopause">Auto-Pause</label>
            </div>
          </div>
        </div>
        <div id="sc-screenshots-row" class="sc-screenshots-container"></div>
        <input type="text" class="sc-search-bar" id="sc-notes-search" placeholder="Search notes..." value="${notesSearchQuery}">
        <div id="sc-notes-list" style="margin-top: 12px;"></div>
      </div>

      <!-- Transcript tab -->
      <div class="sc-content-panel ${activeTabName === "transcript" ? "active" : ""}" id="sc-panel-transcript">
        <div class="sc-tools-panel">
          <div class="sc-transcript-header">
            <input type="text" class="sc-search-bar" style="margin-bottom:0; flex:1; margin-right:10px;" id="sc-transcript-search" placeholder="Search transcript..." value="${transcriptSearchQuery}">
            <button class="sc-btn sc-btn-secondary" style="font-size: 11px; padding: 6px 10px;" id="sc-btn-sync-transcript">🔄 Sync</button>
            <button class="sc-btn sc-btn-secondary" style="font-size: 11px; padding: 6px 10px; margin-left: 4px;" id="sc-btn-copy-transcript">Copy</button>
          </div>
          <div id="sc-transcript-status" role="status" aria-live="polite" style="margin:8px 0 0;padding:6px 8px;border:1px solid;border-radius:6px;font-size:11px;line-height:1.35;"></div>
          <div class="sc-transcript-list" id="sc-transcript-box">
            <div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">Loading transcript...</div>
          </div>
        </div>
      </div>

      <!-- Export tab -->
      <div class="sc-content-panel ${activeTabName === "export" ? "active" : ""}" id="sc-panel-export">
        <div class="sc-tools-panel">
          <button class="sc-btn sc-btn-primary" style="width: 100%; justify-content: center;" id="sc-btn-copy-all">Copy Notes & Info Markdown</button>
          <button class="sc-btn sc-btn-secondary" style="width: 100%; justify-content: center;" id="sc-btn-dl-md">Download Markdown File</button>
          <button class="sc-btn sc-btn-secondary" style="width: 100%; justify-content: center; margin-top: 6px;" id="sc-btn-dl-transcript">Download Transcript (.txt)</button>

          <div style="margin-top: 12px;">
            <strong style="font-size: 13px;">Markdown Preview:</strong>
            <pre id="sc-export-preview" style="font-size: 11px; white-space: pre-wrap; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 6px; margin-top: 6px; max-height: 180px; overflow-y: auto;"></pre>
          </div>

          <div style="margin-top: 16px;">
            <strong style="font-size: 13px;">Send context to AI chatbot:</strong>
            <div class="sc-llm-routing">
              <button class="sc-btn sc-btn-secondary" data-llm="chatgpt">ChatGPT</button>
              <button class="sc-btn sc-btn-secondary" data-llm="claude">Claude</button>
              <button class="sc-btn sc-btn-secondary" data-llm="gemini">Gemini</button>
              <button class="sc-btn sc-btn-secondary" data-llm="aistudio">AI Studio</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook tab listeners
    container.querySelectorAll(".sc-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const selectedTab = e.target.dataset.tab;
        activeTabName = selectedTab;
        container
          .querySelectorAll(".sc-tab")
          .forEach((t) => t.classList.remove("active"));
        container
          .querySelectorAll(".sc-content-panel")
          .forEach((p) => p.classList.remove("active"));

        e.target.classList.add("active");
        container
          .querySelector(`#sc-panel-${selectedTab}`)
          .classList.add("active");

        if (selectedTab === "export") {
          updateExportPreview();
        }
      });
    });

    // Auto-Pause & Inputs
    const noteInput = container.querySelector("#sc-note-input");
    const autoPauseChk = container.querySelector("#sc-chk-autopause");
    const notesSearch = container.querySelector("#sc-notes-search");
    const transcriptSearch = container.querySelector("#sc-transcript-search");

    autoPauseChk.addEventListener("change", (e) => {
      autoPauseOnType = e.target.checked;
      storage.set({ sc_preference_autopause: autoPauseOnType });
    });

    noteInput.addEventListener("focus", () => {
      if (autoPauseOnType) {
        const video = document.querySelector("video");
        if (video && !video.paused) {
          video.pause();
        }
      }
    });

    notesSearch.addEventListener("input", (e) => {
      notesSearchQuery = e.target.value;
      renderNotesList();
    });

    transcriptSearch.addEventListener("input", (e) => {
      transcriptSearchQuery = e.target.value;
      renderTranscript();
    });

    // Add Note
    container
      .querySelector("#sc-btn-add-note")
      .addEventListener("click", () => {
        const text = noteInput.value.trim();
        const video = document.querySelector("video");
        const time = video ? video.currentTime : 0.0;

        saveNote(currentVideoId, time, text || "[Marker Only]");
        noteInput.value = "";

        if (autoPauseOnType && video) {
          video.play().catch(() => {});
        }
      });

    container.querySelector("#sc-btn-ss").addEventListener("click", () => {
      capturePlayerScreenshot();
    });

    container.querySelector("#sc-btn-copy-everything").addEventListener("click", () => copyCompleteMarkdown());
    container.querySelector("#sc-btn-copy-notes").addEventListener("click", () => copyNotesOnly());
    container.querySelector("#sc-btn-copy-description").addEventListener("click", () => copyDescription());
    container.querySelector("#sc-btn-copy-metadata").addEventListener("click", () => copyMetadata());
    container.querySelector("#sc-btn-copy-transcript-quick").addEventListener("click", () => copyTranscript());
    container.querySelector("#sc-btn-sync-transcript-quick").addEventListener("click", () => forceSyncTranscript());

    // Sync button
    container
      .querySelector("#sc-btn-sync-transcript")
      .addEventListener("click", () => {
        forceSyncTranscript();
      });

    // Load screenshots from storage
    const ssKey = `sc_screenshots_${currentVideoId}`;
    storage.get([ssKey], (data) => {
      screenshotList = data[ssKey] || [];
      renderScreenshotsList();
    });

    renderNotesList();
    renderTranscript();
    renderTranscriptStatus();
    updateExportPreview();

    // Export operations
    container
      .querySelector("#sc-btn-copy-all")
      .addEventListener("click", () => copyCompleteMarkdown());
    container
      .querySelector("#sc-btn-dl-md")
      .addEventListener("click", () => downloadMarkdownFile());
    container
      .querySelector("#sc-btn-dl-transcript")
      .addEventListener("click", () => downloadTranscriptFile());
    container.querySelectorAll(".sc-llm-routing button").forEach((btn) => {
      btn.addEventListener("click", () => sendToLLM(btn.dataset.llm));
    });
  }

  async function updateExportPreview() {
    const preview = document.getElementById("sc-export-preview");
    if (preview) {
      try {
        const md = await generateMarkdown();
        cachedMarkdown = md;
        preview.textContent = md;
      } catch (err) {
        console.error("Failed to generate markdown preview:", err);
        preview.textContent = "Error generating preview: " + err.message;
      }
    }
  }

  // Screenshot capture & direct download
  function capturePlayerScreenshot() {
    const video = document.querySelector("video");
    if (!video) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");

      const timestamp = video ? video.currentTime : 0;
      // Add to preview container and save to storage with timestamp
      saveScreenshot(currentVideoId, dataUrl, timestamp);

      // Download directly to Downloads folder
      const a = document.createElement("a");
      a.href = dataUrl;
      const title =
        document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
          ?.innerText || "youtube";
      const cleanTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const time = Math.floor(timestamp);
      a.download = `screenshot_${cleanTitle}_${time}s.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error("Failed to capture frame screenshot", e);
    }
  }

  function saveScreenshot(videoId, dataUrl, timestamp) {
    const key = `sc_screenshots_${videoId}`;
    const frameUrl = canonicalYouTubeUrl(videoId, timestamp || 0);
    const ssObj = {
      dataUrl,
      timestamp: timestamp || 0,
      timestampUrl: frameUrl,
    };
    storage.get([key], (data) => {
      const list = data[key] || [];
      list.unshift(ssObj);
      if (list.length > 5) list.pop();
      storage.set({ [key]: list }, () => {
        screenshotList = list;
        renderScreenshotsList();
        showToast("📸 Screenshot saved!");
      });
    });
  }

  function renderScreenshotsList() {
    const container = document.getElementById("sc-screenshots-row");
    if (!container) return;
    container.innerHTML = "";

    if (screenshotList.length === 0) return;

    screenshotList.forEach((ss) => {
      const ssData =
        typeof ss === "object" && ss.dataUrl
          ? ss
          : { dataUrl: ss, timestamp: 0 };
      const frameUrl =
        ssData.timestampUrl ||
        canonicalYouTubeUrl(currentVideoId, ssData.timestamp || 0);

      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:relative; display:inline-block; border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); cursor:pointer;";

      const img = document.createElement("img");
      img.src = ssData.dataUrl;
      img.className = "sc-screenshot-thumbnail";
      img.title = "Click to download | Right-click to copy";

      const timeTag = document.createElement("div");
      timeTag.style.cssText =
        "position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.65);color:#fff;font-size:10px;font-weight:700;padding:3px 6px;display:flex;justify-content:space-between;align-items:center;";
      timeTag.innerHTML = `<span>${formatTime(ssData.timestamp || 0)}</span><a href="${frameUrl}" target="_blank" rel="noreferrer" style="color:#06b6d4;font-size:9px;text-decoration:none;" onclick="event.stopPropagation()">⧉ Open</a>`;

      img.addEventListener("click", async () => {
        // Try clipboard first, fall back to download
        try {
          const res = await fetch(ssData.dataUrl);
          const blob = await res.blob();
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob }),
          ]);
          showToast("📋 Screenshot copied to clipboard!");
        } catch {
          // Fallback: trigger download
          const a = document.createElement("a");
          a.href = ssData.dataUrl;
          a.download = `sc_screenshot_${Math.floor(ssData.timestamp || 0)}s.jpg`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          showToast("📥 Screenshot downloaded!");
        }
      });

      wrap.appendChild(img);
      wrap.appendChild(timeTag);
      container.appendChild(wrap);
    });
  }

  function seekTo(seconds) {
    const video = document.querySelector("video");
    if (video) {
      video.currentTime = parseFloat(seconds);
      video.play().catch(() => {});
    }
  }

  // Storage and Notes Management
  function saveNote(videoId, time, text) {
    const key = `sc_notes_${videoId}`;
    storage.get([key], (data) => {
      const notes = data[key] || [];
      notes.push({ id: Date.now().toString(), time, text });
      notes.sort((a, b) => a.time - b.time);
      storage.set({ [key]: notes }, () => {
        renderNotesList();
        injectTimelineMarkers();
      });
    });
  }

  function updateNote(noteId, newText) {
    const key = `sc_notes_${currentVideoId}`;
    storage.get([key], (data) => {
      const notes = data[key] || [];
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        note.text = newText || "[Marker Only]";
        storage.set({ [key]: notes }, () => {
          renderNotesList();
          injectTimelineMarkers();
        });
      }
    });
  }

  function deleteNote(noteId) {
    const key = `sc_notes_${currentVideoId}`;
    storage.get([key], (data) => {
      let notes = data[key] || [];
      notes = notes.filter((n) => n.id !== noteId);
      storage.set({ [key]: notes }, () => {
        renderNotesList();
        injectTimelineMarkers();
      });
    });
  }

  function renderNotesList() {
    const listContainer = document.getElementById("sc-notes-list");
    if (!listContainer) return;

    const key = `sc_notes_${currentVideoId}`;
    storage.get([key], (data) => {
      const notes = data[key] || [];

      const filtered = notes.filter((n) =>
        n.text.toLowerCase().includes(notesSearchQuery.toLowerCase()),
      );

      if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; font-size: 13px; padding: 12px 0;">No matching notes found.</div>`;
        return;
      }

      listContainer.innerHTML = filtered
        .map(
          (n) => `
        <div class="sc-note-item" id="sc-note-${n.id}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="sc-note-timestamp" data-time="${n.time}">${formatTime(n.time)}</div>
          </div>
          <div class="sc-note-text" id="sc-text-${n.id}">${escapeHtml(n.text)}</div>
          <div class="sc-note-actions">
            <button class="sc-note-action-btn sc-edit" data-edit-id="${n.id}">Edit</button>
            <button class="sc-note-action-btn sc-delete" data-del-id="${n.id}">Delete</button>
          </div>
        </div>
      `,
        )
        .join("");

      listContainer.querySelectorAll(".sc-note-timestamp").forEach((el) => {
        el.addEventListener("click", (e) => {
          seekTo(parseFloat(e.target.dataset.time));
        });
      });

      listContainer.querySelectorAll(".sc-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          deleteNote(e.target.dataset.delId);
        });
      });

      listContainer.querySelectorAll(".sc-edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const noteId = e.target.dataset.editId;
          enterNoteEditMode(noteId);
        });
      });
      updateExportPreview();
    });
  }

  function enterNoteEditMode(noteId) {
    const textDiv = document.getElementById(`sc-text-${noteId}`);
    const noteCard = document.getElementById(`sc-note-${noteId}`);
    if (!textDiv || !noteCard) return;

    const originalText =
      textDiv.innerText === "[Marker Only]" ? "" : textDiv.innerText;
    textDiv.innerHTML = `
      <textarea class="sc-textarea" id="sc-edit-textarea-${noteId}" style="min-height: 50px;">${escapeHtml(originalText)}</textarea>
    `;

    const actionsDiv = noteCard.querySelector(".sc-note-actions");
    actionsDiv.innerHTML = `
      <button class="sc-note-action-btn" id="sc-save-edit-${noteId}">Save</button>
      <button class="sc-note-action-btn" id="sc-cancel-edit-${noteId}">Cancel</button>
    `;

    document
      .getElementById(`sc-save-edit-${noteId}`)
      .addEventListener("click", () => {
        const newText = document
          .getElementById(`sc-edit-textarea-${noteId}`)
          .value.trim();
        updateNote(noteId, newText);
      });

    document
      .getElementById(`sc-cancel-edit-${noteId}`)
      .addEventListener("click", () => {
        renderNotesList();
      });
  }

  // Inject timeline markers
  function injectTimelineMarkers() {
    const progressBar = document.querySelector(".ytp-progress-bar");
    if (!progressBar) return;

    document.querySelectorAll(".sc-timeline-marker").forEach((m) => m.remove());

    const key = `sc_notes_${currentVideoId}`;
    storage.get([key], (data) => {
      const notes = data[key] || [];
      const video = document.querySelector("video");
      const duration = video ? video.duration : 0;

      if (!duration || notes.length === 0) return;

      notes.forEach((n) => {
        const pct = n.time / duration;
        const marker = document.createElement("div");
        marker.className = "sc-timeline-marker";
        marker.style.left = `${pct * 100}%`;

        const tooltip = document.createElement("div");
        tooltip.className = "sc-marker-tooltip";
        tooltip.textContent = `[${formatTime(n.time)}] ${n.text}`;
        marker.appendChild(tooltip);

        marker.addEventListener("click", (e) => {
          e.stopPropagation();
          seekTo(n.time);
        });

        progressBar.appendChild(marker);
      });
    });
  }

  // Force sync / clear stale data and reload transcript
  function forceSyncTranscript() {
    ytCaptions = [];
    hasAttemptedAutoClick = false;
    setTranscriptState("waiting", "Syncing captions — checking YouTube three times…");

    if (currentVideoId) {
      storage.set({ [`sc_transcript_${currentVideoId}`]: [] });
    }

    // Update the UI to show loading
    const transcriptBox = document.getElementById("sc-transcript-box");
    if (transcriptBox) {
      transcriptBox.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">Syncing transcript...</div>`;
    }

    const retryDelays = [0, 1400, 3600];
    retryDelays.forEach((delay, attempt) => {
      setTimeout(() => {
        if (ytCaptions.length > 0) return;
        fetchYouTubeTranscript();
        // A later retry is more likely to find YouTube's lazily rendered panel.
        scrapeNativeYouTubeTranscript(attempt > 0);
        if (attempt === retryDelays.length - 1) {
          setTimeout(() => {
            if (!ytCaptions.length) {
              setTranscriptState("unavailable", "No transcript exposed for this video after three checks.");
              showToast("ℹ️ Transcript still unavailable — YouTube may not expose one for this video");
            }
          }, 1200);
        }
      }, delay);
    });
  }

  // Fetch transcript: script parsing + DOM clicker fallback
  function fetchYouTubeTranscript() {
    ytCaptions = [];

    // First attempt: Scrape ytInitialPlayerResponse directly from script tags
    const playerResponse = getPlayerResponseFromScripts();
    const isResponseValidForCurrentVideo =
      playerResponse &&
      playerResponse.videoDetails &&
      playerResponse.videoDetails.videoId === currentVideoId;

    if (
      isResponseValidForCurrentVideo &&
      playerResponse.captions &&
      playerResponse.captions.playerCaptionsTracklistRenderer &&
      playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks
    ) {
      const tracks =
        playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      loadTranscriptFromTracks(tracks);
    } else {
      if (playerResponse?.videoDetails?.videoId && playerResponse.videoDetails.videoId !== currentVideoId) {
        setTranscriptState("mismatch", "Transcript data belongs to a different video — ignored.");
        return;
      }
      setTranscriptState("waiting", "Captions are not ready yet — checking YouTube’s transcript panel…");
      // Fallback: Scrape native transcript DOM
      scrapeNativeYouTubeTranscript();
    }
  }

  function getPlayerResponseFromScripts() {
    // Try global variable first (most reliable)
    try {
      if (window.ytInitialPlayerResponse?.videoDetails?.videoId) {
        return window.ytInitialPlayerResponse;
      }
    } catch (e) {}

    // Try from script tags with brace-depth parsing (handles nested JSON)
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent;
      if (!text) continue;

      // Try multiple patterns YouTube has used over time
      const patterns = [
        /ytInitialPlayerResponse\s*=\s*/,
        /var\s+ytInitialPlayerResponse\s*=\s*/,
        /window\["ytInitialPlayerResponse"\]\s*=\s*/,
      ];

      for (const pattern of patterns) {
        const idx = text.search(pattern);
        if (idx === -1) continue;

        const jsonStart = idx + text.substring(idx).match(pattern)[0].length;
        // Find matching closing brace using depth counting
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = jsonStart; i < text.length; i++) {
          const ch = text[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (ch === "\\" && inString) {
            escape = true;
            continue;
          }
          if (ch === '"') {
            inString = !inString;
            continue;
          }
          if (inString) continue;
          if (ch === "{") depth++;
          if (ch === "}") {
            depth--;
            if (depth === 0) {
              const jsonStr = text.substring(jsonStart, i + 1);
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed?.videoDetails?.videoId) return parsed;
              } catch (e) {
                // Try next pattern
              }
              break;
            }
          }
        }
      }
    }
    return null;
  }

  async function collectTranscriptForBackground() {
    const expectedVideoId = getYouTubeVideoId();
    let playerResponse = null;
    // `complete` happens before YouTube always exposes its player payload.
    // Keep this short and local to the inactive tab rather than treating a
    // missing first read as a permanent absence of captions.
    for (let attempt = 0; attempt < 10; attempt++) {
      playerResponse = getPlayerResponseFromScripts();
      if (playerResponse?.videoDetails?.videoId && (!expectedVideoId || playerResponse.videoDetails.videoId === expectedVideoId)) break;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    if (!playerResponse?.videoDetails?.videoId) {
      return { status: "no-transcript", reason: "YouTube player data was not available in time.", segments: [] };
    }
    if (expectedVideoId && playerResponse.videoDetails.videoId !== expectedVideoId) {
      return { status: "error", reason: "YouTube player data did not match the requested video.", segments: [] };
    }
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || !tracks.length) {
      return { status: "no-transcript", reason: "YouTube did not expose caption tracks for this video.", segments: [] };
    }
    const track = tracks.find((candidate) => candidate.languageCode === "en") || tracks[0];
    if (!track?.baseUrl) {
      return { status: "no-transcript", reason: "YouTube exposed a caption track without a usable URL.", segments: [] };
    }
    try {
      const response = await fetch(track.baseUrl);
      if (!response.ok) {
        return { status: "error", reason: `YouTube caption request failed (${response.status}).`, segments: [] };
      }
      const xml = await response.text();
      const documentXml = new DOMParser().parseFromString(xml, "text/xml");
      if (documentXml.querySelector("parsererror")) {
        return { status: "error", reason: "YouTube returned an unreadable caption response.", segments: [] };
      }
      const segments = Array.from(documentXml.getElementsByTagName("text"))
        .map((node) => ({
          start: Number.parseFloat(node.getAttribute("start")) || 0,
          duration: Number.parseFloat(node.getAttribute("dur")) || 0,
          text: decodeHtmlEntities(node.textContent || "").trim(),
        }))
        .filter((segment) => segment.text);
      if (!segments.length) {
        return { status: "no-transcript", reason: "The selected YouTube caption track contained no transcript segments.", segments: [] };
      }
      return { status: "complete", reason: "", languageCode: track.languageCode || "", segments };
    } catch (error) {
      return { status: "error", reason: error?.message || "Couldn't fetch the YouTube caption track.", segments: [] };
    }
  }

  async function loadTranscriptFromTracks(tracks) {
    const englishTrack =
      tracks.find((t) => t.languageCode === "en") || tracks[0];
    try {
      const res = await fetch(englishTrack.baseUrl);
      const text = await res.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      const textNodes = xmlDoc.getElementsByTagName("text");

      const isNoise = (t) =>
        /^\s*$/.test(t) ||
        /^\d+\s+(second|seconds|minute|minutes|hour|hours)/.test(t) ||
        /^\d+\s*,\s*\d+\s+(second|minute)/.test(t);

      ytCaptions = Array.from(textNodes)
        .map((node) => ({
          start: parseFloat(node.getAttribute("start")),
          duration: parseFloat(node.getAttribute("dur")) || 0.0,
          text: decodeHtmlEntities(node.textContent),
        }))
        .filter((c) => c.text.trim() !== "" && !isNoise(c.text));

      renderTranscript();
      // Persist transcript to storage for dashboard
      if (ytCaptions.length > 0 && currentVideoId) {
        storage.set({ [`sc_transcript_${currentVideoId}`]: ytCaptions });
        const playerVideoId = getPlayerResponseFromScripts()?.videoDetails?.videoId || currentVideoId;
        const duration = Number(document.querySelector("video")?.duration || 0);
        const lastStart = ytCaptions[ytCaptions.length - 1]?.start || 0;
        if (playerVideoId !== currentVideoId || (Number.isFinite(duration) && duration > 0 && lastStart > duration + 45)) {
          setTranscriptState("mismatch", "Transcript timing/video check failed — not marked ready.");
        } else {
          storage.set({ [`sc_transcript_meta_${currentVideoId}`]: { videoId: currentVideoId, durationSeconds: duration, segmentCount: ytCaptions.length, collectedAt: new Date().toISOString(), source: "caption-track" } });
          setTranscriptState("ready", `Transcript ready · ${ytCaptions.length} segments · caption track verified.`, "caption-track");
        }
      }
    } catch (e) {
      scrapeNativeYouTubeTranscript();
    }
  }

  // Periodic automatic sync helper
  function autoSyncNativeTranscript() {
    if (ytCaptions.length > 0) return;
    const isPanelOpen =
      document.querySelector("transcript-segment-view-model") ||
      document.querySelector("ytd-transcript-segment-renderer") ||
      document.querySelector(".ytwTranscriptSegmentViewModelHost");
    if (isPanelOpen) {
      scrapeNativeYouTubeTranscript(false);
    } else if (!hasAttemptedAutoClick) {
      hasAttemptedAutoClick = true;
      scrapeNativeYouTubeTranscript(true);
    }
  }

  // Dynamic deep transcript DOM scraper
  function scrapeNativeYouTubeTranscript(forceClick = false) {
    const transcriptBox = document.getElementById("sc-transcript-box");

    // Find all timestamped elements — covers old + new YouTube DOM
    const segmentEls = Array.from(
      document.querySelectorAll(
        "ytd-transcript-segment-renderer, " +
          "ytd-transcript-segment-list-renderer ytd-transcript-segment-renderer, " +
          "transcript-segment-view-model, " +
          ".ytwTranscriptSegmentViewModelHost, " +
          '[class*="TranscriptSegment"], ' +
          'ytd-transcript-body-renderer [class*="segment"], ' +
          "#segments-container ytd-transcript-segment-renderer",
      ),
    );

    // Also try to find segments inside the transcript panel if the above failed
    let effectiveEls = segmentEls;
    if (effectiveEls.length === 0) {
      const panel = document.querySelector(
        'ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
      );
      if (panel) {
        effectiveEls = Array.from(
          panel.querySelectorAll('[class*="segment"], [class*="Segment"]'),
        );
      }
    }

    if (effectiveEls.length > 0) {
      ytCaptions = effectiveEls
        .map((seg) => {
          let timeStr = "0:00";
          let text = "";

          const timeEl = seg.querySelector(
            '.ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp, [class*="timestamp"], [class*="Timestamp"], [class*="time"]',
          );
          const textEl = seg.querySelector(
            '.ytAttributedStringHost, .segment-text, span[role="text"], [class*="text"], [class*="Text"], yt-attributed-string',
          );

          if (timeEl) timeStr = timeEl.innerText.trim();
          else {
            const match = seg.innerText.match(/\d{1,2}:\d{2}(:\d{2})?/);
            if (match) timeStr = match[0];
          }

          if (textEl) text = textEl.innerText.trim();
          else
            text = seg.innerText
              .replace(timeStr, "")
              .replace(/\n/g, " ")
              .trim();

          const parts = timeStr.split(":").map(Number);
          let start = 0;
          if (parts.length === 3)
            start = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else start = parts[0] * 60 + parts[1];

          return { start, text };
        })
        .filter((c) => {
          if (c.text === "") return false;
          // Filter out YouTube accessibility duration labels like "7 seconds", "1 minute, 3 seconds"
          if (/^\d+\s+(second|seconds|minute|minutes|hour|hours)/i.test(c.text))
            return false;
          if (/^\d+\s+minute/i.test(c.text)) return false;
          return true;
        });

      if (ytCaptions.length > 0) {
        const playerVideoId = getPlayerResponseFromScripts()?.videoDetails?.videoId || currentVideoId;
        if (playerVideoId !== currentVideoId) {
          ytCaptions = [];
          setTranscriptState("mismatch", "Visible transcript belongs to a different video — ignored.");
          renderTranscript();
          return;
        }
        if (currentVideoId) {
          storage.set({ [`sc_transcript_${currentVideoId}`]: ytCaptions });
          storage.set({ [`sc_transcript_meta_${currentVideoId}`]: { videoId: currentVideoId, durationSeconds: Number(document.querySelector("video")?.duration || 0), segmentCount: ytCaptions.length, collectedAt: new Date().toISOString(), source: "YouTube transcript panel" } });
        }
        setTranscriptState("ready", `Transcript ready · ${ytCaptions.length} segments · page/video verified.`, "YouTube transcript panel");
        renderTranscript();
        return;
      }
    }

    if (forceClick) {
      // Try multiple selectors for the "Show transcript" button
      const showBtn =
        document.querySelector(
          "ytd-video-description-transcript-section-renderer button",
        ) ||
        document.querySelector(
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"] button, button[aria-label*="transcript"], button[aria-label*="Transcript"]',
        ) ||
        Array.from(document.querySelectorAll("button")).find((el) => {
          const txt = el.innerText.toLowerCase();
          return txt.includes("show transcript") || txt.includes("transcript");
        });
      if (showBtn) {
        showBtn.click();
      }
    }
  }

  function renderTranscript() {
    const transcriptBox = document.getElementById("sc-transcript-box");
    if (!transcriptBox) return;

    if (ytCaptions.length === 0) {
      transcriptBox.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">No transcript loaded.</div>`;
      updateExportPreview();
      return;
    }

    const filtered = ytCaptions.filter((c) =>
      c.text.toLowerCase().includes(transcriptSearchQuery.toLowerCase()),
    );

    if (filtered.length === 0) {
      transcriptBox.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">No matching transcript lines.</div>`;
      updateExportPreview();
      return;
    }

    transcriptBox.innerHTML = filtered
      .map(
        (c) => `
      <div class="sc-transcript-line">
        <span class="sc-transcript-time" data-time="${c.start}">${formatTime(c.start)}</span>
        <span>${escapeHtml(c.text)}</span>
      </div>
    `,
      )
      .join("");

    transcriptBox.querySelectorAll(".sc-transcript-time").forEach((el) => {
      el.addEventListener("click", (e) => {
        seekTo(parseFloat(e.target.dataset.time));
      });
    });

    const copyBtn = document.getElementById("sc-btn-copy-transcript");
    if (copyBtn) {
      copyBtn.onclick = () => copyTranscript();
    }
    updateExportPreview();
  }

  // Extract page metadata
  function extractYouTubeMetadata() {
    const title =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string")
        ?.innerText ||
      document.querySelector("h1.ytd-watch-metadata")?.innerText ||
      document.title;
    const channelEl =
      document.querySelector(
        "ytd-watch-metadata ytd-video-owner-renderer #channel-name a",
      ) ||
      document.querySelector("ytd-video-owner-renderer #channel-name a") ||
      document.querySelector("#upload-info #channel-name a") ||
      document.querySelector("#channel-name a");
    const channel = channelEl ? channelEl.innerText.trim() : "Unknown";
    const subCount =
      document.querySelector(
        "ytd-watch-metadata ytd-video-owner-renderer #owner-sub-count",
      )?.innerText ||
      document.querySelector("ytd-video-owner-renderer #owner-sub-count")
        ?.innerText ||
      "";
    const views =
      document.querySelector("ytd-watch-metadata #info-container #info span")
        ?.innerText ||
      document.querySelector(
        "#info-container #info span, ytd-watch-info-text #info span",
      )?.innerText ||
      "";

    // Full description
    const descEl = document.querySelector(
      "#description-inline-expander yt-attributed-string, " +
        "#description-inline-expander .ytd-text-inline-expander, " +
        "ytd-text-inline-expander yt-attributed-string, " +
        "ytd-text-inline-expander span",
    );
    const description = descEl ? descEl.innerText.trim() : "";

    // Video like count
    const likesEl =
      document.querySelector('like-button-view-model button button') ||
      document.querySelector('like-button-view-model button') ||
      document.querySelector('#top-level-buttons-computed like-button-view-model button') ||
      document.querySelector('#top-level-buttons-computed ytd-toggle-button-renderer button');
    const likes = likesEl ? likesEl.getAttribute('aria-label') || likesEl.innerText.trim() : '';

    // Upload date — prefer meta tag, fallback to info text
    const dateMeta = document.querySelector('meta[itemprop="datePublished"]');
    const uploadDate = dateMeta ? dateMeta.getAttribute('content') || '' : '';

    // Comments count — split off any 'Sort by' junk
    const commentsTitleEl = document.querySelector(
      "ytd-comments #title yt-formatted-string, ytd-comments #title span",
    );
    const commentsCount = commentsTitleEl
      ? commentsTitleEl.innerText.trim().split("\n")[0].trim()
      : document
          .querySelector("ytd-comments #title")
          ?.innerText.trim()
          .split("\n")[0] || "";

    // Hashtags — deduplicated
    const tagSet = new Set();
    document.querySelectorAll('a[href*="/hashtag/"]').forEach((el) => {
      const t = el.innerText.trim();
      if (t) tagSet.add(t);
    });
    const tags = [...tagSet].join(", ") || "";

    // Sidebar topic/filter chips — exact DOM: chip-shape button > div.ytChipShapeChip > div
    const topicChips = [];
    document
      .querySelectorAll("yt-chip-cloud-chip-renderer chip-shape button")
      .forEach((btn) => {
        const label = btn.innerText.trim();
        if (label && label !== "All") topicChips.push(label);
      });

    // Comments — up to 10, with reply count
    const comments = [];
    document
      .querySelectorAll("ytd-comment-thread-renderer")
      .forEach((el, idx) => {
        if (idx >= 10) return;
        const author =
          el.querySelector("#author-text span")?.innerText.trim() ||
          "Anonymous";
        const text = el.querySelector("#content-text")?.innerText.trim() || "";
        const likes =
          el.querySelector("#vote-count-middle")?.innerText.trim() || "0";
        const pfp = el.querySelector("#author-thumbnail img")?.src || "";

        // Reply count: look for the replies expander button text like "View 3 replies"
        let replyCount = "";
        const repliesSection = el.querySelector("#replies");
        if (repliesSection) {
          // Try multiple selectors for the reply count text
          const replyEl =
            repliesSection.querySelector("#more-replies yt-formatted-string") ||
            repliesSection.querySelector(
              "#reply-count-text yt-formatted-string",
            ) ||
            repliesSection.querySelector(
              "ytd-button-renderer yt-formatted-string",
            ) ||
            repliesSection.querySelector(
              "tp-yt-paper-button yt-formatted-string",
            ) ||
            repliesSection.querySelector('[class*="reply"]');
          if (replyEl) {
            const raw = replyEl.innerText.trim();
            if (raw && /\d/.test(raw)) replyCount = raw; // only keep if has a number
          }
          // Fallback: check if replies are already expanded and count them
          if (!replyCount) {
            const expandedReplies = repliesSection.querySelectorAll(
              "ytd-comment-renderer",
            ).length;
            if (expandedReplies > 0)
              replyCount = `${expandedReplies} repl${expandedReplies === 1 ? "y" : "ies"} (expanded)`;
          }
        }

        comments.push({ author, text, likes, pfp, replyCount });
      });

    // Recommendations — YouTube new lockup-view-model DOM (replaces ytd-compact-video-renderer)
    const recVids = [];
    const lockupEls = document.querySelectorAll(
      "#secondary-inner yt-lockup-view-model, " +
        "#related yt-lockup-view-model, " +
        "ytd-watch-next-secondary-results-renderer yt-lockup-view-model",
    );
    lockupEls.forEach((el, idx) => {
      if (idx >= 15) return;

      // Title: h3 title attribute is most reliable (populated even before text renders)
      const h3 = el.querySelector(
        "h3.ytLockupMetadataViewModelHeadingReset, h3[title]",
      );
      const titleText =
        h3?.getAttribute("title") ||
        h3?.querySelector("span")?.innerText.trim() ||
        "";
      if (!titleText) return;

      // Link: thumbnail anchor is always present
      const linkEl = el.querySelector(
        "a.ytLockupViewModelContentImage, a.ytLockupMetadataViewModelTitle",
      );
      const href = linkEl?.getAttribute("href") || "";

      // Channel: first metadata row (no leading icon), first text span
      const metaRows = el.querySelectorAll(
        ".ytContentMetadataViewModelMetadataRow",
      );
      let channelText = "";
      let viewsText = "";
      let ageText = "";

      metaRows.forEach((row, rowIdx) => {
        if (rowIdx === 0) {
          // Channel row — first attributedString span that isn’t an icon wrapper
          channelText =
            row
              .querySelector("span.ytAttributedStringHost")
              ?.innerText.trim() || "";
        } else if (rowIdx === 1) {
          // Views + age row — use aria-labels for reliable extraction
          row.querySelectorAll("span[aria-label]").forEach((span) => {
            const label = span.getAttribute("aria-label") || "";
            if (label.includes("view")) viewsText = span.innerText.trim();
            if (
              label.includes("ago") ||
              label.includes("hour") ||
              label.includes("day") ||
              label.includes("week") ||
              label.includes("month") ||
              label.includes("year")
            )
              ageText = span.innerText.trim();
          });
        }
      });

      // Duration badge
      const durationEl = el.querySelector(".ytBadgeShapeText");
      const duration = durationEl?.innerText.trim() || "";

      // Thumbnail
      const imgEl = el.querySelector("img.ytCoreImageHost");

      const fullUrl = href.startsWith("http")
        ? href
        : `https://www.youtube.com${href}`;

      recVids.push({
        title: titleText,
        channel: channelText,
        views: viewsText,
        age: ageText,
        duration,
        url: fullUrl,
        thumbnail: imgEl?.src || "",
      });
    });

    // Playlist / Queue detection
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get("list");
    let playlistTitle = "",
      playlistUrl = "",
      playlistIndex = "";
    if (playlistId) {
      playlistTitle =
        document.querySelector(
          "ytd-playlist-panel-renderer #title-container #title",
        )?.innerText || "Playlist/Queue";
      playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      playlistIndex = urlParams.get("index") || "1";
    }
    const durationSeconds = Number(document.querySelector("video")?.duration || 0);
    const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? formatTime(durationSeconds) : "";

    return {
      title,
      channel,
      subCount,
      views,
      commentsCount,
      tags,
      topicChips,
      comments,
      description,
      likes,
      uploadDate,
      duration,
      durationSeconds,
      url: canonicalYouTubeUrl(currentVideoId),
      thumbnail: `https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`,
      recommendations: recVids,
      playlistId,
      playlistTitle,
      playlistUrl,
      playlistIndex,
    };
  }

  async function generateMarkdown() {
    const meta = extractYouTubeMetadata();
    const notesKey = `sc_notes_${currentVideoId}`;
    const notesData = await storage.getAsync([notesKey]);
    const notes = notesData[notesKey] || [];

    // Use live captions, fall back to cached in storage
    let captions = ytCaptions;
    if (captions.length === 0) {
      const transcriptKey = `sc_transcript_${currentVideoId}`;
      const cached = await storage.getAsync([transcriptKey]);
      captions = cached[transcriptKey] || [];
    }

    let md = "";

    // Metadata block (YAML Frontmatter must be at the very top for Obsidian/parsers)
    md += `---\n`;
    md += `Title: ${meta.title}\n`;
    md += `Channel: ${meta.channel}\n`;
    if (meta.subCount) md += `Subscribers: ${meta.subCount}\n`;
    if (meta.views) md += `Views: ${meta.views}\n`;
    if (meta.commentsCount) md += `Comments: ${meta.commentsCount}\n`;
    if (meta.tags) md += `Tags: ${meta.tags}\n`;
    md += `URL: ${meta.url}\n`;
    md += `Thumbnail: ${meta.thumbnail}\n`;
    if (meta.playlistId) {
      md += `Playlist: ${meta.playlistTitle}\n`;
      md += `Playlist URL: ${meta.playlistUrl}\n`;
      md += `Playlist Index: ${meta.playlistIndex}\n`;
    }
    if (meta.likes) md += `Likes: ${meta.likes}\n`;
    if (meta.uploadDate) md += `Published: ${meta.uploadDate}\n`;
    if (meta.duration) md += `Duration: ${meta.duration}\n`;
    if (transcriptState.videoId === currentVideoId) {
      md += `Transcript Status: ${transcriptState.status}\n`;
      if (transcriptState.source) md += `Transcript Source: ${transcriptState.source}\n`;
      if (transcriptState.updatedAt) md += `Transcript Checked: ${transcriptState.updatedAt}\n`;
    }
    md += `Copied: ${new Date().toISOString().slice(0, 10)}\n`;
    if (meta.description) {
      md += `Description: ${meta.description.trim().replace(/\n/g, ' ')}\n`;
    }
    md += `---\n\n`;

    // Personal Notes & Markers
    md += `# Personal Notes & Markers\n\n`;
    if (notes.length === 0) {
      md += `*No notes added yet.*\n\n`;
    } else {
      notes.forEach((n) => {
        md += `- **[${formatTime(n.time)}]** (${canonicalYouTubeUrl(currentVideoId, n.time)}): ${n.text}\n`;
      });
      md += `\n`;
    }

    // Transcript
    md += `# Transcript\n\n`;
    if (captions.length === 0) {
      md += `*Transcript not loaded. Click "Sync" in the Transcript tab.*\n\n`;
    } else {
      captions.forEach((c) => {
        md += `[${formatTime(c.start)}] ${c.text}\n`;
      });
      md += `\n`;
    }

    // Comments
    md += `# Comments\n\n`;
    if (meta.comments.length === 0) {
      md += `*No comments visible (scroll down on the page to load comments first).*\n\n`;
    } else {
      meta.comments.forEach((c, idx) => {
        const replyNote = c.replyCount ? ` — ${c.replyCount}` : "";
        md += `${idx + 1}. **${c.author}** (👍 ${c.likes}${replyNote}): ${c.text}\n`;
      });
      md += `\n`;
    }

    // Recommendations — with sidebar topic chips and duration
    md += `# Recommendations\n\n`;
    if (meta.topicChips && meta.topicChips.length > 0) {
      md += `**Topics:** ${meta.topicChips.join(" · ")}\n\n`;
    }
    if (meta.recommendations && meta.recommendations.length > 0) {
      meta.recommendations.forEach((r, i) => {
        const age = r.age ? ` · ${r.age}` : "";
        const dur = r.duration ? ` [${r.duration}]` : "";
        md += `${i + 1}. **${r.title}**${dur} — ${r.channel} (${r.views}${age})\n   ${r.url}\n   ${r.thumbnail}\n`;
      });
    } else {
      md += `*No recommendations found. Scroll the sidebar to load them, then re-open the Export tab.*\n`;
    }

    return md;
  }

  function scCopyText(text) {
    // Use clipboard API with fallback to textarea execCommand
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      return navigator.clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => {
          try {
            return scCopyFallback(text);
          } catch (error) {
            console.error("Copy fallback failed", error);
            return false;
          }
        });
    }
    return Promise.resolve()
      .then(() => scCopyFallback(text))
      .catch((error) => {
        console.error("Copy fallback failed", error);
        return false;
      });
  }

  async function copyNotesOnly() {
    try {
      const notesKey = `sc_notes_${currentVideoId}`;
      const data = await storage.getAsync([notesKey]);
      const notes = data[notesKey] || [];
      if (!notes.length) {
        showToast("ℹ️ No notes available to copy yet");
        return;
      }
      const text = notes
        .map(
          (note) =>
            `- [${formatTime(note.time)}] ${note.text}\n  ${canonicalYouTubeUrl(currentVideoId, note.time)}`,
        )
        .join("\n");
      const copied = await scCopyText(text);
      showToast(
        copied
          ? "📋 Notes copied!"
          : "❌ Couldn't copy notes — allow clipboard access and try again",
      );
    } catch (error) {
      console.error("Copy notes failed", error);
      showToast("❌ Couldn't prepare notes to copy — try again");
    }
  }

  async function copyTranscript() {
    try {
      let captions = ytCaptions;
      if (!captions.length) {
        const data = await storage.getAsync([`sc_transcript_${currentVideoId}`]);
        captions = data[`sc_transcript_${currentVideoId}`] || [];
      }
      if (!captions.length) {
        showToast("ℹ️ No transcript available — use Sync, or YouTube may not expose one");
        return;
      }
      const text = captions
        .map((caption) => `[${formatTime(caption.start)}] ${caption.text}`)
        .join("\n");
      const copied = await scCopyText(text);
      showToast(
        copied
          ? "📋 Transcript copied!"
          : "❌ Couldn't copy transcript — allow clipboard access and try again",
      );
    } catch (error) {
      console.error("Copy transcript failed", error);
      showToast("❌ Couldn't prepare transcript to copy — try Sync again");
    }
  }

  async function copyDescription() {
    try {
      const description = extractYouTubeMetadata().description;
      if (!description) {
        showToast("ℹ️ No description available to copy");
        return;
      }
      const copied = await scCopyText(description);
      showToast(
        copied
          ? "📋 Description copied!"
          : "❌ Couldn't copy description — allow clipboard access and try again",
      );
    } catch (error) {
      console.error("Copy description failed", error);
      showToast("❌ Couldn't prepare description to copy — try again");
    }
  }

  async function copyMetadata() {
    try {
      const meta = extractYouTubeMetadata();
      const fields = [
        ["Title", meta.title],
        ["Channel", meta.channel],
        ["Subscribers", meta.subCount],
        ["Views", meta.views],
        ["Likes", meta.likes],
        ["Comments", meta.commentsCount],
        ["Published", meta.uploadDate],
        ["Tags", meta.tags],
        ["URL", meta.url],
      ].filter(([, value]) => value);
      if (!fields.length) {
        showToast("ℹ️ No stats or video info available to copy");
        return;
      }
      const copied = await scCopyText(
        fields.map(([label, value]) => `${label}: ${value}`).join("\n"),
      );
      showToast(
        copied
          ? "📋 Stats & info copied!"
          : "❌ Couldn't copy stats & info — allow clipboard access and try again",
      );
    } catch (error) {
      console.error("Copy stats & info failed", error);
      showToast("❌ Couldn't prepare stats & info to copy — try again");
    }
  }

  function scCopyFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (e) {
      console.error("Copy failed", e);
    } finally {
      ta.remove();
    }
    return copied;
  }

  function showToast(msg, duration = 2600) {
    let t = document.getElementById("sc-toast-notif");
    if (!t) {
      t = document.createElement("div");
      t.id = "sc-toast-notif";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      t.setAttribute("aria-atomic", "true");
      t.style.cssText = `
        position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(10px);
        background: rgba(30,30,45,0.97); border: 1px solid rgba(139,92,246,0.5);
        color: #f1f5f9; padding: 11px 22px; border-radius: 50px;
        font-size: 13px; font-weight: 600; z-index: 2147483647;
        opacity: 0; transition: opacity 0.2s ease, transform 0.2s ease;
        pointer-events: none; white-space: nowrap;
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      `;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    t.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateX(-50%) translateY(10px)";
    }, duration);
  }

  async function copyCompleteMarkdown() {
    // Use pre-cached markdown so clipboard fires synchronously inside the user gesture.
    // If cache empty (tab opened but preview not yet loaded), refresh then copy.
    try {
      const markdown = cachedMarkdown || await generateMarkdown();
      cachedMarkdown = markdown;
      const copied = await scCopyText(markdown);
      showToast(
        copied
          ? "📋 Markdown copied to clipboard!"
          : "❌ Copy failed — allow clipboard access or try Download instead",
      );
    } catch (err) {
      console.error("copyCompleteMarkdown error:", err);
      showToast("❌ Copy failed — try clicking Download instead");
    }
  }

  async function downloadCaptureText(content, filename, type, folder) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "sc_download_archive_file",
        content,
        filename,
        mimeType: type,
        folder,
      });
      if (response?.ok) return true;
      throw new Error(response?.reason || "The archive download could not be started.");
    } catch (error) {
      // Keep a local browser fallback for older extension installs/background restarts.
      console.warn("Archive download service unavailable; falling back to page download", error);
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return false;
    }
  }

  async function downloadMarkdownFile({ toast = true } = {}) {
    try {
      if (!currentVideoId) {
        const reason = "Open a YouTube video before saving a capture.";
        if (toast) showToast(`ℹ️ ${reason}`);
        return { ok: false, reason };
      }
      const md = await generateMarkdown();
      const meta = extractYouTubeMetadata();
      const archived = await downloadCaptureText(md, `${(meta.title || "video").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_notes.md`, "text/markdown", "captures");
      if (toast) showToast(archived ? "📥 Markdown saved to Downloads/Social Companion/captures." : "📥 Markdown downloaded (archive folder unavailable).");
      return { ok: true, title: meta.title || "video" };
    } catch (err) {
      console.error("downloadMarkdownFile error:", err);
      if (toast) showToast("❌ Download failed: " + err.message);
      return { ok: false, reason: err?.message || "Download failed." };
    }
  }

  async function downloadTranscriptFile({ toast = true } = {}) {
    try {
      if (!currentVideoId) {
        const reason = "Open a YouTube video before downloading a transcript.";
        if (toast) showToast(`ℹ️ ${reason}`);
        return { ok: false, reason };
      }
      let captions = ytCaptions;
      if (!captions.length) {
        const data = await storage.getAsync([`sc_transcript_${currentVideoId}`]);
        captions = data[`sc_transcript_${currentVideoId}`] || [];
      }
      if (!captions.length) {
        const reason = "No transcript is saved — use Sync, or YouTube may not expose one.";
        if (toast) showToast(`ℹ️ ${reason}`);
        return { ok: false, reason };
      }
      const meta = extractYouTubeMetadata();
      const transcript = [
        meta.title || "YouTube transcript",
        canonicalYouTubeUrl(currentVideoId),
        `Saved: ${new Date().toISOString()}`,
        "",
        ...captions.map((caption) => `[${formatTime(caption.start)}] ${caption.text}`),
      ].join("\n");
      const archived = await downloadCaptureText(transcript, `${(meta.title || "video").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_transcript.txt`, "text/plain", "transcripts");
      if (toast) showToast(archived ? `📥 Transcript saved to Downloads/Social Companion/transcripts — ${captions.length} segments.` : `📥 Transcript downloaded — ${captions.length} segments.`);
      return { ok: true, segments: captions.length, title: meta.title || "video" };
    } catch (error) {
      console.error("downloadTranscriptFile error:", error);
      const reason = error?.message || "Transcript download failed.";
      if (toast) showToast(`❌ ${reason}`);
      return { ok: false, reason };
    }
  }

  async function sendToLLM(target) {
    const md = await generateMarkdown();
    const promptText = encodeURIComponent(
      `Please review the transcript, notes, and metadata of this video and summarize the main takeaways:\n\n${md}`,
    );

    let url = "";
    switch (target) {
      case "chatgpt":
        url = `https://chatgpt.com/?q=${promptText}`;
        break;
      case "claude":
        url = `https://claude.ai/new`;
        break;
      case "gemini":
        url = `https://gemini.google.com/app`;
        break;
      case "aistudio":
        url = `https://aistudio.google.com/`;
        break;
    }

    if (url) {
      window.open(url, "_blank");
    }
  }

  // --- X (Twitter) & Reddit Content Panels ---
  function initSocialCompanion(platform) {
    const fab = document.createElement("div");
    fab.className = "sc-floating-action-button";
    fab.innerHTML = "🚀";
    fab.title = `Open Social Companion for ${platform === "x" ? "X (Twitter)" : "Reddit"}`;
    document.body.appendChild(fab);

    let panel = null;
    fab.addEventListener("click", () => {
      if (panel) {
        panel.remove();
        panel = null;
      } else {
        panel = createSocialPanel(platform);
        document.body.appendChild(panel);
      }
    });
  }

  function createSocialPanel(platform) {
    const panel = document.createElement("div");
    panel.className = "sc-floating-panel sc-adaptive-theme";

    panel.innerHTML = `
      <div class="sc-header">
        <div class="sc-header-title">
          <span>🔮 Social Companion (${platform === "x" ? "X" : "Reddit"})</span>
        </div>
        <span class="sc-close-btn" style="cursor:pointer; font-weight: bold;">✕</span>
      </div>
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; overflow-y: auto;">
        <button class="sc-btn sc-btn-primary" style="width:100%; justify-content: center;" id="sc-social-btn-copy">Copy Thread/Post Markdown</button>
        <button class="sc-btn sc-btn-secondary" style="width:100%; justify-content: center;" id="sc-social-btn-dl">Download Markdown File</button>

        <div style="margin-top: 12px;">
          <strong style="font-size: 13px;">Forward context to AI Chatbot:</strong>
          <div class="sc-llm-routing">
            <button class="sc-btn sc-btn-secondary" data-llm="chatgpt">ChatGPT</button>
            <button class="sc-btn sc-btn-secondary" data-llm="claude">Claude</button>
            <button class="sc-btn sc-btn-secondary" data-llm="gemini">Gemini</button>
            <button class="sc-btn sc-btn-secondary" data-llm="grok">Grok</button>
          </div>
          <div id="sc-social-ai-status" role="status" aria-live="polite" style="margin-top:8px; min-height:16px; color:var(--sc-text-muted-light); font-size:11px;"></div>
        </div>

        <div style="margin-top: 12px; border-top: 1px solid var(--sc-border-light); padding-top: 12px;">
          <strong style="font-size: 13px;">Extracted Content Preview:</strong>
          <pre id="sc-social-preview" style="font-size: 11px; white-space: pre-wrap; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 6px; margin-top: 6px; max-height: 180px; overflow-y: auto;"></pre>
        </div>
      </div>
    `;

    panel.querySelector(".sc-close-btn").addEventListener("click", () => {
      panel.remove();
    });

    const previewBox = panel.querySelector("#sc-social-preview");

    const scraped = platform === "x" ? scrapeXThread() : scrapeRedditPost();
    const md = formatSocialMarkdown(scraped, platform);
    previewBox.textContent = md;

    panel.querySelector("#sc-social-btn-copy").addEventListener("click", () => {
      navigator.clipboard.writeText(md);
      alert("Social data copied to clipboard as Markdown!");
    });

    panel.querySelector("#sc-social-btn-dl").addEventListener("click", () => {
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${platform}_scraped_post.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    panel.querySelectorAll(".sc-llm-routing button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const target = btn.dataset.llm;
        const status = panel.querySelector("#sc-social-ai-status");
        status.textContent = `Sending this ${platform} capture to ${target}…`;
        try {
          const response = await chrome.runtime.sendMessage({
            type: "sc_provider_prompt",
            provider: target,
            prompt: `Summarize or answer questions based on this ${platform} post/thread capture:\n\n${md}`,
            autoSubmit: true,
            startNewChat: true,
          });
          status.textContent = response?.ok
            ? (response.submitted ? `Sent in ${target}.` : `Inserted in ${target}; open its tab to send.`)
            : (response?.reason || `Could not send to ${target}.`);
        } catch (error) {
          status.textContent = error?.message || `Could not send to ${target}.`;
        }
      });
    });

    return panel;
  }

  function scrapeXThread() {
    const author =
      document.querySelector('[data-testid="User-Name"] span')?.innerText ||
      "Unknown";
    const postText =
      document.querySelector('[data-testid="tweetText"]')?.innerText || "";
    const stats = Array.from(
      document.querySelectorAll(
        '[data-testid="reply"], [data-testid="retweet"], [data-testid="like"]',
      ),
    ).map((el) => el.innerText);

    return {
      author,
      text: postText,
      stats: stats.join(" | ") || "No stats found",
      url: window.location.href,
    };
  }

  function scrapeRedditPost() {
    const title =
      document.querySelector("shreddit-title")?.getAttribute("title") ||
      document.title;
    const author =
      document.querySelector('a[href*="/user/"]')?.innerText || "Unknown";
    const text =
      document.querySelector('div[id*="-post-rtjson-content"]')?.innerText ||
      "";

    return {
      title,
      author,
      text,
      url: window.location.href,
    };
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
})();
