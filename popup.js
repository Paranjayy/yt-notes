'use strict';

const statusEl = document.getElementById('status');
const titleEl = document.getElementById('pageTitle');
const metaEl = document.getElementById('pageMeta');
let activeTabId = null;
let replyPoller = null;
let lastProviderReply = '';
let lastProviderName = 'providers';

async function loadAutoCaptureSettings() {
  const stored = await chrome.storage.local.get(['sc_auto_capture_mode', 'sc_auto_capture_channels']);
  document.getElementById('autoCaptureMode').value = stored.sc_auto_capture_mode || 'off';
  document.getElementById('autoCaptureChannels').value = stored.sc_auto_capture_channels || '';
}

async function saveAutoCaptureSettings() {
  const mode = document.getElementById('autoCaptureMode').value;
  const channels = document.getElementById('autoCaptureChannels').value;
  await chrome.storage.local.set({ sc_auto_capture_mode: mode, sc_auto_capture_channels: channels });
  setStatus(mode === 'off' ? 'Auto-capture is off.' : `Auto-capture mode: ${mode}.`, 'success');
}

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function requestPage(type) {
  if (activeTabId == null) throw new Error('No active tab is available.');
  return chrome.tabs.sendMessage(activeTabId, { type });
}

async function refreshStatus() {
  try {
    const tab = await activeTab();
    activeTabId = tab?.id ?? null;
    const response = await requestPage('sc_get_capture_status');
    if (!response?.videoId) {
      titleEl.textContent = 'No active YouTube video';
      metaEl.textContent = 'Open a watch, live, or Shorts video to capture it.';
      document.getElementById('preferCapture').checked = false;
      document.getElementById('preferCapture').disabled = true;
    } else {
      titleEl.textContent = response.title || 'Current YouTube video';
      metaEl.textContent = response.transcriptAvailable ? 'Transcript is ready locally.' : 'Transcript not saved yet — Sync it in the page widget.';
      document.getElementById('preferCapture').disabled = false;
      document.getElementById('preferCapture').checked = true;
    }
  } catch {
    const tab = await activeTab().catch(() => null);
    activeTabId = tab?.id ?? null;
    titleEl.textContent = tab?.title || 'Active page';
    metaEl.textContent = 'Copy selected text or a short page context, then choose where to use it.';
    document.getElementById('preferCapture').checked = false;
    document.getElementById('preferCapture').disabled = true;
  }
  const last = await chrome.storage.local.get('sc_provider_last_status').catch(() => ({}));
  const receipt = last?.sc_provider_last_status;
  if (receipt?.error) setStatus(`${receipt.provider}: ${receipt.error}`, 'error');
  else if (receipt?.provider) setStatus(receipt.submitted ? `Last provider prompt was sent in ${receipt.provider}.` : `Last prompt was inserted in ${receipt.provider}.`, 'success');
}

function pageContextLimit() {
  return Number(document.getElementById('contextLimit')?.value || 12000);
}

async function copyActivePageContext(instruction = '') {
  try {
    const tab = await activeTab();
    if (tab?.id == null) throw new Error('No active tab is available.');
    const request = String(instruction || '').trim();
    const prefix = request ? `Request: ${request}\n\n` : '';
    if (document.getElementById('preferCapture').checked) {
      const capture = await chrome.tabs.sendMessage(tab.id, { type: 'sc_get_current_markdown' }).catch(() => null);
      if (capture?.ok && capture.markdown) {
        const max = pageContextLimit();
        const markdown = String(capture.markdown);
        const limited = markdown.length > max ? `${markdown.slice(0, max)}\n\n[Capture truncated at ${max.toLocaleString()} characters. Choose “Full saved capture” to include more.]` : markdown;
        const prompt = `${prefix}Structured local YouTube capture:\n\n${limited}`;
        await navigator.clipboard.writeText(prompt);
        setStatus(markdown.length > max ? 'Structured capture copied (truncated to selected size).' : 'Structured YouTube capture copied.', 'success');
        return prompt;
      }
    }
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (limit) => ({ title: document.title, url: location.href, selection: window.getSelection()?.toString().trim() || '', text: document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, limit) || '' }),
      args: [pageContextLimit()],
    });
    const page = result?.[0]?.result;
    if (!page) throw new Error('This page did not expose readable context.');
    const body = page.selection || page.text;
    if (!body) throw new Error('Select text or open a readable page first.');
    const prompt = `${prefix}Source: ${page.title}\nURL: ${page.url}\n\n${body}`;
    await navigator.clipboard.writeText(prompt);
    setStatus(request ? 'Chat prompt and context copied.' : page.selection ? 'Selected text copied.' : 'Page context copied.', 'success');
    return prompt;
  } catch (error) {
    setStatus(error?.message || 'Could not copy this page context.', 'error');
    return false;
  }
}

