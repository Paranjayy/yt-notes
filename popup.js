'use strict';

const statusEl = document.getElementById('status');
const titleEl = document.getElementById('pageTitle');
const metaEl = document.getElementById('pageMeta');
let activeTabId = null;
let replyPoller = null;
let lastProviderReply = '';
let lastProviderName = 'providers';
let currentPlaylistVideos = [];

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
  await checkUploadsShortcut();
  await checkBatchTranscriptContext();
}

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
      item.title = `Open ${backup.title}`;

      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;';
      const titleSpan = document.createElement('span');
      titleSpan.style.cssText = 'flex:1;font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;';
      titleSpan.textContent = backup.title;
      titleSpan.addEventListener('click', () => chrome.tabs.create({ url: backup.url }));
      titleRow.appendChild(titleSpan);

      const exportBtn = document.createElement('button');
      exportBtn.textContent = '⋯';
      exportBtn.style.cssText = 'background:none;border:1px solid var(--line);color:var(--muted);border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;';
      exportBtn.title = 'Export options';
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPlaylistExportMenu(exportBtn, backup);
      });
      titleRow.appendChild(exportBtn);

      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'font-size:10px;color:var(--muted);display:flex;gap:8px;width:100%;flex-wrap:wrap;';
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
      root.appendChild(item);
    });
  } catch {
    root.innerHTML = '<span class="history-empty">Could not load playlist backups.</span>';
  }
}

function showPlaylistExportMenu(anchor, backup) {
  const existing = document.getElementById('playlistExportMenu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.id = 'playlistExportMenu';
  menu.style.cssText = 'position:fixed;z-index:99999;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px;display:grid;gap:4px;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
  const rect = anchor.getBoundingClientRect();
  menu.style.left = Math.min(rect.left, window.innerWidth - 140) + 'px';
  menu.style.top = (rect.bottom + 4) + 'px';
  const formats = [
    { label: 'Copy JSON', fn: () => exportPlaylistAs(backup, 'json') },
    { label: 'Copy CSV', fn: () => exportPlaylistAs(backup, 'csv') },
    { label: 'Copy Markdown', fn: () => exportPlaylistAs(backup, 'md') },
    { label: 'Copy URLs', fn: () => exportPlaylistAs(backup, 'urls') },
    { label: 'Copy Titles', fn: () => exportPlaylistAs(backup, 'titles') },
  ];
  formats.forEach(({ label, fn }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'background:none;border:none;color:var(--text);font-size:11px;padding:6px 10px;cursor:pointer;text-align:left;border-radius:5px;';
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(155,114,255,0.15)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
      menu.remove();
    });
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
  setTimeout(() => document.addEventListener('click', close), 10);
}

async function exportPlaylistAs(backup, format) {
  const stored = await chrome.storage.local.get([`sc_playlist_backup_${backup.playlistId}`]);
  const full = stored[`sc_playlist_backup_${backup.playlistId}`];
  const items = full?.items || [];
  if (!items.length) return setStatus('No videos in this playlist backup.', 'error');
  let text = '';
  if (format === 'json') {
    text = JSON.stringify({ title: backup.title, playlistId: backup.playlistId, url: backup.url, videoCount: items.length, exportedAt: new Date().toISOString(), items }, null, 2);
  } else if (format === 'csv') {
    text = 'Position,Title,Channel,Duration,Video ID,URL\n' + items.map((v) => `${v.position},"${(v.title || '').replace(/"/g, '""')}","${(v.channel || '').replace(/"/g, '""')}",${v.duration || ''},${v.videoId || ''},${v.url || ''}`).join('\n');
  } else if (format === 'md') {
    text = `# ${backup.title}\n\n**Videos:** ${items.length} | **URL:** ${backup.url}\n\n`;
    items.forEach((v) => { text += `${v.position}. [${v.title || 'Untitled'}](${v.url || ''}) — ${v.channel || 'Unknown'} (${v.duration || '??:??'})\n`; });
  } else if (format === 'urls') {
    text = items.filter((v) => v.url).map((v) => v.url).join('\n');
  } else if (format === 'titles') {
    text = items.map((v) => `${v.position}. ${v.title || 'Untitled'}`).join('\n');
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`Copied ${format.toUpperCase()} — ${items.length} videos.`, 'success');
  } catch {
    setStatus('Could not copy to clipboard.', 'error');
  }
}

