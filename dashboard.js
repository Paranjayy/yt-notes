// Social Companion — Dashboard Logic
// Reads all sc_notes_* and sc_screenshots_* keys from storage, renders video cards

'use strict';

// ─── Storage helper ───────────────────────────────────────────────────────────
const storage = {
  getAll: () => new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, resolve);
    } else {
      // localStorage fallback
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        try { out[k] = JSON.parse(localStorage.getItem(k)); } catch { out[k] = localStorage.getItem(k); }
      }
      resolve(out);
    }
  }),
  get: (keys) => new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, resolve);
    } else {
      const out = {};
      keys.forEach(k => {
        try { out[k] = JSON.parse(localStorage.getItem(k)); } catch { out[k] = localStorage.getItem(k); }
      });
      resolve(out);
    }
  }),
  set: (items) => new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(items, resolve);
    } else {
      Object.entries(items).forEach(([k, v]) => {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
      });
      resolve();
    }
  }),
  remove: (keys) => new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(keys, resolve);
    } else {
      keys.forEach(k => localStorage.removeItem(k));
      resolve();
    }
  })
};

// ─── State ────────────────────────────────────────────────────────────────────
let allVideos = []; // Array of { videoId, notes, screenshots, transcript, meta }
let filteredVideos = [];
let currentSort = 'recent';
let searchQuery = '';

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatTime(secs) {
  if (!secs && secs !== 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, duration = 2800) {
  const t = document.getElementById('sc-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => copyFallback(text));
  } else {
    copyFallback(text);
  }
}

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

function downloadFile(content, filename, type = 'text/markdown') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ytUrl(videoId, t = null) {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return t !== null ? `${base}&t=${Math.floor(t)}s` : base;
}

function thumbUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

// ─── Generate Markdown for a single video ────────────────────────────────────
function generateMarkdownForVideo({ videoId, notes, screenshots, transcript, meta }) {
  const m = meta || {};
  let md = `# Personal Notes & Markers\n\n`;
  if (!notes || notes.length === 0) {
    md += `*No notes added yet.*\n\n`;
  } else {
    notes.forEach(n => {
      md += `- **[${formatTime(n.time)}]** (${ytUrl(videoId, n.time)}): ${n.text}\n`;
    });
    md += '\n';
  }

  md += `---\n`;
  md += `Title: ${m.title || 'Unknown'}\n`;
  if (m.description) md += `Description: ${m.description.substring(0, 200).replace(/\n/g, ' ')}...\n`;
  md += `Channel: ${m.channel || 'Unknown'}\n`;
  if (m.subCount) md += `Subscribers: ${m.subCount}\n`;
  if (m.views) md += `Views: ${m.views}\n`;
  if (m.commentsCount) md += `Comments: ${m.commentsCount}\n`;
  if (m.tags) md += `Tags: ${m.tags}\n`;
  md += `URL: ${ytUrl(videoId)}\n`;
  md += `Thumbnail: https://img.youtube.com/vi/${videoId}/maxresdefault.jpg\n`;
  if (m.playlistId) {
    md += `Playlist: ${m.playlistTitle || 'Queue'}\n`;
    md += `Playlist URL: ${m.playlistUrl}\n`;
    md += `Playlist Index: ${m.playlistIndex}\n`;
  }
  md += `---\n\n`;

  if (transcript && transcript.length > 0) {
    md += `# Transcript\n\n`;
    transcript.forEach(c => {
      md += `[${formatTime(c.start)}] ${c.text}\n`;
    });
    md += '\n';
  }

  if (screenshots && screenshots.length > 0) {
    md += `# Screenshots\n\n`;
    screenshots.forEach((ss, i) => {
      const ssData = typeof ss === 'object' ? ss : { dataUrl: ss };
      const frameUrl = ssData.timestampUrl || ytUrl(videoId, ssData.timestamp);
      md += `${i + 1}. Frame at [${formatTime(ssData.timestamp || 0)}](${frameUrl})\n`;
    });
    md += '\n';
  }

  if (m.recommendations && m.recommendations.length > 0) {
    md += `# Recommendations\n\n`;
    m.recommendations.forEach(r => {
      md += `- **${r.title}** by ${r.channel} (${r.views}) — ${r.url}\n`;
    });
    md += '\n';
  }

  return md;
}

// ─── Load data from storage ───────────────────────────────────────────────────
async function loadAllData() {
  const data = await storage.getAll();
  const videoMap = {};

  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith('sc_notes_')) {
      const videoId = key.replace('sc_notes_', '');
      if (!videoMap[videoId]) videoMap[videoId] = { videoId, notes: [], screenshots: [], transcript: [], meta: null };
      videoMap[videoId].notes = value || [];
    } else if (key.startsWith('sc_screenshots_')) {
      const videoId = key.replace('sc_screenshots_', '');
      if (!videoMap[videoId]) videoMap[videoId] = { videoId, notes: [], screenshots: [], transcript: [], meta: null };
      videoMap[videoId].screenshots = value || [];
    } else if (key.startsWith('sc_transcript_')) {
      const videoId = key.replace('sc_transcript_', '');
      if (!videoMap[videoId]) videoMap[videoId] = { videoId, notes: [], screenshots: [], transcript: [], meta: null };
      videoMap[videoId].transcript = value || [];
    } else if (key.startsWith('sc_meta_')) {
      const videoId = key.replace('sc_meta_', '');
      if (!videoMap[videoId]) videoMap[videoId] = { videoId, notes: [], screenshots: [], transcript: [], meta: null };
      videoMap[videoId].meta = value;
    }
  });

  // Only include videos that have some content
  allVideos = Object.values(videoMap).filter(v =>
    v.notes.length > 0 || v.screenshots.length > 0 || v.transcript.length > 0
  );

  return allVideos;
}