async function askProvider(instruction) {
  const prompt = await copyActivePageContext(instruction);
  if (!prompt) return;
  const providers = Array.from(document.querySelectorAll('[data-provider-target]:checked')).map((input) => input.dataset.providerTarget);
  if (!providers.length) return setStatus('Choose at least one AI target.', 'error');
  const autoSubmit = document.getElementById('sendAutomatically').checked;
  const startNewChat = document.getElementById('startNewChat').checked;
  setStatus(`Opening ${providers.join(', ')}…`);
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_prompt_batch', providers, prompt, autoSubmit, startNewChat });
  if (!response?.ok) setStatus(response?.reason || 'Could not open the selected AI targets.', 'error');
  else {
    const failed = Array.isArray(response.results) ? response.results.filter((result) => !result.ok) : [];
    const completed = response.sent || response.inserted || 0;
    const action = response.sent ? 'sent' : 'inserted';
    if (failed.length) {
      const names = failed.map((result) => result.provider).join(', ');
      setStatus(`${action[0].toUpperCase()}${action.slice(1)} for ${completed} target${completed === 1 ? '' : 's'}; ${names} needs attention.`, 'error');
    } else {
      setStatus(`${action[0].toUpperCase()}${action.slice(1)} for ${completed} AI target${completed === 1 ? '' : 's'}.`, 'success');
    }
    if (document.getElementById('autoReadReply').checked) setLiveReply(true);
  }
  renderProviderActivity();
}

async function rerunPrompt(record) {
  document.querySelectorAll('[data-provider-target]').forEach((input) => { input.checked = input.dataset.providerTarget === record.provider; });
  setStatus(`Reopening ${record.provider}…`);
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_prompt', provider: record.provider, prompt: record.prompt, autoSubmit: document.getElementById('sendAutomatically').checked, startNewChat: document.getElementById('startNewChat').checked });
  if (!response?.ok) setStatus(response?.reason || `Could not open ${record.provider}.`, 'error');
  else setStatus(response.submitted ? `Sent in ${record.provider}.` : `Prompt inserted in ${record.provider}; send it when ready.`, 'success');
  renderProviderActivity();
}

async function readProviderReply(silent = false) {
  if (!silent) setStatus('Reading the newest visible provider reply…');
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_read_reply' });
  if (!response?.ok) { if (!silent) setStatus(response?.reason || 'No provider reply is available yet.', 'error'); return; }
  if (response.text !== lastProviderReply) {
    lastProviderReply = response.text;
    lastProviderName = response.provider || '';
    document.getElementById('replyCard').hidden = false;
    document.getElementById('providerReply').textContent = response.text;
  }
  if (!silent) setStatus(`Read latest ${response.provider} reply.`, 'success');
}

async function readProviderReplies(silent = false) {
  if (!silent) setStatus('Reading visible provider replies…');
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_read_replies' });
  if (!response?.ok) { if (!silent) setStatus(response?.reason || 'No provider replies are available yet.', 'error'); return; }
  const combined = (response.replies || []).map((reply) => `## ${reply.provider}\n\n${reply.text}`).join('\n\n---\n\n');
  if (combined && combined !== lastProviderReply) {
    lastProviderReply = combined;
    lastProviderName = response.replies?.length === 1 ? response.replies[0].provider : 'providers';
    document.getElementById('replyCard').hidden = false;
    document.getElementById('providerReply').textContent = combined;
  }
  const waiting = Array.isArray(response.errors) ? response.errors.map((entry) => entry.provider) : [];
  if (!silent) setStatus(waiting.length ? `Read ${response.replies.length} ${response.replies.length === 1 ? 'reply' : 'replies'}; waiting on ${waiting.join(', ')}.` : `Read ${response.replies.length} provider ${response.replies.length === 1 ? 'reply' : 'replies'}.`, waiting.length ? 'error' : 'success');
}

function setLiveReply(enabled) {
  clearInterval(replyPoller);
  replyPoller = null;
  if (!enabled) return;
  chrome.storage.local.get('sc_provider_last_tab').then((stored) => {
    if (!stored.sc_provider_last_tab || !document.getElementById('autoReadReply').checked) return;
    readProviderReplies(true);
    replyPoller = setInterval(() => readProviderReplies(true), 1800);
  });
}

async function renderPromptHistory() {
  const root = document.getElementById('promptHistory');
  const stored = await chrome.storage.local.get('sc_provider_prompt_history').catch(() => ({}));
  const history = Array.isArray(stored.sc_provider_prompt_history) ? stored.sc_provider_prompt_history.slice(0, 5) : [];
  if (!history.length) { root.innerHTML = '<span class="history-empty">Prompts you send stay here locally for quick re-run.</span>'; return; }
  root.innerHTML = '';
  history.forEach((record) => {
    const button = document.createElement('button');
    button.className = 'history-item';
    button.type = 'button';
    const provider = document.createElement('span');
    provider.className = 'history-provider';
    provider.textContent = String(record.provider || 'provider');
    const text = document.createElement('span');
    text.className = 'history-text';
    text.textContent = String(record.prompt || '').replace(/\s+/g, ' ').slice(0, 96);
    button.append(provider, text);
    button.addEventListener('click', () => rerunPrompt(record));
    root.appendChild(button);
  });
}

