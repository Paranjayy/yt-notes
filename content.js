// Social Companion & YT Note-Taker Content Script
// Handles YouTube, X (Twitter), and Reddit pages

(function () {
  'use strict';

  // Destructure helpers from global scope
  const { formatTime, escapeHtml, decodeHtmlEntities } = window;

  // Inject CSS styles into the page (Glassmorphism, High Aesthetics)
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Common Design System & Variables */
    :root {
      --sc-primary: #8b5cf6;
      --sc-primary-hover: #7c3aed;
      --sc-secondary: #ec4899;
      --sc-bg-light: rgba(255, 255, 255, 0.85);
      --sc-bg-dark: rgba(24, 24, 37, 0.95);
      --sc-text-light: #0f172a;
      --sc-text-dark: #f8fafc;
      --sc-text-muted-light: #64748b;
      --sc-text-muted-dark: #94a3b8;
      --sc-border-light: rgba(0, 0, 0, 0.08);
      --sc-border-dark: rgba(255, 255, 255, 0.08);
      --sc-accent-red: #f43f5e;
      --sc-accent-green: #10b981;
      --sc-glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
      --sc-glass-blur: blur(12px);
    }

    /* Embedded Companion Widget Container */
    #sc-youtube-widget {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin-bottom: 20px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid var(--sc-border-light);
      background: var(--sc-bg-light);
      color: var(--sc-text-light);
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
      background: linear-gradient(135deg, var(--sc-primary), var(--sc-secondary));
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
      background: rgba(0,0,0,0.02);
      border-bottom: 1px solid var(--sc-border-light);
      padding: 4px;
      gap: 4px;
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
      color: var(--sc-text-muted-light);
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
      border: 1px solid var(--sc-border-light);
      background: rgba(0,0,0,0.02);
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
      background: rgba(0,0,0,0.05);
      color: inherit;
      border: 1px solid var(--sc-border-light);
    }
    html[theme="dark"] .sc-btn-secondary,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-btn-secondary {
        background: rgba(255,255,255,0.05);
        border-color: var(--sc-border-dark);
      }
    }
    .sc-btn-secondary:hover {
      background: rgba(0,0,0,0.08);
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
      color: var(--sc-text-muted-light);
    }

    .sc-note-item {
      display: flex;
      flex-direction: column;
      padding: 12px;
      border-radius: 10px;
      background: rgba(0,0,0,0.01);
      border: 1px solid var(--sc-border-light);
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
      background: rgba(139, 92, 246, 0.1);
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
      border-top: 1px solid var(--sc-border-light);
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
      color: var(--sc-text-muted-light);
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
      border: 1px solid var(--sc-border-light);
      background: rgba(0,0,0,0.02);
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
      border: 1px solid var(--sc-border-light);
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
      background: rgba(139, 92, 246, 0.08);
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
      border: 1px solid var(--sc-border-light);
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
      border: 1px solid var(--sc-border-light);
      background: var(--sc-bg-light);
      color: var(--sc-text-light);
      box-shadow: var(--sc-glass-shadow);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    html[theme="dark"] .sc-floating-panel,
    @media (prefers-color-scheme: dark) {
      .sc-floating-panel.sc-adaptive-theme {
        background: var(--sc-bg-dark);
        color: var(--sc-text-dark);
        border-color: var(--sc-border-dark);
      }
    }
  `;
  document.head.appendChild(styleEl);

  // Bulletproof Storage Wrapper
  const storage = {
    get: (keys, callback) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
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
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
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
    }
  };

  function fallbackGet(keys, callback) {
    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach(k => {
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
    Object.keys(items).forEach(k => {
      try {
        localStorage.setItem(k, JSON.stringify(items[k]));
      } catch (e) {}
    });
    if (callback) callback();
  }

  // Global variables
  let currentVideoId = '';
  let activeTabName = 'notes';
  let ytCaptions = [];
  let screenshotList = [];
  let autoPauseOnType = true;
  let notesSearchQuery = '';
  let transcriptSearchQuery = '';

  // Initialize script depending on host
  const host = location.hostname;
  if (host.includes('youtube.com')) {
    initYouTubeWatcher();
  } else if (host.includes('twitter.com') || host.includes('x.com')) {
    initSocialCompanion('x');
  } else if (host.includes('reddit.com')) {
    initSocialCompanion('reddit');
  }

  // --- YouTube Scripting & Logic ---
  function initYouTubeWatcher() {
    let lastUrl = location.href;
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

  function onYouTubeUrlChange() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');

    if (videoId) {
      currentVideoId = videoId;
      injectYouTubeWidget();
      injectTimelineMarkers();
      fetchYouTubeTranscript();
    } else {
      const existing = document.getElementById('sc-youtube-widget');
      if (existing) existing.remove();
    }
  }

  function injectYouTubeWidget() {
    const target = document.querySelector('#secondary-inner') || document.querySelector('#secondary');
    if (!target) {
      setTimeout(injectYouTubeWidget, 1500);
      return;
    }

    let widget = document.getElementById('sc-youtube-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'sc-youtube-widget';
      widget.className = 'sc-adaptive-theme';
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
        <div class="sc-tab ${activeTabName === 'notes' ? 'active' : ''}" data-tab="notes">Notes</div>
        <div class="sc-tab ${activeTabName === 'transcript' ? 'active' : ''}" data-tab="transcript">Transcript</div>
        <div class="sc-tab ${activeTabName === 'export' ? 'active' : ''}" data-tab="export">Export</div>
      </div>

      <!-- Notes tab -->
      <div class="sc-content-panel ${activeTabName === 'notes' ? 'active' : ''}" id="sc-panel-notes">
        <div class="sc-notes-input-group">
          <textarea class="sc-textarea" id="sc-note-input" placeholder="Type a timestamped note... (Auto-pauses video)"></textarea>
          <div class="sc-btn-row">
            <button class="sc-btn sc-btn-primary" id="sc-btn-add-note">Add Note</button>
            <button class="sc-btn sc-btn-secondary" id="sc-btn-ss">📸 Screenshot</button>
            <div class="sc-options-row">
              <input type="checkbox" id="sc-chk-autopause" ${autoPauseOnType ? 'checked' : ''}>
              <label for="sc-chk-autopause">Auto-Pause</label>
            </div>
          </div>
        </div>
        <div id="sc-screenshots-row" class="sc-screenshots-container"></div>
        <input type="text" class="sc-search-bar" id="sc-notes-search" placeholder="Search notes..." value="${notesSearchQuery}">
        <div id="sc-notes-list" style="margin-top: 12px;"></div>
      </div>

      <!-- Transcript tab -->
      <div class="sc-content-panel ${activeTabName === 'transcript' ? 'active' : ''}" id="sc-panel-transcript">
        <div class="sc-tools-panel">
          <div class="sc-transcript-header">
            <input type="text" class="sc-search-bar" style="margin-bottom:0; flex:1; margin-right:10px;" id="sc-transcript-search" placeholder="Search transcript..." value="${transcriptSearchQuery}">
            <button class="sc-btn sc-btn-secondary" style="font-size: 11px; padding: 6px 10px;" id="sc-btn-sync-transcript">🔄 Sync</button>
            <button class="sc-btn sc-btn-secondary" style="font-size: 11px; padding: 6px 10px; margin-left: 4px;" id="sc-btn-copy-transcript">Copy</button>
          </div>
          <div class="sc-transcript-list" id="sc-transcript-box">
            <div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">Loading transcript...</div>
          </div>
        </div>
      </div>

      <!-- Export tab -->
      <div class="sc-content-panel ${activeTabName === 'export' ? 'active' : ''}" id="sc-panel-export">
        <div class="sc-tools-panel">
          <button class="sc-btn sc-btn-primary" style="width: 100%; justify-content: center;" id="sc-btn-copy-all">Copy Notes & Info Markdown</button>
          <button class="sc-btn sc-btn-secondary" style="width: 100%; justify-content: center;" id="sc-btn-dl-md">Download Markdown File</button>
          
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
    container.querySelectorAll('.sc-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const selectedTab = e.target.dataset.tab;
        activeTabName = selectedTab;
        container.querySelectorAll('.sc-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.sc-content-panel').forEach(p => p.classList.remove('active'));
        
        e.target.classList.add('active');
        container.querySelector(`#sc-panel-${selectedTab}`).classList.add('active');

        if (selectedTab === 'export') {
          updateExportPreview();
        }
      });
    });

    // Auto-Pause & Inputs
    const noteInput = container.querySelector('#sc-note-input');
    const autoPauseChk = container.querySelector('#sc-chk-autopause');
    const notesSearch = container.querySelector('#sc-notes-search');
    const transcriptSearch = container.querySelector('#sc-transcript-search');

    autoPauseChk.addEventListener('change', (e) => {
      autoPauseOnType = e.target.checked;
    });

    noteInput.addEventListener('focus', () => {
      if (autoPauseOnType) {
        const video = document.querySelector('video');
        if (video && !video.paused) {
          video.pause();
        }
      }
    });

    notesSearch.addEventListener('input', (e) => {
      notesSearchQuery = e.target.value;
      renderNotesList();
    });

    transcriptSearch.addEventListener('input', (e) => {
      transcriptSearchQuery = e.target.value;
      renderTranscript();
    });

    // Add Note
    container.querySelector('#sc-btn-add-note').addEventListener('click', () => {
      const text = noteInput.value.trim();
      const video = document.querySelector('video');
      const time = video ? video.currentTime : 0.0;
      
      saveNote(currentVideoId, time, text || "[Marker Only]");
      noteInput.value = '';
      
      if (autoPauseOnType && video) {
        video.play().catch(() => {});
      }
    });

    container.querySelector('#sc-btn-ss').addEventListener('click', () => {
      capturePlayerScreenshot();
    });

    // Sync button
    container.querySelector('#sc-btn-sync-transcript').addEventListener('click', () => {
      scrapeNativeYouTubeTranscript(true);
    });

    renderNotesList();
    renderTranscript();
    updateExportPreview();

    // Export operations
    container.querySelector('#sc-btn-copy-all').addEventListener('click', () => copyCompleteMarkdown());
    container.querySelector('#sc-btn-dl-md').addEventListener('click', () => downloadMarkdownFile());
    container.querySelectorAll('.sc-llm-routing button').forEach(btn => {
      btn.addEventListener('click', (e) => sendToLLM(e.target.dataset.llm));
    });
  }

  async function updateExportPreview() {
    const preview = document.getElementById('sc-export-preview');
    if (preview) {
      preview.textContent = await generateMarkdown();
    }
  }

  // Screenshot capture & direct download
  function capturePlayerScreenshot() {
    const video = document.querySelector('video');
    if (!video) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');

      // Add to preview container
      screenshotList.unshift(dataUrl);
      if (screenshotList.length > 5) screenshotList.pop();
      renderScreenshotsList();

      // Download directly to Downloads folder
      const a = document.createElement('a');
      a.href = dataUrl;
      const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.innerText || "youtube";
      const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const time = video ? Math.floor(video.currentTime) : 0;
      a.download = `screenshot_${cleanTitle}_${time}s.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error("Failed to capture frame screenshot", e);
    }
  }

  function renderScreenshotsList() {
    const container = document.getElementById('sc-screenshots-row');
    if (!container) return;
    container.innerHTML = '';

    screenshotList.forEach((src) => {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'sc-screenshot-thumbnail';
      img.title = "Click to copy image";
      img.addEventListener('click', async () => {
        try {
          const res = await fetch(src);
          const blob = await res.blob();
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
          ]);
          alert("Screenshot copied to clipboard!");
        } catch (e) {
          console.error("Failed to copy image blob", e);
        }
      });
      container.appendChild(img);
    });
  }

  function seekTo(seconds) {
    const video = document.querySelector('video');
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
      const note = notes.find(n => n.id === noteId);
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
      notes = notes.filter(n => n.id !== noteId);
      storage.set({ [key]: notes }, () => {
        renderNotesList();
        injectTimelineMarkers();
      });
    });
  }

  function renderNotesList() {
    const listContainer = document.getElementById('sc-notes-list');
    if (!listContainer) return;

    const key = `sc_notes_${currentVideoId}`;
    storage.get([key], (data) => {
      const notes = data[key] || [];
      
      const filtered = notes.filter(n => 
        n.text.toLowerCase().includes(notesSearchQuery.toLowerCase())
      );

      if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; font-size: 13px; padding: 12px 0;">No matching notes found.</div>`;
        return;
      }

      listContainer.innerHTML = filtered.map(n => `
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
      `).join('');

      listContainer.querySelectorAll('.sc-note-timestamp').forEach(el => {
        el.addEventListener('click', (e) => {
          seekTo(parseFloat(e.target.dataset.time));
        });
      });

      listContainer.querySelectorAll('.sc-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          deleteNote(e.target.dataset.delId);
        });
      });

      listContainer.querySelectorAll('.sc-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
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

    const originalText = textDiv.innerText === "[Marker Only]" ? "" : textDiv.innerText;
    textDiv.innerHTML = `
      <textarea class="sc-textarea" id="sc-edit-textarea-${noteId}" style="min-height: 50px;">${escapeHtml(originalText)}</textarea>
    `;

    const actionsDiv = noteCard.querySelector('.sc-note-actions');
    actionsDiv.innerHTML = `
      <button class="sc-note-action-btn" id="sc-save-edit-${noteId}">Save</button>
      <button class="sc-note-action-btn" id="sc-cancel-edit-${noteId}">Cancel</button>
    `;

    document.getElementById(`sc-save-edit-${noteId}`).addEventListener('click', () => {
      const newText = document.getElementById(`sc-edit-textarea-${noteId}`).value.trim();
      updateNote(noteId, newText);
    });

    document.getElementById(`sc-cancel-edit-${noteId}`).addEventListener('click', () => {
      renderNotesList();
    });
  }

  // Inject timeline markers
  function injectTimelineMarkers() {
    const progressBar = document.querySelector('.ytp-progress-bar');
    if (!progressBar) return;

    document.querySelectorAll('.sc-timeline-marker').forEach(m => m.remove());

    const key = `sc_notes_${currentVideoId}`;
    storage.get([key], (data) => {
      const notes = data[key] || [];
      const video = document.querySelector('video');
      const duration = video ? video.duration : 0;

      if (!duration || notes.length === 0) return;

      notes.forEach(n => {
        const pct = n.time / duration;
        const marker = document.createElement('div');
        marker.className = 'sc-timeline-marker';
        marker.style.left = `${pct * 100}%`;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'sc-marker-tooltip';
        tooltip.textContent = `[${formatTime(n.time)}] ${n.text}`;
        marker.appendChild(tooltip);

        marker.addEventListener('click', (e) => {
          e.stopPropagation();
          seekTo(n.time);
        });

        progressBar.appendChild(marker);
      });
    });
  }

  // Fetch transcript: script parsing + DOM clicker fallback
  function fetchYouTubeTranscript() {
    ytCaptions = [];
    
    // First attempt: Scrape ytInitialPlayerResponse directly from script tags
    const playerResponse = getPlayerResponseFromScripts();
    if (playerResponse && playerResponse.captions && playerResponse.captions.playerCaptionsTracklistRenderer && playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks) {
      const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      loadTranscriptFromTracks(tracks);
    } else {
      // Fallback: Scrape native transcript DOM
      scrapeNativeYouTubeTranscript();
    }
  }

  function getPlayerResponseFromScripts() {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes('ytInitialPlayerResponse =')) {
        const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {
            console.error("Failed to parse script tag JSON", e);
          }
        }
      }
    }
    return null;
  }

  async function loadTranscriptFromTracks(tracks) {
    const englishTrack = tracks.find(t => t.languageCode === 'en') || tracks[0];
    try {
      const res = await fetch(englishTrack.baseUrl);
      const text = await res.text();
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      const textNodes = xmlDoc.getElementsByTagName('text');
      
      ytCaptions = Array.from(textNodes).map(node => ({
        start: parseFloat(node.getAttribute('start')),
        duration: parseFloat(node.getAttribute('dur')) || 0.0,
        text: decodeHtmlEntities(node.textContent)
      }));

      renderTranscript();
    } catch (e) {
      scrapeNativeYouTubeTranscript();
    }
  }

  // Periodic automatic sync helper
  function autoSyncNativeTranscript() {
    if (ytCaptions.length > 0) return;
    const isPanelOpen = document.querySelector('transcript-segment-view-model') || document.querySelector('ytd-transcript-segment-renderer');
    if (isPanelOpen) {
      scrapeNativeYouTubeTranscript(false);
    }
  }

  // Dynamic deep transcript DOM scraper
  function scrapeNativeYouTubeTranscript(forceClick = false) {
    const transcriptBox = document.getElementById('sc-transcript-box');
    
    // Find all timestamped elements dynamically to ensure 99.999% selector-free robustness
    const segmentEls = Array.from(document.querySelectorAll('transcript-segment-view-model, ytd-transcript-segment-renderer, .ytwTranscriptSegmentViewModelHost, [class*="TranscriptSegment"]'));
    
    if (segmentEls.length > 0) {
      ytCaptions = segmentEls.map(seg => {
        let timeStr = '0:00';
        let text = '';

        const timeEl = seg.querySelector('.ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp, [class*="timestamp"], [class*="Timestamp"]');
        const textEl = seg.querySelector('.ytAttributedStringHost, .segment-text, span[role="text"], [class*="text"], [class*="Text"]');
        
        if (timeEl) timeStr = timeEl.innerText.trim();
        else {
          const match = seg.innerText.match(/\d{1,2}:\d{2}(:\d{2})?/);
          if (match) timeStr = match[0];
        }

        if (textEl) text = textEl.innerText.trim();
        else text = seg.innerText.replace(timeStr, '').replace(/\n/g, ' ').trim();

        const parts = timeStr.split(':').map(Number);
        let start = 0;
        if (parts.length === 3) start = parts[0]*3600 + parts[1]*60 + parts[2];
        else start = parts[0]*60 + parts[1];

        return { start, text };
      }).filter(c => c.text !== '');

      if (ytCaptions.length > 0) {
        renderTranscript();
        return;
      }
    }

    if (forceClick) {
      const showBtn = document.querySelector('ytd-video-description-transcript-section-renderer button') || 
                      Array.from(document.querySelectorAll('button')).find(el => el.innerText.includes('Show transcript'));
      if (showBtn) {
        showBtn.click();
      }
    }
  }

  function renderTranscript() {
    const transcriptBox = document.getElementById('sc-transcript-box');
    if (!transcriptBox) return;

    if (ytCaptions.length === 0) {
      transcriptBox.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">No transcript loaded.</div>`;
      updateExportPreview();
      return;
    }

    const filtered = ytCaptions.filter(c => 
      c.text.toLowerCase().includes(transcriptSearchQuery.toLowerCase())
    );

    if (filtered.length === 0) {
      transcriptBox.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">No matching transcript lines.</div>`;
      updateExportPreview();
      return;
    }

    transcriptBox.innerHTML = filtered.map(c => `
      <div class="sc-transcript-line">
        <span class="sc-transcript-time" data-time="${c.start}">${formatTime(c.start)}</span>
        <span>${escapeHtml(c.text)}</span>
      </div>
    `).join('');

    transcriptBox.querySelectorAll('.sc-transcript-time').forEach(el => {
      el.addEventListener('click', (e) => {
        seekTo(parseFloat(e.target.dataset.time));
      });
    });

    const copyBtn = document.getElementById('sc-btn-copy-transcript');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const raw = ytCaptions.map(c => `[${formatTime(c.start)}] ${c.text}`).join('\n');
        navigator.clipboard.writeText(raw);
        alert("Transcript copied to clipboard!");
      };
    }
    updateExportPreview();
  }

  // Extract page metadata
  function extractYouTubeMetadata() {
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.innerText || document.title;
    const channel = document.querySelector('ytd-video-owner-renderer #channel-name a')?.innerText || 'Unknown';
    const subCount = document.querySelector('ytd-video-owner-renderer #owner-sub-count')?.innerText || 'Unknown';
    const views = document.querySelector('#info-container #info span, ytd-watch-info-text #info span')?.innerText || 'Unknown views';
    
    const descEl = document.querySelector('ytd-text-inline-expander span, #description-inline-expander span');
    const description = descEl ? descEl.innerText : '';

    const commentsCount = document.querySelector('ytd-comments #title')?.innerText || 'Unknown comments';

    const tagsList = [];
    document.querySelectorAll('a[href*="/hashtag/"]').forEach(el => {
      tagsList.push(el.innerText.trim());
    });
    const tags = tagsList.join(', ') || 'None';

    const comments = [];
    document.querySelectorAll('ytd-comment-thread-renderer').forEach((el, idx) => {
      if (idx < 5) {
        const author = el.querySelector('#author-text span')?.innerText.trim() || 'Anonymous';
        const text = el.querySelector('#content-text')?.innerText.trim() || '';
        const likes = el.querySelector('#vote-count-middle')?.innerText.trim() || '0';
        const pfp = el.querySelector('#author-thumbnail img')?.src || '';
        comments.push({ author, text, likes, pfp });
      }
    });

    const recVids = [];
    document.querySelectorAll('ytd-compact-video-renderer').forEach((el, idx) => {
      if (idx < 5) {
        const titleEl = el.querySelector('#video-title');
        const channelEl = el.querySelector('#byline-container #text, ytd-channel-name yt-formatted-string');
        const metaEl = el.querySelector('#metadata-line span');
        const linkEl = el.querySelector('a#thumbnail');
        const imgEl = el.querySelector('img');
        if (titleEl && linkEl) {
          recVids.push({
            title: titleEl.innerText.trim(),
            channel: channelEl ? channelEl.innerText.trim() : '',
            views: metaEl ? metaEl.innerText.trim() : '',
            url: linkEl.href,
            thumbnail: imgEl ? imgEl.src : ''
          });
        }
      }
    });

    // Playlist / Queue Detection
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('list');
    let playlistTitle = '';
    let playlistUrl = '';
    let playlistIndex = '';

    if (playlistId) {
      playlistTitle = document.querySelector('ytd-playlist-panel-renderer #title-container #title')?.innerText || 'Playlist/Queue';
      playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      playlistIndex = urlParams.get('index') || '1';
    }

    return {
      title,
      channel,
      subCount,
      views,
      commentsCount,
      tags,
      comments,
      description,
      url: window.location.href,
      thumbnail: `https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`,
      recommendations: recVids,
      playlistId,
      playlistTitle,
      playlistUrl,
      playlistIndex
    };
  }

  async function generateMarkdown() {
    const meta = extractYouTubeMetadata();
    const notesKey = `sc_notes_${currentVideoId}`;
    const notesData = await chrome.storage.local.get([notesKey]);
    const notes = notesData[notesKey] || [];

    // Personal notes are placed as the primary heading context at the top
    let md = `# Personal Notes & Markers\n\n`;
    if (notes.length === 0) {
      md += `*No notes added yet.*\n\n`;
    } else {
      notes.forEach(n => {
        md += `- **[${formatTime(n.time)}]**: ${n.text}\n`;
      });
      md += `\n`;
    }

    md += `---\n`;
    md += `Title: ${meta.title}\n`;
    md += `description: ${meta.description.substring(0, 150).replace(/\n/g, ' ')}...\n`;
    md += `Channel: ${meta.channel}\n`;
    md += `Subscribers: ${meta.subCount}\n`;
    md += `Views: ${meta.views}\n`;
    md += `Comments: ${meta.commentsCount}\n`;
    md += `tags: ${meta.tags}\n`;
    md += `URL: ${meta.url}\n`;
    md += `thumbnail url: ${meta.thumbnail}\n`;
    if (meta.playlistId) {
      md += `Playlist: ${meta.playlistTitle}\n`;
      md += `Playlist URL: ${meta.playlistUrl}\n`;
      md += `Playlist Index: ${meta.playlistIndex}\n`;
    }
    md += `---\n\n`;

    md += `# Transcript\n\n`;
    if (ytCaptions.length === 0) {
      md += `*Transcript not loaded.*\n\n`;
    } else {
      ytCaptions.forEach(c => {
        md += `[${formatTime(c.start)}] ${c.text}\n`;
      });
      md += `\n`;
    }

    md += `# comments\n\n`;
    if (meta.comments.length === 0) {
      md += `*No comments visible on screen (scroll down to load comments).*\n\n`;
    } else {
      meta.comments.forEach((c, idx) => {
        md += `${idx + 1}. **${c.author}** (Likes: ${c.likes}): ${c.text}\n`;
      });
      md += `\n`;
    }

    md += `# recommodations topic & recommodation vids\n\n`;
    if (meta.recommendations.length > 0) {
      meta.recommendations.forEach(r => {
        md += `- **${r.title}** by ${r.channel} (${r.views}) - ${r.url}\n  Thumbnail: ${r.thumbnail}\n`;
      });
    }

    return md;
  }

  async function copyCompleteMarkdown() {
    const md = await generateMarkdown();
    navigator.clipboard.writeText(md);
    alert("Note, info, and transcript copied as Markdown!");
  }

  async function downloadMarkdownFile() {
    const md = await generateMarkdown();
    const meta = extractYouTubeMetadata();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function sendToLLM(target) {
    const md = await generateMarkdown();
    const promptText = encodeURIComponent(`Please review the transcript, notes, and metadata of this video and summarize the main takeaways:\n\n${md}`);
    
    let url = '';
    switch (target) {
      case 'chatgpt':
        url = `https://chatgpt.com/?q=${promptText}`;
        break;
      case 'claude':
        url = `https://claude.ai/new`;
        break;
      case 'gemini':
        url = `https://gemini.google.com/app`;
        break;
      case 'aistudio':
        url = `https://aistudio.google.com/`;
        break;
    }

    if (url) {
      window.open(url, '_blank');
    }
  }

  // --- X (Twitter) & Reddit Content Panels ---
  function initSocialCompanion(platform) {
    const fab = document.createElement('div');
    fab.className = 'sc-floating-action-button';
    fab.innerHTML = '🚀';
    fab.title = `Open Social Companion for ${platform === 'x' ? 'X (Twitter)' : 'Reddit'}`;
    document.body.appendChild(fab);

    let panel = null;
    fab.addEventListener('click', () => {
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
    const panel = document.createElement('div');
    panel.className = 'sc-floating-panel sc-adaptive-theme';

    panel.innerHTML = `
      <div class="sc-header">
        <div class="sc-header-title">
          <span>🔮 Social Companion (${platform === 'x' ? 'X' : 'Reddit'})</span>
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
          </div>
        </div>
        
        <div style="margin-top: 12px; border-top: 1px solid var(--sc-border-light); padding-top: 12px;">
          <strong style="font-size: 13px;">Extracted Content Preview:</strong>
          <pre id="sc-social-preview" style="font-size: 11px; white-space: pre-wrap; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 6px; margin-top: 6px; max-height: 180px; overflow-y: auto;"></pre>
        </div>
      </div>
    `;

    panel.querySelector('.sc-close-btn').addEventListener('click', () => {
      panel.remove();
    });

    const previewBox = panel.querySelector('#sc-social-preview');

    const scraped = platform === 'x' ? scrapeXThread() : scrapeRedditPost();
    const md = formatSocialMarkdown(scraped, platform);
    previewBox.textContent = md;

    panel.querySelector('#sc-social-btn-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(md);
      alert("Social data copied to clipboard as Markdown!");
    });

    panel.querySelector('#sc-social-btn-dl').addEventListener('click', () => {
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${platform}_scraped_post.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    panel.querySelectorAll('.sc-llm-routing button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target.dataset.llm;
        const promptText = encodeURIComponent(`Summarize or answer questions based on this post/thread content:\n\n${md}`);
        let targetUrl = '';
        if (target === 'chatgpt') targetUrl = `https://chatgpt.com/?q=${promptText}`;
        else if (target === 'claude') targetUrl = `https://claude.ai/new`;
        else if (target === 'gemini') targetUrl = `https://gemini.google.com/app`;
        window.open(targetUrl, '_blank');
      });
    });

    return panel;
  }

  function scrapeXThread() {
    const author = document.querySelector('[data-testid="User-Name"] span')?.innerText || 'Unknown';
    const postText = document.querySelector('[data-testid="tweetText"]')?.innerText || '';
    const stats = Array.from(document.querySelectorAll('[data-testid="reply"], [data-testid="retweet"], [data-testid="like"]')).map(el => el.innerText);

    return {
      author,
      text: postText,
      stats: stats.join(' | ') || 'No stats found',
      url: window.location.href
    };
  }

  function scrapeRedditPost() {
    const title = document.querySelector('shreddit-title')?.getAttribute('title') || document.title;
    const author = document.querySelector('a[href*="/user/"]')?.innerText || 'Unknown';
    const text = document.querySelector('div[id*="-post-rtjson-content"]')?.innerText || '';
    
    return {
      title,
      author,
      text,
      url: window.location.href
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