let currentPlaylistMeta = null;

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
      document.getElementById('playlistStats').innerHTML = '';
      currentPlaylistVideos = [];
      currentPlaylistMeta = null;
      return;
    }
    card.hidden = false;
    currentPlaylistVideos = response.videos;
    currentPlaylistMeta = { title: response.title, playlistId: response.playlistId };
    statusEl.textContent = `${response.title} — ${response.videos.length} videos`;
    renderBatchTranscriptList(response.videos);
    renderPlaylistStats(response.videos);
  } catch {
    card.hidden = true;
  }
}

function renderPlaylistStats(videos) {
  const statsEl = document.getElementById('playlistStats');
  if (!videos.length) { statsEl.innerHTML = ''; return; }
  const channels = new Map();
  let totalSeconds = 0;
  let withTranscript = 0;
  videos.forEach((v) => {
    if (v.channel) channels.set(v.channel, (channels.get(v.channel) || 0) + 1);
    if (v.duration) {
      const parts = v.duration.split(':').map(Number);
      if (parts.length === 3) totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) totalSeconds += parts[0] * 60 + parts[1];
    }
    if (v.hasTranscript) withTranscript++;
  });
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const topChannels = [...channels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ');
  statsEl.innerHTML = `<span style="color:var(--good);">${withTranscript}/${videos.length} have transcripts</span> · ${durStr} total${topChannels ? `<br>Top: ${topChannels}` : ''}`;
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
    setStatus(`Copied transcripts for ${copied} video${copied === 1 ? '' : 's'}.`, 'success');
  } catch {
    setStatus('Could not copy to clipboard.', 'error');
  }
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

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function parseDuration(dur) {
  if (!dur) return 0;
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

async function exportCurrentPlaylist(format) {
  if (!currentPlaylistVideos.length) return setStatus('No videos loaded.', 'error');
  const title = currentPlaylistMeta?.title || 'Playlist';
  const id = currentPlaylistMeta?.playlistId || '';
  const url = `https://www.youtube.com/playlist?list=${id}`;
  let text = '';
  if (format === 'json') {
    text = JSON.stringify({ title, playlistId: id, url, videoCount: currentPlaylistVideos.length, exportedAt: new Date().toISOString(), items: currentPlaylistVideos.map((v) => ({ position: v.position, title: v.title, videoId: v.videoId, hasTranscript: v.hasTranscript })) }, null, 2);
  } else if (format === 'csv') {
    text = 'Position,Title,Video ID,Has Transcript,URL\n' + currentPlaylistVideos.map((v) => `${v.position},"${(v.title || '').replace(/"/g, '""')}",${v.videoId || ''},${v.hasTranscript ? 'Yes' : 'No'},https://www.youtube.com/watch?v=${v.videoId || ''}`).join('\n');
  } else if (format === 'md') {
    text = `# ${title}\n\n**Videos:** ${currentPlaylistVideos.length} | **URL:** ${url}\n\n`;
    currentPlaylistVideos.forEach((v) => { text += `${v.position}. [${v.title || 'Untitled'}](https://www.youtube.com/watch?v=${v.videoId || ''})${v.hasTranscript ? ' ✓' : ''}\n`; });
  } else if (format === 'urls') {
    text = currentPlaylistVideos.filter((v) => v.videoId).map((v) => `https://www.youtube.com/watch?v=${v.videoId}`).join('\n');
  } else if (format === 'titles') {
    text = currentPlaylistVideos.map((v) => `${v.position}. ${v.title || 'Untitled'}`).join('\n');
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`Copied ${format.toUpperCase()} — ${currentPlaylistVideos.length} videos.`, 'success');
  } catch {
    setStatus('Could not copy to clipboard.', 'error');
  }
}

document.getElementById('exportPlaylistJson').addEventListener('click', () => exportCurrentPlaylist('json'));
document.getElementById('exportPlaylistCsv').addEventListener('click', () => exportCurrentPlaylist('csv'));
document.getElementById('exportPlaylistMd').addEventListener('click', () => exportCurrentPlaylist('md'));
document.getElementById('copyPlaylistList').addEventListener('click', () => exportCurrentPlaylist('titles'));
document.getElementById('copyPlaylistUrls').addEventListener('click', () => exportCurrentPlaylist('urls'));
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
renderPromptHistory();
renderProviderActivity();
renderRecipes();
renderPlaylistHub();
setLiveReply(document.getElementById('autoReadReply').checked);