async function renderProviderActivity() {
  const root = document.getElementById('providerActivity');
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_activity_log' }).catch(() => null);
  const entries = Array.isArray(response?.entries) ? response.entries.slice(0, 6) : [];
  if (!entries.length) { root.innerHTML = '<span class="history-empty">No provider routing activity yet.</span>'; return; }
  root.innerHTML = '';
  entries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const provider = document.createElement('span');
    provider.className = 'history-provider';
    provider.textContent = String(entry.provider || 'provider');
    const text = document.createElement('span');
    text.className = 'history-text';
    text.textContent = `${entry.state || 'event'}${entry.detail ? ` — ${entry.detail}` : ''}`;
    item.append(provider, text);
    root.appendChild(item);
  });
}

async function renderRecipes() {
  const root = document.getElementById('recipeList');
  const stored = await chrome.storage.local.get('sc_prompt_recipes').catch(() => ({}));
  const recipes = Array.isArray(stored.sc_prompt_recipes) ? stored.sc_prompt_recipes : [];
  root.innerHTML = '';
  recipes.forEach((recipe, index) => {
    const button = document.createElement('button');
    button.className = 'quick-ask';
    button.type = 'button';
    button.textContent = recipe.name;
    button.title = recipe.instruction;
    button.addEventListener('click', () => { document.getElementById('chatPrompt').value = recipe.instruction; setStatus(`Loaded recipe: ${recipe.name}.`); });
    const remove = document.createElement('button');
    remove.className = 'quick-ask';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = `Delete ${recipe.name}`;
    remove.addEventListener('click', async () => {
      const next = recipes.filter((_recipe, recipeIndex) => recipeIndex !== index);
      await chrome.storage.local.set({ sc_prompt_recipes: next });
      renderRecipes();
    });
    root.append(button, remove);
  });
  if (!recipes.length) root.innerHTML = '<span class="history-empty">Save the current instruction as your own local recipe.</span>';
}

async function runDownload(type, label) {
  try {
    setStatus(`${label}…`);
    const response = await requestPage(type);
    if (!response?.ok) throw new Error(response?.reason || 'The active page could not prepare this capture.');
    setStatus(`${label} saved.`, 'success');
  } catch (error) {
    setStatus(error?.message || `${label} failed.`, 'error');
  }
}

document.getElementById('saveMarkdown').addEventListener('click', () => runDownload('sc_download_current_markdown', 'Markdown capture'));
document.getElementById('saveTranscript').addEventListener('click', () => runDownload('sc_download_current_transcript', 'Transcript'));
document.getElementById('autoCaptureMode').addEventListener('change', saveAutoCaptureSettings);
document.getElementById('autoCaptureChannels').addEventListener('change', saveAutoCaptureSettings);
document.getElementById('copyPageContext').addEventListener('click', copyActivePageContext);
document.getElementById('openChatGPT').addEventListener('click', async () => {
  if (await copyActivePageContext()) chrome.tabs.create({ url: 'https://chatgpt.com/' });
});
document.getElementById('readProviderReply').addEventListener('click', readProviderReplies);
document.getElementById('copyProviderReply').addEventListener('click', async () => {
  if (!lastProviderReply) return setStatus('Read a provider reply first.', 'error');
  try { await navigator.clipboard.writeText(lastProviderReply); setStatus('Provider reply copied.', 'success'); }
  catch { setStatus('This browser blocked copying the reply.', 'error'); }
});
document.getElementById('saveProviderReply').addEventListener('click', async () => {
  if (!lastProviderReply) return setStatus('Read a provider reply first.', 'error');
  const provider = lastProviderName || 'provider';
  const response = await chrome.runtime.sendMessage({ type: 'sc_download_archive_file', folder: 'captures', filename: `${provider}_reply_${new Date().toISOString().slice(0, 10)}.md`, mimeType: 'text/markdown', content: `# ${provider} reply\n\n${lastProviderReply}\n` });
  if (response?.ok) setStatus('Provider reply saved as Markdown.', 'success');
  else setStatus(response?.reason || 'Could not save the provider reply.', 'error');
});
document.getElementById('autoReadReply').addEventListener('change', (event) => setLiveReply(event.target.checked));
document.getElementById('focusProvider').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_focus' });
  if (!response?.ok) setStatus(response?.reason || 'No provider tab is available.', 'error');
});
document.getElementById('askChatGPT').addEventListener('click', async () => {
  const instruction = document.getElementById('chatPrompt').value.trim();
  if (!instruction) return setStatus('Write what you want the selected AI to do first.', 'error');
  await askProvider(instruction);
});
document.querySelectorAll('[data-quick-ask]').forEach((button) => {
  button.addEventListener('click', async () => {
    const instruction = button.dataset.quickAsk || '';
    document.getElementById('chatPrompt').value = instruction;
    await askProvider(instruction);
  });
});
document.getElementById('openArchive').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));
document.getElementById('saveRecipe').addEventListener('click', async () => {
  const name = document.getElementById('recipeName').value.trim();
  const instruction = document.getElementById('chatPrompt').value.trim();
  if (!name || !instruction) return setStatus('Give the recipe a name and write its instruction first.', 'error');
  const stored = await chrome.storage.local.get('sc_prompt_recipes');
  const recipes = Array.isArray(stored.sc_prompt_recipes) ? stored.sc_prompt_recipes : [];
  await chrome.storage.local.set({ sc_prompt_recipes: [{ name, instruction }, ...recipes.filter((recipe) => recipe.name !== name)].slice(0, 20) });
  document.getElementById('recipeName').value = '';
  await renderRecipes();
  setStatus(`Saved recipe: ${name}.`, 'success');
});