// ─── Render stats bar ─────────────────────────────────────────────────────────
function renderStats() {
  const totalNotes = allVideos.reduce((s, v) => s + v.notes.length, 0);
  const totalSS = allVideos.reduce((s, v) => s + v.screenshots.length, 0);
  const totalTranscripts = allVideos.filter(v => v.transcript.length > 0).length;

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-item">
      <div class="stat-value">${allVideos.length}</div>
      <div class="stat-label">Videos</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${totalNotes}</div>
      <div class="stat-label">Notes</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${totalSS}</div>
      <div class="stat-label">Screenshots</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${totalTranscripts}</div>
      <div class="stat-label">Transcripts</div>
    </div>
  `;
}

// ─── Sort & filter ────────────────────────────────────────────────────────────
function applyFilterSort() {
  let videos = [...allVideos];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    videos = videos.filter(v => {
      const titleMatch = (v.meta?.title || v.videoId).toLowerCase().includes(q);
      const notesMatch = v.notes.some(n => n.text.toLowerCase().includes(q));
      const transcriptMatch = v.transcript.some(c => c.text.toLowerCase().includes(q));
      return titleMatch || notesMatch || transcriptMatch;
    });
  }

  if (currentSort === 'notes') {
    videos.sort((a, b) => b.notes.length - a.notes.length);
  } else if (currentSort === 'alpha') {
    videos.sort((a, b) => {
      const ta = (a.meta?.title || a.videoId).toLowerCase();
      const tb = (b.meta?.title || b.videoId).toLowerCase();
      return ta.localeCompare(tb);
    });
  } else {
    // 'recent' — by latest note timestamp or index
    videos.sort((a, b) => {
      const aTime = a.notes.length > 0 ? Math.max(...a.notes.map(n => n.id || 0)) : 0;
      const bTime = b.notes.length > 0 ? Math.max(...b.notes.map(n => n.id || 0)) : 0;
      return bTime - aTime;
    });
  }

  filteredVideos = videos;
  return videos;
}

// ─── Render grid ──────────────────────────────────────────────────────────────
function renderGrid() {
  const videos = applyFilterSort();
  const grid = document.getElementById('videos-grid');
  const label = document.getElementById('section-label');

  label.textContent = searchQuery
    ? `${videos.length} result${videos.length !== 1 ? 's' : ''} for "${searchQuery}"`
    : `${videos.length} video${videos.length !== 1 ? 's' : ''} with content`;

  if (videos.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-icon">🎬</div>
        <div class="empty-title">${searchQuery ? 'No matches found' : 'No videos yet'}</div>
        <div class="empty-desc">
          ${searchQuery
            ? 'Try a different search term.'
            : 'Open YouTube, take some notes or screenshots with Social Companion, and they\'ll appear here.'}
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = videos.map(v => {
    const title = v.meta?.title || `Video ${v.videoId}`;
    const channel = v.meta?.channel || '';
    const thumb = thumbUrl(v.videoId);

    const badges = [];
    if (v.notes.length > 0) badges.push(`<span class="badge badge-notes">📝 ${v.notes.length}</span>`);
    if (v.screenshots.length > 0) badges.push(`<span class="badge badge-ss">📸 ${v.screenshots.length}</span>`);
    if (v.transcript.length > 0) badges.push(`<span class="badge badge-transcript">📜 Transcript</span>`);

    const latestNote = v.notes.length > 0 ? v.notes[v.notes.length - 1] : null;

    return `
      <div class="video-card" data-id="${escapeHtml(v.videoId)}" id="card-${escapeHtml(v.videoId)}">
        <div class="card-thumb-wrap">
          <img class="card-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(title)}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="card-thumb-placeholder" style="display:none;">🎬</div>
          <div class="card-badges">${badges.join('')}</div>
        </div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(title)}</div>
          <div class="card-meta">
            ${channel ? `<span>📺 ${escapeHtml(channel)}</span>` : ''}
            ${latestNote ? `<span>🕐 Last note @ ${formatTime(latestNote.time)}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" data-action="view" data-id="${escapeHtml(v.videoId)}">View Details</button>
            <a class="btn btn-secondary btn-sm" href="${ytUrl(v.videoId)}" target="_blank" rel="noreferrer">▶ Open</a>
            <button class="btn btn-secondary btn-sm" data-action="export-md" data-id="${escapeHtml(v.videoId)}">⬇ MD</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind card events
  grid.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openModal(e.target.dataset.id);
    });
  });
  grid.querySelectorAll('[data-action="export-md"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      exportVideoMd(e.target.dataset.id);
    });
  });
  grid.querySelectorAll('.video-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

// ─── Export individual video as markdown ─────────────────────────────────────
function exportVideoMd(videoId) {
  const video = allVideos.find(v => v.videoId === videoId);
  if (!video) return;
  const md = generateMarkdownForVideo(video);
  const filename = `${(video.meta?.title || videoId).replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.md`;
  downloadFile(md, filename);
  showToast('✅ Markdown file downloaded!');
}

// ─── Export all data as JSON ──────────────────────────────────────────────────
async function exportAllData() {
  const data = await storage.getAll();
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data
  };
  downloadFile(JSON.stringify(exportData, null, 2), `sc_all_data_${Date.now()}.json`, 'application/json');
  showToast('✅ All data exported as JSON!');
}

// ─── Import JSON ──────────────────────────────────────────────────────────────
async function importData(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const items = parsed.data || parsed;
    await storage.set(items);
    showToast('✅ Data imported! Reloading...');
    setTimeout(() => location.reload(), 1000);
  } catch (e) {
    showToast('❌ Failed to import: invalid JSON file');
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(videoId) {
  const video = allVideos.find(v => v.videoId === videoId);
  if (!video) return;

  const title = video.meta?.title || `Video: ${videoId}`;
  const channel = video.meta?.channel || '';
  const views = video.meta?.views || '';
  const thumb = thumbUrl(videoId);

  document.getElementById('modal-thumb').src = thumb;
  document.getElementById('modal-thumb').onerror = function () { this.style.display = 'none'; };
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-meta').innerHTML = [
    channel ? `<span>📺 ${escapeHtml(channel)}</span>` : '',
    views ? `<span>👁 ${escapeHtml(views)}</span>` : '',
    video.notes.length > 0 ? `<span class="pill pill-purple">📝 ${video.notes.length} notes</span>` : '',
    video.screenshots.length > 0 ? `<span class="pill pill-teal">📸 ${video.screenshots.length} ss</span>` : '',
    video.transcript.length > 0 ? `<span class="pill pill-green">📜 transcript</span>` : '',
  ].filter(Boolean).join('');

  // Modal actions
  document.getElementById('modal-actions').innerHTML = `
    <a class="btn btn-primary btn-sm" href="${ytUrl(videoId)}" target="_blank" rel="noreferrer">▶ Open on YouTube</a>
    <button class="btn btn-secondary btn-sm" id="modal-copy-md">📋 Copy Markdown</button>
    <button class="btn btn-secondary btn-sm" id="modal-dl-md">⬇ Download MD</button>
    <button class="btn btn-danger btn-sm" id="modal-delete">🗑 Delete All Data</button>
  `;
  document.getElementById('modal-copy-md').addEventListener('click', () => {
    copyText(generateMarkdownForVideo(video));
    showToast('📋 Markdown copied to clipboard!');
  });
  document.getElementById('modal-dl-md').addEventListener('click', () => exportVideoMd(videoId));
  document.getElementById('modal-delete').addEventListener('click', () => deleteVideoData(videoId));

  // Modal body
  const bodyEl = document.getElementById('modal-body');
  bodyEl.innerHTML = '';

  // Notes section
  if (video.notes.length > 0) {
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="section-heading">📝 Notes (${video.notes.length})</div>`;
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    video.notes.forEach(n => {
      const row = document.createElement('div');
      row.className = 'note-row';
      row.innerHTML = `
        <a class="note-time" href="${ytUrl(videoId, n.time)}" target="_blank" rel="noreferrer">${formatTime(n.time)}</a>
        <div class="note-text">${escapeHtml(n.text)}</div>
      `;
      list.appendChild(row);
    });
    sec.appendChild(list);
    bodyEl.appendChild(sec);
  }

  // Screenshots section
  if (video.screenshots.length > 0) {
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="section-heading">📸 Screenshots (${video.screenshots.length})</div>`;
    const grid = document.createElement('div');
    grid.className = 'ss-grid';

    video.screenshots.forEach((ss) => {
      const ssData = typeof ss === 'object' ? ss : { dataUrl: ss, timestamp: 0 };
      const frameUrl = ssData.timestampUrl || ytUrl(videoId, ssData.timestamp);
      const item = document.createElement('div');
      item.className = 'ss-item';
      item.innerHTML = `
        <img src="${ssData.dataUrl}" alt="screenshot" loading="lazy" />
        <div class="ss-meta">
          <span class="ss-time">${formatTime(ssData.timestamp || 0)}</span>
          <a class="ss-url-btn" href="${frameUrl}" target="_blank" rel="noreferrer" title="Open at this moment">⧉ Open</a>
        </div>
      `;
      // Click to copy image
      item.querySelector('img').addEventListener('click', async () => {
        try {
          const res = await fetch(ssData.dataUrl);
          const blob = await res.blob();
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
          showToast('📋 Screenshot copied to clipboard!');
        } catch {
          // Fallback: open in new tab
          const w = window.open();
          w.document.write(`<img src="${ssData.dataUrl}" style="max-width:100%">`);
          showToast('📸 Opened screenshot in new tab');
        }
      });
      grid.appendChild(item);
    });
    sec.appendChild(grid);
    bodyEl.appendChild(sec);
  }

  // Transcript section
  if (video.transcript.length > 0) {
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="section-heading">📜 Transcript (${video.transcript.length} lines)</div>`;
    const box = document.createElement('div');
    box.className = 'transcript-box';
    box.innerHTML = video.transcript.map(c =>
      `<div class="transcript-line"><span class="t-time">[${formatTime(c.start)}]</span>${escapeHtml(c.text)}</div>`
    ).join('');
    sec.appendChild(box);
    bodyEl.appendChild(sec);
  }

  // Recommendations
  if (video.meta?.recommendations?.length > 0) {
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="section-heading">💡 Recommendations (${video.meta.recommendations.length})</div>`;
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    video.meta.recommendations.forEach(r => {
      const row = document.createElement('div');
      row.className = 'note-row';
      row.innerHTML = `
        <a href="${escapeHtml(r.url)}" target="_blank" rel="noreferrer" class="note-text" style="color:var(--accent);text-decoration:none;font-weight:600;">${escapeHtml(r.title)}</a>
        <span class="note-time" style="cursor:default;">${escapeHtml(r.channel)} · ${escapeHtml(r.views)}</span>
      `;
      list.appendChild(row);
    });
    sec.appendChild(list);
    bodyEl.appendChild(sec);
  }

  // Markdown preview
  const mdSec = document.createElement('div');
  mdSec.innerHTML = `<div class="section-heading">📄 Markdown Preview</div>`;
  const mdPre = document.createElement('pre');
  mdPre.className = 'md-preview';
  mdPre.textContent = generateMarkdownForVideo(video);
  mdSec.appendChild(mdPre);
  bodyEl.appendChild(mdSec);

  // Open modal
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

async function deleteVideoData(videoId) {
  if (!confirm(`Delete all notes, screenshots, and transcript for this video? This can't be undone.`)) return;
  const keysToRemove = [
    `sc_notes_${videoId}`,
    `sc_screenshots_${videoId}`,
    `sc_transcript_${videoId}`,
    `sc_meta_${videoId}`
  ];
  await storage.remove(keysToRemove);
  allVideos = allVideos.filter(v => v.videoId !== videoId);
  closeModal();
  renderStats();
  renderGrid();
  showToast('🗑 Data deleted.');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  await loadAllData();
  renderStats();
  renderGrid();

  // Sort buttons
  document.querySelectorAll('.filter-btn[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-sort]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      renderGrid();
    });
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderGrid();
  });

  // Export all
  document.getElementById('btn-export-all').addEventListener('click', exportAllData);

  // Import
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = '';
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

init();
