// Social Companion & YT Note-Taker Content Script
// Handles YouTube, X (Twitter), and Reddit pages

(function () {
  'use strict';

  // Inject CSS styles into the page
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* Common Design System & Variables */
    :root {
      --sc-primary: #6366f1;
      --sc-primary-hover: #4f46e5;
      --sc-bg-light: #ffffff;
      --sc-bg-dark: #1f2937;
      --sc-text-light: #111827;
      --sc-text-dark: #f9fafb;
      --sc-text-muted-light: #6b7280;
      --sc-text-muted-dark: #9ca3af;
      --sc-border-light: #e5e7eb;
      --sc-border-dark: #374151;
      --sc-accent-red: #ef4444;
      --sc-accent-green: #10b981;
    }

    /* Embedded Companion Widget Container */
    #sc-youtube-widget {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin-bottom: 16px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--sc-border-light);
      background: var(--sc-bg-light);
      color: var(--sc-text-light);
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
      background: linear-gradient(135deg, var(--sc-primary), #8b5cf6);
      color: white;
      padding: 14px 18px;
      font-weight: 700;
      font-size: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      letter-spacing: 0.5px;
    }

    .sc-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sc-logo-icon {
      font-size: 18px;
    }

    .sc-tabs {
      display: flex;
      background: rgba(0,0,0,0.05);
      border-bottom: 1px solid var(--sc-border-light);
    }
    html[theme="dark"] .sc-tabs,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-tabs {
        background: rgba(255,255,255,0.03);
        border-color: var(--sc-border-dark);
      }
    }

    .sc-tab {
      flex: 1;
      padding: 10px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      color: var(--sc-text-muted-light);
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    html[theme="dark"] .sc-tab,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-tab {
        color: var(--sc-text-muted-dark);
      }
    }
    .sc-tab.active {
      color: var(--sc-primary);
      border-bottom-color: var(--sc-primary);
    }

    .sc-content-panel {
      display: none;
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    }
    .sc-content-panel.active {
      display: block;
    }

    /* Notes UI */
    .sc-notes-input-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }

    .sc-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--sc-border-light);
      background: transparent;
      color: inherit;
      resize: vertical;
      min-height: 60px;
      font-size: 13px;
    }
    html[theme="dark"] .sc-textarea,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-textarea {
        border-color: var(--sc-border-dark);
      }
    }

    .sc-btn-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .sc-btn {
      padding: 8px 12px;
      border-radius: 6px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s, transform 0.1s;
    }
    .sc-btn:active {
      transform: scale(0.97);
    }
    .sc-btn-primary {
      background: var(--sc-primary);
      color: white;
    }
    .sc-btn-primary:hover {
      background: var(--sc-primary-hover);
    }
    .sc-btn-secondary {
      background: rgba(0,0,0,0.06);
      color: inherit;
    }
    html[theme="dark"] .sc-btn-secondary,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-btn-secondary {
        background: rgba(255,255,255,0.08);
      }
    }
    .sc-btn-secondary:hover {
      background: rgba(0,0,0,0.1);
    }
    html[theme="dark"] .sc-btn-secondary:hover,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-btn-secondary:hover {
        background: rgba(255,255,255,0.12);
      }
    }

    .sc-note-item {
      display: flex;
      flex-direction: column;
      padding: 10px;
      border-radius: 8px;
      background: rgba(0,0,0,0.02);
      border: 1px solid var(--sc-border-light);
      margin-bottom: 8px;
      position: relative;
    }
    html[theme="dark"] .sc-note-item,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-note-item {
        background: rgba(255,255,255,0.02);
        border-color: var(--sc-border-dark);
      }
    }

    .sc-note-timestamp {
      font-size: 12px;
      font-weight: 700;
      color: var(--sc-primary);
      cursor: pointer;
      align-self: flex-start;
      margin-bottom: 4px;
    }
    .sc-note-timestamp:hover {
      text-decoration: underline;
    }

    .sc-note-text {
      font-size: 13px;
      word-break: break-word;
    }

    .sc-note-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 6px;
    }

    .sc-note-action-btn {
      font-size: 11px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--sc-text-muted-light);
    }
    html[theme="dark"] .sc-note-action-btn,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-note-action-btn {
        color: var(--sc-text-muted-dark);
      }
    }
    .sc-note-action-btn:hover {
      color: var(--sc-accent-red);
    }

    /* Timeline Markers */
    .sc-timeline-marker {
      position: absolute;
      width: 10px;
      height: 10px;
      background: #8b5cf6;
      border: 2px solid white;
      border-radius: 50%;
      top: 50%;
      transform: translateY(-50%) scale(1);
      cursor: pointer;
      z-index: 50;
      transition: transform 0.2s;
    }
    .sc-timeline-marker:hover {
      transform: translateY(-50%) scale(1.4);
      background: var(--sc-primary);
    }

    /* Tooltips for markers */
    .sc-marker-tooltip {
      position: absolute;
      bottom: 25px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.85);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 100;
      display: none;
      box-shadow: 0 4px 6px rgba(0,0,0,0.15);
    }
    .sc-timeline-marker:hover .sc-marker-tooltip {
      display: block;
    }

    /* Transcript UI & Tools */
    .sc-tools-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sc-transcript-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .sc-transcript-list {
      max-height: 250px;
      overflow-y: auto;
      border: 1px solid var(--sc-border-light);
      border-radius: 8px;
      padding: 8px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    html[theme="dark"] .sc-transcript-list,
    @media (prefers-color-scheme: dark) {
      .sc-adaptive-theme .sc-transcript-list {
        border-color: var(--sc-border-dark);
      }
    }

    .sc-transcript-line {
      display: flex;
      gap: 8px;
    }

    .sc-transcript-time {
      font-weight: 700;
      color: var(--sc-primary);
      cursor: pointer;
      min-width: 45px;
    }

    .sc-transcript-time:hover {
      text-decoration: underline;
    }

    /* Screenshots list */
    .sc-screenshots-container {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      margin-top: 8px;
      padding: 4px 0;
    }

    .sc-screenshot-thumbnail {
      width: 80px;
      height: 45px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid var(--sc-border-light);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .sc-screenshot-thumbnail:hover {
      transform: scale(1.05);
    }

    /* LLM Routing menu */
    .sc-llm-routing {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      margin-top: 10px;
    }

    /* Floating UI for X / Reddit */
    .sc-floating-action-button {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: linear-gradient(135deg, var(--sc-primary), #8b5cf6);
      color: white;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 9999;
      font-weight: 700;
      font-size: 20px;
      transition: transform 0.2s;
    }
    .sc-floating-action-button:hover {
      transform: scale(1.08) rotate(5deg);
    }

    .sc-floating-panel {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 360px;
      height: 500px;
      border-radius: 12px;
      border: 1px solid var(--sc-border-light);
      background: var(--sc-bg-light);
      color: var(--sc-text-light);
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: scSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    html[theme="dark"] .sc-floating-panel,
    body.theme-dark .sc-floating-panel,
    body.dark-mode .sc-floating-panel,
    @media (prefers-color-scheme: dark) {
      .sc-floating-panel.sc-adaptive-theme {
        background: var(--sc-bg-dark);
        color: var(--sc-text-dark);
        border-color: var(--sc-border-dark);
      }
    }

    @keyframes scSlideUp {
      from { transform: translateY(20px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(styleEl);

  // Global variables
  let currentVideoId = '';
  let activeTabName = 'notes';
  let ytCaptions = [];
  let screenshotList = [];

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
    // Watch URL transitions
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onYouTubeUrlChange();
      }
    }, 1000);

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
      // Remove widget if not on video page
      const existing = document.getElementById('sc-youtube-widget');
      if (existing) existing.remove();
    }
  }

  // Inject widget in secondary column above recommendation list
  function injectYouTubeWidget() {
    const target = document.querySelector('#secondary-inner') || document.querySelector('#secondary');
    if (!target) {
      // Retry in 1.5s if DOM not ready
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
          <span class="sc-logo-icon">🚀</span>
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
          <textarea class="sc-textarea" id="sc-note-input" placeholder="Type a timestamped note..."></textarea>
          <div class="sc-btn-row">
            <button class="sc-btn sc-btn-primary" id="sc-btn-add-note">Add Note</button>
            <button class="sc-btn sc-btn-secondary" id="sc-btn-ss">📸 Screenshot</button>
          </div>
        </div>
        <div id="sc-screenshots-row" class="sc-screenshots-container"></div>
        <div id="sc-notes-list" style="margin-top: 12px;"></div>
      </div>

      <!-- Transcript tab -->
      <div class="sc-content-panel ${activeTabName === 'transcript' ? 'active' : ''}" id="sc-panel-transcript">
        <div class="sc-tools-panel">
          <div class="sc-transcript-header">
            <strong>Video Transcript</strong>
            <button class="sc-btn sc-btn-secondary" style="font-size: 11px; padding: 4px 8px;" id="sc-btn-copy-transcript">Copy Raw</button>
          </div>
          <div class="sc-transcript-list" id="sc-transcript-box">
            <div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">Loading transcript...</div>
          </div>
        </div>
      </div>

      <!-- Export tab -->
      <div class="sc-content-panel ${activeTabName === 'export' ? 'active' : ''}" id="sc-panel-export">
        <div class="sc-tools-panel">
          <button class="sc-btn sc-btn-primary" style="width: 100%; justify-content: center;" id="sc-btn-copy-all">Copy Note & Info Markdown</button>
          <button class="sc-btn sc-btn-secondary" style="width: 100%; justify-content: center;" id="sc-btn-dl-md">Download Markdown File</button>
          
          <div style="margin-top: 12px;">
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
      });
    });

    // Note operations
    const addNoteBtn = container.querySelector('#sc-btn-add-note');
    const noteInput = container.querySelector('#sc-note-input');
    const ssBtn = container.querySelector('#sc-btn-ss');

    addNoteBtn.addEventListener('click', () => {
      const text = noteInput.value.trim();
      if (!text) return;
      const video = document.querySelector('video');
      const time = video ? Math.floor(video.currentTime) : 0;
      saveNote(currentVideoId, time, text);
      noteInput.value = '';
    });

    ssBtn.addEventListener('click', () => {
      capturePlayerScreenshot();
    });

    // Render initial notes list
    renderNotesList();

    // Setup Transcript operations
    renderTranscript();

    // Export operations
    container.querySelector('#sc-btn-copy-all').addEventListener('click', () => copyCompleteMarkdown());
    container.querySelector('#sc-btn-dl-md').addEventListener('click', () => downloadMarkdownFile());
    container.querySelectorAll('.sc-llm-routing button').forEach(btn => {
      btn.addEventListener('click', (e) => sendToLLM(e.target.dataset.llm));
    });
  }

  // Screenshot capture via HTML5 canvas
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

      // Add to session list
      screenshotList.unshift(dataUrl);
      if (screenshotList.length > 5) screenshotList.pop();

      // Refresh thumbnails
      renderScreenshotsList();
    } catch (e) {
      console.error("Failed to capture frame screenshot", e);
    }
  }

  function renderScreenshotsList() {
    const container = document.getElementById('sc-screenshots-row');
    if (!container) return;
    container.innerHTML = '';

    screenshotList.forEach((src, idx) => {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'sc-screenshot-thumbnail';
      img.title = "Click to copy image to clipboard";
      img.addEventListener('click', async () => {
        // Copy to clipboard
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

  // Seek video player time helper
  function seekTo(seconds) {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = seconds;
      video.play().catch(() => {});
    }
  }

  // Format seconds to H:MM:SS
  function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Storage and Notes Management
  function saveNote(videoId, time, text) {
    const key = `sc_notes_${videoId}`;
    chrome.storage.local.get([key], (data) => {
      const notes = data[key] || [];
      notes.push({ id: Date.now().toString(), time, text });
      notes.sort((a, b) => a.time - b.time);
      chrome.storage.local.set({ [key]: notes }, () => {
        renderNotesList();
        injectTimelineMarkers();
      });
    });
  }

  function deleteNote(noteId) {
    const key = `sc_notes_${currentVideoId}`;
    chrome.storage.local.get([key], (data) => {
      let notes = data[key] || [];
      notes = notes.filter(n => n.id !== noteId);
      chrome.storage.local.set({ [key]: notes }, () => {
        renderNotesList();
        injectTimelineMarkers();
      });
    });
  }

  function renderNotesList() {
    const listContainer = document.getElementById('sc-notes-list');
    if (!listContainer) return;

    const key = `sc_notes_${currentVideoId}`;
    chrome.storage.local.get([key], (data) => {
      const notes = data[key] || [];
      if (notes.length === 0) {
        listContainer.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; font-size: 13px; padding: 12px 0;">No notes added yet. Add your first note!</div>`;
        return;
      }

      listContainer.innerHTML = notes.map(n => `
        <div class="sc-note-item">
          <div class="sc-note-timestamp" data-time="${n.time}">${formatTime(n.time)}</div>
          <div class="sc-note-text">${escapeHtml(n.text)}</div>
          <div class="sc-note-actions">
            <button class="sc-note-action-btn" data-del-id="${n.id}">Delete</button>
          </div>
        </div>
      `).join('');

      // Add listeners
      listContainer.querySelectorAll('.sc-note-timestamp').forEach(el => {
        el.addEventListener('click', (e) => {
          seekTo(parseInt(e.target.dataset.time));
        });
      });

      listContainer.querySelectorAll('.sc-note-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          deleteNote(e.target.dataset.delId);
        });
      });
    });
  }

  // Inject markers directly on the YouTube timeline
  function injectTimelineMarkers() {
    const progressBar = document.querySelector('.ytp-progress-bar');
    if (!progressBar) return;

    // Remove old ones
    document.querySelectorAll('.sc-timeline-marker').forEach(m => m.remove());

    const key = `sc_notes_${currentVideoId}`;
    chrome.storage.local.get([key], (data) => {
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

  // Fetch YouTube Captions directly
  function fetchYouTubeTranscript() {
    ytCaptions = [];
    const scriptId = 'sc-yt-injected-script';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.textContent = `
        (function() {
          function getCaptions() {
            try {
              const resp = window.ytInitialPlayerResponse;
              if (resp && resp.captions && resp.captions.playerCaptionsTracklistRenderer && resp.captions.playerCaptionsTracklistRenderer.captionTracks) {
                const tracks = resp.captions.playerCaptionsTracklistRenderer.captionTracks;
                window.postMessage({ type: 'SC_YT_TRACKS', tracks }, '*');
              } else {
                window.postMessage({ type: 'SC_YT_TRACKS', tracks: [] }, '*');
              }
            } catch(e) {}
          }
          getCaptions();
          // Watch for navigation events
          document.addEventListener('yt-navigate-finish', getCaptions);
        })();
      `;
      document.documentElement.appendChild(script);
    }

    // Clean old listener
    window.removeEventListener('message', handleTranscriptMessage);
    window.addEventListener('message', handleTranscriptMessage);
  }

  async function handleTranscriptMessage(event) {
    if (event.source !== window || event.data?.type !== 'SC_YT_TRACKS') return;
    const tracks = event.data.tracks || [];
    const transcriptBox = document.getElementById('sc-transcript-box');

    if (tracks.length === 0) {
      if (transcriptBox) {
        transcriptBox.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">No auto-captions found for this video.</div>`;
      }
      return;
    }

    // Prefer English if available, otherwise take first
    const englishTrack = tracks.find(t => t.languageCode === 'en') || tracks[0];
    try {
      const res = await fetch(englishTrack.baseUrl);
      const text = await res.text();
      
      // Parse XML timedtext
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      const textNodes = xmlDoc.getElementsByTagName('text');
      
      ytCaptions = Array.from(textNodes).map(node => ({
        start: parseFloat(node.getAttribute('start')),
        duration: parseFloat(node.getAttribute('dur')),
        text: decodeHtmlEntities(node.textContent)
      }));

      renderTranscript();
    } catch (e) {
      console.error("Failed to parse caption tracks XML", e);
      if (transcriptBox) {
        transcriptBox.innerHTML = `<div style="color: var(--sc-accent-red); text-align: center; padding: 12px;">Error parsing captions.</div>`;
      }
    }
  }

  function renderTranscript() {
    const transcriptBox = document.getElementById('sc-transcript-box');
    if (!transcriptBox) return;

    if (ytCaptions.length === 0) {
      transcriptBox.innerHTML = `<div style="color: var(--sc-text-muted-light); text-align: center; padding: 12px;">No captions loaded.</div>`;
      return;
    }

    transcriptBox.innerHTML = ytCaptions.map(c => `
      <div class="sc-transcript-line">
        <span class="sc-transcript-time" data-time="${c.start}">${formatTime(c.start)}</span>
        <span>${escapeHtml(c.text)}</span>
      </div>
    `).join('');

    // Hook listeners
    transcriptBox.querySelectorAll('.sc-transcript-time').forEach(el => {
      el.addEventListener('click', (e) => {
        seekTo(parseFloat(e.target.dataset.time));
      });
    });

    const copyBtn = document.getElementById('sc-btn-copy-transcript');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const raw = ytCaptions.map(c => `[${formatTime(c.start)}] ${c.text}`).join('\n');
        navigator.clipboard.writeText(raw);
        alert("Transcript copied to clipboard!");
      });
    }
  }

  // Extract page metadata
  function extractYouTubeMetadata() {
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.innerText || document.title;
    const channel = document.querySelector('ytd-video-owner-renderer #channel-name a')?.innerText || 'Unknown';
    const subCount = document.querySelector('ytd-video-owner-renderer #owner-sub-count')?.innerText || 'Unknown';
    const views = document.querySelector('#info-container #info span, ytd-watch-info-text #info span')?.innerText || 'Unknown views';
    
    // Scrape description elements
    const descEl = document.querySelector('ytd-text-inline-expander span, #description-inline-expander span');
    const description = descEl ? descEl.innerText : '';

    // Comments count
    const commentsCount = document.querySelector('ytd-comments #title')?.innerText || 'Unknown comments';

    // Tags
    const tagsList = [];
    document.querySelectorAll('a[href*="/hashtag/"]').forEach(el => {
      tagsList.push(el.innerText.trim());
    });
    const tags = tagsList.join(', ') || 'None';

    // Comments scraping
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

    // Recommendations
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
      recommendations: recVids
    };
  }

  async function generateMarkdown() {
    const meta = extractYouTubeMetadata();
    const notesKey = `sc_notes_${currentVideoId}`;
    const notesData = await chrome.storage.local.get([notesKey]);
    const notes = notesData[notesKey] || [];

    let md = `---\n`;
    md += `Title: ${meta.title}\n`;
    md += `description: ${meta.description.substring(0, 150).replace(/\n/g, ' ')}...\n`;
    md += `Channel: ${meta.channel}\n`;
    md += `Subscribers: ${meta.subCount}\n`;
    md += `Views: ${meta.views}\n`;
    md += `Comments: ${meta.commentsCount}\n`;
    md += `tags: ${meta.tags}\n`;
    md += `URL: ${meta.url}\n`;
    md += `thumbnail url: ${meta.thumbnail}\n`;
    md += `---\n\n`;

    md += `# Notes & Markers\n\n`;
    if (notes.length === 0) {
      md += `*No notes added yet.*\n\n`;
    } else {
      notes.forEach(n => {
        md += `- **[${formatTime(n.time)}]**: ${n.text}\n`;
      });
      md += `\n`;
    }

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
    // Prepare prompt
    const promptText = encodeURIComponent(`Please review the transcript, notes, and metadata of this video and summarize the main takeaways:\n\n${md}`);
    
    let url = '';
    switch (target) {
      case 'chatgpt':
        url = `https://chatgpt.com/?q=${promptText}`;
        break;
      case 'claude':
        url = `https://claude.ai/new`; // Doesn't support direct query injection via URL easily, fallback to open
        break;
      case 'gemini':
        url = `https://gemini.google.com/app`; // Fallback
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
    // Inject floating helper trigger button
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
          <span>🚀 Social Companion (${platform === 'x' ? 'X' : 'Reddit'})</span>
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

    // Scrape data
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

  // --- Utility functions ---
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

})();