refreshStatus();
loadAutoCaptureSettings();
renderPromptHistory();
renderProviderActivity();
renderRecipes();
setLiveReply(document.getElementById('autoReadReply').checked);

// ─── Playlist Hub & Batch Transcript ─────────────────────────────────────────

let currentPlaylistVideos = [];
let selectedVideoIndices = new Set();
let activePlaylistId = null;

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

function fmtSeconds(s) {
  if (!s || isNaN(s)) return '0m';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function parseDuration(dur) {
  if (!dur) return 0;
  const p = String(dur).trim().split(':').map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return 0;
}

// Check if current tab is a channel or video page and show uploads shortcut
async function checkUploadsShortcut() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !tab.url.includes('youtube.com')) return;
  chrome.tabs.sendMessage(tab.id, { type: 'sc_get_channel_id' }, (res) => {
    if (chrome.runtime.lastError || !res?.ok || !res.channelId) return;
    const card = document.getElementById('uploadsCard');
    const nameEl = document.getElementById('uploadsChannelName');
    if (!card || !nameEl) return;
    card.hidden = false;
    const label = res.channelTitle ? `${res.channelTitle}` : res.channelId;
    nameEl.textContent = label;
    nameEl.title = `${res.channelTitle || 'Channel'}: ${res.channelId}`;
    const uploadsUrl = 'https://www.youtube.com/playlist?list=UU' + res.channelId.slice(2);
    const goBtn = document.getElementById('goToUploads');
    if (goBtn) {
      goBtn.onclick = () => chrome.tabs.create({ url: uploadsUrl });
    }
    const copyBtn = document.getElementById('copyUploadsUrl');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(uploadsUrl).then(() => setStatus('Uploads playlist URL copied!', 'success'));
      };
    }
  });
}

// Check if current tab has an active playlist or queue
async function checkActiveTabPlaylist() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !tab.url.includes('youtube.com')) return;
  chrome.tabs.sendMessage(tab.id, { type: 'sc_get_playlist_videos' }, (res) => {
    if (chrome.runtime.lastError || !res?.ok || !res.videos?.length) return;
    const card = document.getElementById('activePlaylistCard');
    const titleEl = document.getElementById('activePlaylistTitle');
    if (!card || !titleEl) return;
    card.hidden = false;
    const isQ = res.isQueue;
    titleEl.textContent = `${isQ ? '📋 Queue' : '🎵 Playlist'}: ${res.playlistTitle} (${res.videoCount} videos)`;
    titleEl.title = res.playlistTitle;

    const loadBtn = document.getElementById('loadActivePlaylistBtn');
    if (loadBtn) {
      loadBtn.onclick = () => {
        loadVideosIntoBatchCard(res.playlistId, res.playlistTitle, res.videos);
        setStatus(`Loaded ${res.videoCount} videos from active tab.`, 'success');
      };
    }

    const saveBtn = document.getElementById('saveActivePlaylistBtn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const key = 'sc_playlist_backup_' + res.playlistId;
        const backup = {
          format: 'social-companion-playlist-backup',
          schemaVersion: 1,
          playlistId: res.playlistId,
          playlistTitle: res.playlistTitle,
          exportedAt: new Date().toISOString(),
          source: 'scraped',
          items: res.videos.map((v, i) => ({
            position: v.position || i + 1,
            videoId: v.videoId,
            title: v.title,
            channel: v.channel || '',
            duration: v.duration || '',
          })),
        };
        chrome.storage.local.set({ [key]: backup }, () => {
          setStatus(`Saved "${res.playlistTitle}" backup.`, 'success');
          renderPlaylistHub();
        });
      };
    }
  });
}

// Render the playlist hub from all saved backups
function renderPlaylistHub() {
  chrome.runtime.sendMessage({ type: 'sc_list_playlist_backups' }, (res) => {
    const listEl = document.getElementById('playlistHubList');
    const card = document.getElementById('playlistHubCard');
    if (!listEl || !card) return;
    card.hidden = false;

    const backups = res?.backups || [];
    if (backups.length === 0) {
      listEl.innerHTML = '<span class="history-empty">No saved playlists yet — click "Load into Batch Actions" on any playlist/queue page.</span>';
      return;
    }

    backups.sort((a, b) => new Date(b.exportedAt || 0) - new Date(a.exportedAt || 0));

    listEl.innerHTML = backups.map(e => {
      const totalSec = (e.items || []).reduce((s, i) => s + parseDuration(i.duration), 0);
      const dur = totalSec > 0 ? fmtSeconds(totalSec) : '—';
      const tBadge = e.hasTranscripts ? `<span style="color:#5ee0b1;font-size:10px;">✓ transcripts</span>` : '';
      const src = e.source === 'youtube-data-api' ? `<span style="color:#9b72ff;font-size:10px;">API</span>` : '';
      const isQ = (e.playlistId || '').startsWith('WL') || (e.playlistId || '').startsWith('LL') || (e.playlistId || '') === 'queue';
      const isUploads = (e.playlistId || '').startsWith('UU');
      const typeIcon = isUploads ? '🎬' : isQ ? '📋' : '🎵';
      return `<div class="history-item" style="flex-direction:column;align-items:stretch;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span>${typeIcon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(e.playlistTitle)}">${escapeHtml(e.playlistTitle)}</div>
            <div style="font-size:10px;color:#aaa5bd;margin-top:2px;">${e.videoCount} vids · ${dur} ${tBadge} ${src}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="btn load-pl" data-pid="${e.playlistId}" style="font-size:10px;padding:3px 7px;">Load</button>
            <button class="btn exp-pl" data-pid="${e.playlistId}" style="font-size:10px;padding:3px 7px;" title="Export options">⋯</button>
          </div>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.load-pl').forEach(btn => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const backup = backups.find(b => b.playlistId === btn.dataset.pid);
        if (backup && backup.items) {
          loadVideosIntoBatchCard(backup.playlistId, backup.playlistTitle, backup.items);
          setStatus(`Loaded "${backup.playlistTitle}" (${backup.items.length} videos).`, 'success');
        }
      };
    });

    listEl.querySelectorAll('.exp-pl').forEach(btn => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        showExportMenu(btn.dataset.pid, backups, btn);
      };
    });
  });
}

function loadVideosIntoBatchCard(playlistId, playlistTitle, videos) {
  activePlaylistId = playlistId;
  currentPlaylistVideos = videos.map((item, i) => ({
    position: item.position || i + 1,
    videoId: item.videoId || '',
    title: item.title || `Video ${i + 1}`,
    channel: item.channel || '',
    duration: item.duration || '',
    hasTranscript: Boolean(item.hasTranscript || (item.transcriptCollection && item.transcriptCollection.status === 'complete')),
    segments: item.segments || item.transcriptCollection?.segments || [],
  }));
  selectedVideoIndices = new Set(currentPlaylistVideos.map((_, i) => i));

  const batchCard = document.getElementById('batchTranscriptCard');
  if (batchCard) batchCard.hidden = false;

  renderBatchList();
  renderPlaylistStats({ playlistTitle, items: currentPlaylistVideos });
}

function renderBatchList() {
  const el = document.getElementById('batchTranscriptList');
  if (!el) return;
  if (currentPlaylistVideos.length === 0) {
    el.innerHTML = '<span class="history-empty">No videos loaded.</span>';
    return;
  }
  el.innerHTML = currentPlaylistVideos.map((v, i) => {
    const dot = v.hasTranscript ? '🟢' : '⚪';
    const chk = selectedVideoIndices.has(i) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);">
      <input type="checkbox" class="vsel" data-i="${i}" ${chk} style="margin:0;flex-shrink:0;">
      <span title="${v.hasTranscript ? 'Transcript available' : 'Transcript not saved yet'}">${dot}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</span>
      <span style="color:#aaa5bd;font-size:10px;flex-shrink:0;">${v.duration || ''}</span>
      <a href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" style="color:#9b72ff;font-size:11px;text-decoration:none;flex-shrink:0;" title="Open video" onclick="event.stopPropagation()">▶</a>
    </label>`;
  }).join('');

  el.querySelectorAll('.vsel').forEach(cb => {
    cb.onchange = () => {
      const i = parseInt(cb.dataset.i);
      cb.checked ? selectedVideoIndices.add(i) : selectedVideoIndices.delete(i);
    };
  });
}

function renderPlaylistStats(backup) {
  const el = document.getElementById('playlistStats');
  if (!el || !backup?.items) return;
  const items = backup.items;
  const total = items.length;
  const withT = items.filter(i => i.hasTranscript || (i.transcriptCollection && i.transcriptCollection.status === 'complete')).length;
  const totalSec = items.reduce((s, i) => s + parseDuration(i.duration), 0);
  el.innerHTML = `<strong>${total}</strong> videos · <span style="color:#5ee0b1;">${withT}</span> with transcripts · total <strong>${fmtSeconds(totalSec)}</strong>`;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function showExportMenu(playlistId, backups, anchor) {
  document.getElementById('sc-exp-menu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'sc-exp-menu';
  menu.style.cssText = 'position:fixed;z-index:9999;background:#1c1a29;border:1px solid #3a3652;border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,0.6);';
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.max(4, r.right - 140) + 'px';
  menu.style.top = (r.bottom + 4) + 'px';
  [['JSON', 'json'], ['CSV', 'csv'], ['Markdown', 'md'], ['Copy URLs', 'urls'], ['Copy Titles', 'titles']].forEach(([label, fmt]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 10px;font-size:12px;background:none;border:none;color:#f5f3ff;cursor:pointer;border-radius:4px;white-space:nowrap;';
    b.onmouseenter = () => b.style.background = 'rgba(155,114,255,0.2)';
    b.onmouseleave = () => b.style.background = 'none';
    b.onclick = () => { menu.remove(); exportPlaylist(playlistId, backups, fmt); };
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', function h(e) {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', h); }
  }), 10);
}

function exportPlaylist(playlistId, backups, fmt) {
  const backup = backups.find(b => b.playlistId === playlistId);
  if (!backup) return;
  const items = backup.items || [];
  const title = backup.playlistTitle || playlistId;

  if (fmt === 'urls') {
    navigator.clipboard.writeText(items.map(i => `https://www.youtube.com/watch?v=${i.videoId}`).join('\n'));
    setStatus('URLs copied to clipboard!', 'success'); return;
  }
  if (fmt === 'titles') {
    navigator.clipboard.writeText(items.map((i, n) => `${i.position || n + 1}. ${i.title}`).join('\n'));
    setStatus('Titles copied to clipboard!', 'success'); return;
  }

  let content = '', filename = `playlist_${playlistId}`, mime = 'text/plain';
  if (fmt === 'json') {
    content = JSON.stringify({ playlistId, title, exportedAt: backup.exportedAt, videoCount: items.length, items }, null, 2);
    filename += '.json'; mime = 'application/json';
  } else if (fmt === 'csv') {
    content = 'Position,VideoID,Title,Channel,Duration,URL\n' + items.map(i =>
      `${i.position || ''},"${i.videoId || ''}","${(i.title || '').replace(/"/g, '""')}","${(i.channel || '').replace(/"/g, '""')}",${i.duration || ''},https://www.youtube.com/watch?v=${i.videoId || ''}`
    ).join('\n');
    filename += '.csv'; mime = 'text/csv';
  } else if (fmt === 'md') {
    content = `# ${title}\n\nExported: ${backup.exportedAt || new Date().toISOString()}\n${items.length} videos\n\n` +
      items.map(i => `${i.position || ''}. [${i.title || 'Untitled'}](https://www.youtube.com/watch?v=${i.videoId || ''}) — ${i.channel || ''} ${i.duration ? `(${i.duration})` : ''}`).join('\n');
    filename += '.md';
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: mime })), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
  setStatus(`Exported ${fmt.toUpperCase()}`, 'success');
}

function exportCurrentPlaylist(fmt) {
  if (!currentPlaylistVideos.length) { setStatus('Load a playlist first.', 'error'); return; }
  const backup = { playlistId: activePlaylistId || 'current', playlistTitle: 'Current Playlist', exportedAt: new Date().toISOString(), items: currentPlaylistVideos };
  exportPlaylist(backup.playlistId, [backup], fmt);
}

// ─── Batch Transcript Extraction & Auto-Verification ───────────────────────────

async function extractSingleVideoTranscript(v, onProgress) {
  if (!v?.videoId) return { title: v.title || '', videoId: '', channel: v.channel || '', text: '' };

  // 1. In-memory cached segments
  if (v.segments?.length > 0) {
    const text = v.segments.map(s => s.text).join(' ');
    v.hasTranscript = true;
    v.transcript = text;
    return { title: v.title, videoId: v.videoId, channel: v.channel, text, segments: v.segments };
  }

  // 2. Pre-saved metadata transcript
  try {
    const meta = await chrome.storage.local.get([`sc_meta_${v.videoId}`]);
    const stored = meta?.[`sc_meta_${v.videoId}`];
    if (stored?.transcript) {
      v.hasTranscript = true;
      v.transcript = stored.transcript;
      v.segments = stored.segments || [];
      return { title: v.title, videoId: v.videoId, channel: v.channel, text: stored.transcript, segments: v.segments };
    }
  } catch {}

  // 3. Background tab fetch with polling
  try {
    if (onProgress) onProgress(`Opening tab for ${v.title.slice(0, 30)}…`);
    const tab = await chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${v.videoId}`, active: false });

    let transcriptResp = null;
    const maxPolls = 18;
    for (let poll = 0; poll < maxPolls; poll++) {
      await new Promise(r => setTimeout(r, 1000));
      if (onProgress) onProgress(`Waiting for captions… ${poll + 1}/${maxPolls}s (${v.title.slice(0, 22)})`);
      try {
        const checkStatus = await new Promise(r => chrome.tabs.sendMessage(tab.id, { type: 'sc_get_capture_status' }, r));
        if (checkStatus?.transcriptAvailable) {
          transcriptResp = await new Promise(r => chrome.tabs.sendMessage(tab.id, { type: 'sc_collect_transcript' }, r));
          break;
        }
      } catch {}
    }

    if (!transcriptResp) {
      transcriptResp = await new Promise(r => chrome.tabs.sendMessage(tab.id, { type: 'sc_collect_transcript' }, r)).catch(() => null);
    }
    await chrome.tabs.remove(tab.id).catch(() => {});

    const segs = transcriptResp?.segments || [];
    const text = segs.length > 0 ? segs.map(s => s.text).join(' ') : '[No transcript available]';

    if (segs.length > 0) {
      v.hasTranscript = true;
      v.segments = segs;
      v.transcript = text;
      // Persist in local storage
      chrome.storage.local.set({
        [`sc_meta_${v.videoId}`]: {
          title: v.title,
          channel: v.channel,
          transcript: text,
          segments: segs,
          duration: v.duration,
          updatedAt: new Date().toISOString(),
        }
      }).catch(() => {});
    }

    return { title: v.title, videoId: v.videoId, channel: v.channel, text, segments: segs };
  } catch (e) {
    return { title: v.title, videoId: v.videoId, channel: v.channel, text: `[Error: ${e.message}]`, segments: [] };
  }
}

async function autoVerifyAllTranscripts() {
  const indices = Array.from(selectedVideoIndices).sort((a, b) => a - b);
  if (!indices.length) { setStatus('Select at least one video.', 'error'); return; }
  const statusEl = document.getElementById('batchTranscriptStatus');

  let successCount = 0;
  for (let n = 0; n < indices.length; n++) {
    const idx = indices[n];
    const v = currentPlaylistVideos[idx];
    if (!v?.videoId) continue;

    if (statusEl) statusEl.textContent = `⚡ [${n + 1}/${indices.length}] Verifying: ${v.title.slice(0, 35)}…`;
    const res = await extractSingleVideoTranscript(v, (sub) => {
      if (statusEl) statusEl.textContent = `⚡ [${n + 1}/${indices.length}] ${sub}`;
    });

    if (v.hasTranscript) successCount++;
    renderBatchList();
    renderPlaylistStats({ items: currentPlaylistVideos });
  }

  // Save updated playlist backup with collected transcripts
  if (activePlaylistId) {
    const key = 'sc_playlist_backup_' + activePlaylistId;
    const backup = {
      format: 'social-companion-playlist-backup',
      schemaVersion: 1,
      playlistId: activePlaylistId,
      playlistTitle: document.getElementById('activePlaylistTitle')?.textContent || 'Playlist',
      exportedAt: new Date().toISOString(),
      items: currentPlaylistVideos,
      hasTranscripts: successCount > 0,
    };
    chrome.storage.local.set({ [key]: backup }, () => renderPlaylistHub());
  }

  if (statusEl) statusEl.textContent = `✓ Verification complete: ${successCount}/${indices.length} transcripts verified and saved locally!`;
  setStatus(`Verified ${successCount}/${indices.length} transcripts`, 'success');
}

async function copyTranscripts(onlySelected = true) {
  const indices = onlySelected ? Array.from(selectedVideoIndices).sort((a, b) => a - b) : currentPlaylistVideos.map((_, i) => i);
  if (!indices.length) { setStatus('No videos selected.', 'error'); return; }
  const statusEl = document.getElementById('batchTranscriptStatus');
  const results = [];

  for (let n = 0; n < indices.length; n++) {
    const v = currentPlaylistVideos[indices[n]];
    if (!v?.videoId) continue;
    if (statusEl) statusEl.textContent = `[${n + 1}/${indices.length}] Extracting: ${v.title.slice(0, 35)}…`;
    const res = await extractSingleVideoTranscript(v, (sub) => {
      if (statusEl) statusEl.textContent = `[${n + 1}/${indices.length}] ${sub}`;
    });
    results.push(res);
    renderBatchList();
  }

  const out = results.map((r, i) =>
    `## ${i + 1}. ${r.title}\nURL: https://www.youtube.com/watch?v=${r.videoId}${r.channel ? `\nChannel: ${r.channel}` : ''}\n\n${r.text}\n\n---`
  ).join('\n\n');
  await navigator.clipboard.writeText(out);
  if (statusEl) statusEl.textContent = `✓ Copied ${results.length} transcripts to clipboard!`;
  setStatus(`Copied ${results.length} transcripts`, 'success');
}

async function downloadBundle(fmt) {
  if (!currentPlaylistVideos.length) { setStatus('Load a playlist first.', 'error'); return; }
  const indices = Array.from(selectedVideoIndices).sort((a, b) => a - b);
  if (!indices.length) { setStatus('Select at least one video.', 'error'); return; }

  const statusEl = document.getElementById('batchTranscriptStatus');
  if (statusEl) statusEl.textContent = `Preparing ${fmt.toUpperCase()} bundle for ${indices.length} videos…`;

  // Ensure transcripts are gathered for selected videos
  const gathered = [];
  for (let n = 0; n < indices.length; n++) {
    const v = currentPlaylistVideos[indices[n]];
    if (!v?.videoId) continue;
    if (!v.hasTranscript) {
      if (statusEl) statusEl.textContent = `[${n + 1}/${indices.length}] Fetching transcript: ${v.title.slice(0, 30)}…`;
      await extractSingleVideoTranscript(v, (sub) => {
        if (statusEl) statusEl.textContent = `[${n + 1}/${indices.length}] ${sub}`;
      });
      renderBatchList();
    }
    gathered.push(v);
  }

  const title = document.getElementById('activePlaylistTitle')?.textContent?.replace(/^[^\w]+/, '') || 'YouTube_Playlist';
  const safeName = title.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 50) || 'playlist_bundle';

  let content = '', filename = `${safeName}_bundle.${fmt}`, mime = 'text/plain';

  if (fmt === 'md') {
    content = `# ${title}\n\nExported: ${new Date().toISOString()}\nTotal Videos: ${gathered.length}\n\n## Table of Contents\n\n` +
      gathered.map((v, i) => `${i + 1}. [${v.title}](#video-${i + 1}-${v.videoId}) ${v.duration ? `(${v.duration})` : ''}`).join('\n') +
      '\n\n---\n\n' +
      gathered.map((v, i) =>
        `<a name="video-${i + 1}-${v.videoId}"></a>\n### ${i + 1}. [${v.title}](https://www.youtube.com/watch?v=${v.videoId})\n- **Channel**: ${v.channel || 'Unknown'}\n- **Duration**: ${v.duration || 'N/A'}\n- **URL**: https://www.youtube.com/watch?v=${v.videoId}\n\n#### Transcript\n\n${v.transcript || (v.segments?.length ? v.segments.map(s => s.text).join(' ') : '[No transcript available]')}\n\n---`
      ).join('\n\n');
    mime = 'text/markdown';
  } else if (fmt === 'json') {
    content = JSON.stringify({
      playlistTitle: title,
      exportedAt: new Date().toISOString(),
      videoCount: gathered.length,
      items: gathered.map((v, i) => ({
        position: i + 1,
        videoId: v.videoId,
        title: v.title,
        channel: v.channel,
        duration: v.duration,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        transcript: v.transcript || (v.segments?.length ? v.segments.map(s => s.text).join(' ') : ''),
        segments: v.segments || [],
      })),
    }, null, 2);
    mime = 'application/json';
  } else if (fmt === 'csv') {
    content = 'Position,VideoID,Title,Channel,Duration,URL,Transcript\n' + gathered.map((v, i) => {
      const tEsc = (v.transcript || (v.segments?.length ? v.segments.map(s => s.text).join(' ') : '')).replace(/"/g, '""');
      const titleEsc = (v.title || '').replace(/"/g, '""');
      const chanEsc = (v.channel || '').replace(/"/g, '""');
      return `${i + 1},"${v.videoId}","${titleEsc}","${chanEsc}","${v.duration || ''}","https://www.youtube.com/watch?v=${v.videoId}","${tEsc}"`;
    }).join('\n');
    mime = 'text/csv';
  }

  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);

  if (statusEl) statusEl.textContent = `✓ Downloaded ${fmt.toUpperCase()} bundle with ${gathered.length} videos and transcripts!`;
  setStatus(`Downloaded ${fmt.toUpperCase()} bundle`, 'success');
}

async function copyNotesList() {
  const indices = Array.from(selectedVideoIndices).sort((a, b) => a - b);
  if (!indices.length) { setStatus('No videos selected.', 'error'); return; }
  const out = indices.map((idx, n) => {
    const v = currentPlaylistVideos[idx];
    return `### ${n + 1}. [${v.title}](https://www.youtube.com/watch?v=${v.videoId})\n- **Channel**: ${v.channel || 'Unknown'}\n- **Duration**: ${v.duration || 'N/A'}\n- **URL**: https://www.youtube.com/watch?v=${v.videoId}\n`;
  }).join('\n');
  await navigator.clipboard.writeText(out);
  setStatus(`Copied ${indices.length} video notes list!`, 'success');
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById('refreshPlaylistHub')?.addEventListener('click', renderPlaylistHub);
document.getElementById('selectAllVideos')?.addEventListener('click', () => {
  selectedVideoIndices = new Set(currentPlaylistVideos.map((_, i) => i));
  renderBatchList();
});
document.getElementById('deselectAllVideos')?.addEventListener('click', () => {
  selectedVideoIndices.clear();
  renderBatchList();
});
document.getElementById('autoVerifyAllTranscripts')?.addEventListener('click', autoVerifyAllTranscripts);
document.getElementById('copySelectedTranscripts')?.addEventListener('click', () => copyTranscripts(true));
document.getElementById('copyAllTranscripts')?.addEventListener('click', () => copyTranscripts(false));
document.getElementById('copyNotesList')?.addEventListener('click', copyNotesList);
document.getElementById('dlBundleMd')?.addEventListener('click', () => downloadBundle('md'));
document.getElementById('dlBundleJson')?.addEventListener('click', () => downloadBundle('json'));
document.getElementById('dlBundleCsv')?.addEventListener('click', () => downloadBundle('csv'));
document.getElementById('exportPlaylistJson')?.addEventListener('click', () => exportCurrentPlaylist('json'));
document.getElementById('exportPlaylistCsv')?.addEventListener('click', () => exportCurrentPlaylist('csv'));
document.getElementById('exportPlaylistMd')?.addEventListener('click', () => exportCurrentPlaylist('md'));
document.getElementById('copyPlaylistUrls')?.addEventListener('click', () => {
  const urls = currentPlaylistVideos.map(v => `https://www.youtube.com/watch?v=${v.videoId}`).join('\n');
  navigator.clipboard.writeText(urls).then(() => setStatus('URLs copied!', 'success'));
});
document.getElementById('copyPlaylistTitles')?.addEventListener('click', () => {
  const titles = currentPlaylistVideos.map((v, i) => `${i + 1}. ${v.title}`).join('\n');
  navigator.clipboard.writeText(titles).then(() => setStatus('Titles copied!', 'success'));
});

// Initialization
checkUploadsShortcut();
checkActiveTabPlaylist();
renderPlaylistHub();
