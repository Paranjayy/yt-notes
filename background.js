// Service worker — opens the dashboard tab when the toolbar icon is clicked
chrome.runtime.onInstalled.addListener(() => {
  console.log("Social Companion Extension installed successfully.");
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({
      id: "sc-open-channel-uploads",
      title: "📋 View channel uploads as playlist",
      contexts: ["page"],
      documentUrlPatterns: ["https://*.youtube.com/*", "https://youtu.be/*"],
    });
    chrome.contextMenus.create({
      id: "sc-save-current-capture",
      title: "Save current capture as Markdown",
      contexts: ["page"],
      documentUrlPatterns: ["https://*.youtube.com/*", "https://youtu.be/*"],
    });
    chrome.contextMenus.create({
      id: "sc-open-capture-archive",
      title: "Open Social Companion capture archive",
      contexts: ["page"],
      documentUrlPatterns: ["https://*.youtube.com/*", "https://youtu.be/*"],
    });
    chrome.contextMenus.create({
      id: "sc-save-visible-playlist",
      title: "Download visible playlist backup (JSON)",
      contexts: ["page"],
      documentUrlPatterns: ["https://*.youtube.com/*"],
    });
    chrome.contextMenus.create({
      id: "sc-collect-visible-playlist-transcripts",
      title: "Collect transcripts for visible playlist videos",
      contexts: ["page"],
      documentUrlPatterns: ["https://*.youtube.com/*"],
    });
    chrome.contextMenus.create({
      id: "sc-ask-selection",
      title: "Ask selected text with",
      contexts: ["selection"],
    });
    ["chatgpt", "gemini", "claude", "grok"].forEach((provider) => {
      chrome.contextMenus.create({
        id: `sc-ask-selection-${provider}`,
        parentId: "sc-ask-selection",
        title: provider === "chatgpt" ? "ChatGPT" : provider[0].toUpperCase() + provider.slice(1),
        contexts: ["selection"],
      });
    });
  }).catch((error) => console.warn("Couldn't create Social Companion context menus", error));
});

// Open dashboard page on extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// This is deliberately injected only after a keyboard command. It gives the
// active page a compact command surface without a permanent all-sites widget.
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'sc-toggle-quick-palette') return;
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.id == null) return;
    return chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['quick-palette.js'] });
  }).catch((error) => {
    console.warn('Could not open the active-page palette', error);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith("sc-ask-selection-") && info.selectionText) {
    const provider = info.menuItemId.slice("sc-ask-selection-".length);
    const source = tab?.url ? `\n\nSource: ${tab.url}` : "";
    deliverProviderPrompt({
      provider,
      prompt: `Explain, analyze, or answer questions about this selected text. Keep useful nuance and clearly flag uncertainty.\n\nSelected text:\n${info.selectionText}${source}`,
      autoSubmit: true,
      startNewChat: false,
    }).catch((error) => console.warn("Couldn't send selected text to AI provider", error));
    return;
  }
  if (info.menuItemId === 'sc-open-channel-uploads' && tab?.id != null) {
    const tabUrl = tab.url || '';
    let directChannelId = null;
    const ucMatch = tabUrl.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
    if (ucMatch) directChannelId = ucMatch[1];
    const uuMatch = tabUrl.match(/list=(UU[A-Za-z0-9_-]{22})/);

    if (directChannelId) {
      chrome.tabs.create({ url: 'https://www.youtube.com/playlist?list=UU' + directChannelId.slice(2) });
      return;
    }
    if (uuMatch) {
      chrome.tabs.create({ url: 'https://www.youtube.com/playlist?list=' + uuMatch[1] });
      return;
    }

    // Try asking content script first
    chrome.tabs.sendMessage(tab.id, { type: 'sc_get_channel_id' }, async (res) => {
      if (res?.channelId) {
        chrome.tabs.create({ url: 'https://www.youtube.com/playlist?list=UU' + res.channelId.slice(2) });
        return;
      }

      // Background direct fetch fallback for /@handle or watch pages
      try {
        if (tabUrl.includes('youtube.com')) {
          console.log('[Social Companion BG] Resolving channel ID via direct fetch:', tabUrl);
          const fetchResp = await fetch(tabUrl, { credentials: 'omit' });
          if (fetchResp.ok) {
            const html = await fetchResp.text();
            const mExt = html.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/);
            if (mExt) {
              console.log('[Social Companion BG] Resolved externalId:', mExt[1]);
              chrome.tabs.create({ url: 'https://www.youtube.com/playlist?list=UU' + mExt[1].slice(2) });
              return;
            }
            const mChan = html.match(/channel_id=(UC[A-Za-z0-9_-]{22})/);
            if (mChan) {
              console.log('[Social Companion BG] Resolved channel_id:', mChan[1]);
              chrome.tabs.create({ url: 'https://www.youtube.com/playlist?list=UU' + mChan[1].slice(2) });
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[Social Companion BG] Direct fetch failed:', err);
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert('Social Companion: Could not detect channel ID. Try opening a video or channel page first.')
      }).catch(() => {});
    });
    return;
  }
  if (info.menuItemId === "sc-open-capture-archive") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    return;
  }
  if (info.menuItemId === "sc-save-current-capture" && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "sc_download_current_markdown" }).then((response) => {
      if (!response?.ok) {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
      }
    }).catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    });
  }
  if (info.menuItemId === "sc-save-visible-playlist" && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "sc_download_visible_playlist_backup" }).catch(() => {});
  }
  if (info.menuItemId === "sc-collect-visible-playlist-transcripts" && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "sc_collect_visible_playlist_transcripts" }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "sc_auto_capture_verified") {
    const videoId = String(msg.videoId || "").trim();
    const channel = String(msg.channel || "").trim();
    const title = String(msg.title || "video").trim();
    const content = typeof msg.content === "string" ? msg.content : "";
    if (!videoId || !content || !new RegExp(`^URL: https://www\\.youtube\\.com/watch\\?v=${videoId}(?:&|$)`, "m").test(content)) {
      sendResponse({ ok: false, reason: "Auto-capture rejected: current video ID and Markdown URL did not match." });
      return;
    }
    chrome.storage.local.get(["sc_auto_capture_mode", "sc_auto_capture_channels", `sc_auto_capture_${videoId}`]).then(async (stored) => {
      const mode = stored.sc_auto_capture_mode || "off";
      const whitelist = String(stored.sc_auto_capture_channels || "").split(/[\n,]/).map((value) => value.trim().toLowerCase()).filter(Boolean);
      if (mode === "off" || (mode === "whitelist" && !whitelist.includes(channel.toLowerCase()))) {
        sendResponse({ ok: false, skipped: true, reason: mode === "off" ? "Auto-capture is off." : "Channel is not whitelisted." });
        return;
      }
      const bytes = new TextEncoder().encode(content);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const prior = stored[`sc_auto_capture_${videoId}`];
      if (prior?.latestHash === hash) {
        sendResponse({ ok: true, skipped: true, reason: "This exact video version was already captured." });
        return;
      }
      const filename = `${title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100)}__${videoId}__${hash.slice(0, 10)}.md`;
      const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`;
      const downloadId = await chrome.downloads.download({ url: dataUrl, filename: `Social Companion/captures/${filename}`, saveAs: false });
      const versions = Array.isArray(prior?.versions) ? prior.versions : [];
      await chrome.storage.local.set({ [`sc_auto_capture_${videoId}`]: { latestHash: hash, versions: [...versions, { hash, capturedAt: new Date().toISOString(), downloadId }] } });
      sendResponse({ ok: true, versioned: Boolean(prior?.latestHash), downloadId });
    }).catch((error) => sendResponse({ ok: false, reason: error?.message || "Could not auto-capture this video." }));
    return true;
  }
  if (msg.type === "sc_provider_activity_log") {
    chrome.storage.local.get('sc_provider_activity_log').then((stored) => sendResponse({ ok: true, entries: Array.isArray(stored.sc_provider_activity_log) ? stored.sc_provider_activity_log : [] })).catch(() => sendResponse({ ok: true, entries: [] }));
    return true;
  }
  if (msg.type === "sc_provider_read_reply") {
    readProviderReply().then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error?.message || "Could not read the provider reply." }));
    return true;
  }
  if (msg.type === "sc_provider_read_replies") {
    readProviderReplies().then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error?.message || "Could not read the provider replies." }));
    return true;
  }
  if (msg.type === "sc_provider_focus") {
    focusProvider().then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error?.message || "Could not open the provider tab." }));
    return true;
  }
  if (msg.type === "sc_provider_prompt_batch") {
    deliverProviderBatch(msg).then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error?.message || "Could not open the AI providers." }));
    return true;
  }
  if (msg.type === "sc_provider_prompt") {
    deliverProviderPrompt(msg).then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error?.message || "Could not open the AI provider." }));
    return true;
  }
  if (msg.type !== "sc_download_archive_file") return;
  const filename = String(msg.filename || "capture.txt").replace(/[\\/:*?"<>|]/g, "_");
  const folder = msg.folder === "transcripts" ? "transcripts" : "captures";
  const content = typeof msg.content === "string" ? msg.content : "";
  if (!content) {
    sendResponse({ ok: false, reason: "There is no capture content to download." });
    return;
  }
  const dataUrl = `data:${msg.mimeType || "text/plain"};charset=utf-8,${encodeURIComponent(content)}`;
  chrome.downloads.download({
    url: dataUrl,
    filename: `Social Companion/${folder}/${filename}`,
    saveAs: false,
  }).then((downloadId) => {
    sendResponse({ ok: true, downloadId });
  }).catch((error) => {
    sendResponse({ ok: false, reason: error?.message || "The browser could not start this download." });
  });
  return true;
});

const PROVIDERS = {
  chatgpt: { url: "https://chatgpt.com/", pattern: "https://chatgpt.com/*" },
  gemini: { url: "https://gemini.google.com/", pattern: "https://gemini.google.com/*" },
  claude: { url: "https://claude.ai/new", pattern: "https://claude.ai/*" },
  grok: { url: "https://grok.com/", pattern: "https://grok.com/*" },
};

async function recordProviderActivity(provider, state, detail = '') {
  const stored = await chrome.storage.local.get('sc_provider_activity_log');
  const prior = Array.isArray(stored.sc_provider_activity_log) ? stored.sc_provider_activity_log : [];
  const entry = { provider, state, detail: String(detail || '').slice(0, 180), at: new Date().toISOString() };
  await chrome.storage.local.set({ sc_provider_activity_log: [entry, ...prior].slice(0, 40) });
}

async function latestProviderTarget() {
  const stored = await chrome.storage.local.get('sc_provider_last_tab');
  const target = stored.sc_provider_last_tab;
  if (!target?.tabId || !PROVIDERS[target.provider]) return null;
  try { await chrome.tabs.get(target.tabId); return target; } catch { return null; }
}

async function knownProviderTargets() {
  const stored = await chrome.storage.local.get(['sc_provider_targets', 'sc_provider_last_tab']);
  const candidates = stored.sc_provider_targets && typeof stored.sc_provider_targets === 'object' ? { ...stored.sc_provider_targets } : {};
  // Migration path for prompts sent before multi-provider receipts existed.
  const last = stored.sc_provider_last_tab;
  if (last?.provider && last?.tabId && !candidates[last.provider]) candidates[last.provider] = last;
  const targets = [];
  for (const [provider, target] of Object.entries(candidates)) {
    if (!PROVIDERS[provider] || !target?.tabId) continue;
    try { await chrome.tabs.get(target.tabId); targets.push({ provider, tabId: target.tabId, at: target.at }); } catch { /* stale tab; omit it */ }
  }
  return targets;
}

async function focusProvider() {
  const target = await latestProviderTarget();
  if (!target) return { ok: false, reason: "Send or insert a provider prompt first." };
  await chrome.tabs.update(target.tabId, { active: true });
  return { ok: true };
}

async function readProviderReply() {
  const target = await latestProviderTarget();
  if (!target) return { ok: false, reason: "Send or insert a provider prompt first." };
  const response = await chrome.tabs.sendMessage(target.tabId, { type: "sc_read_provider_reply", provider: target.provider });
  return response?.ok ? { ...response, provider: target.provider } : { ok: false, reason: response?.reason || "The provider response is not ready yet." };
}

async function readProviderReplies() {
  const targets = await knownProviderTargets();
  if (!targets.length) return { ok: false, reason: 'Send or insert a provider prompt first.' };
  const replies = [];
  const errors = [];
  for (const target of targets) {
    try {
      const response = await chrome.tabs.sendMessage(target.tabId, { type: 'sc_read_provider_reply', provider: target.provider });
      if (response?.ok && response.text) replies.push({ provider: target.provider, text: response.text });
      else errors.push({ provider: target.provider, reason: response?.reason || 'No visible reply yet.' });
    } catch (error) {
      errors.push({ provider: target.provider, reason: error?.message || 'Could not reach this provider tab.' });
    }
  }
  return replies.length ? { ok: true, replies, errors } : { ok: false, reason: errors.map((entry) => `${entry.provider}: ${entry.reason}`).join(' · ') || 'No provider replies are available yet.', errors };
}

function waitForProviderTab(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("The provider page did not finish loading.")), timeoutMs);
    const listener = (updatedId, changeInfo) => {
      if (updatedId === tabId && changeInfo.status === "complete") finish();
    };
    const finish = (error) => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      error ? reject(error) : resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch(() => finish(new Error("The provider tab closed before the prompt could be inserted.")));
  });
}

async function deliverProviderPrompt(message) {
  const provider = PROVIDERS[message.provider];
  if (!provider) return { ok: false, reason: "Choose a supported AI provider." };
  const candidates = message.startNewChat ? [] : await chrome.tabs.query({ url: provider.pattern });
  const existing = candidates.find((candidate) => candidate.status === "complete");
  const tab = existing || await chrome.tabs.create({ url: provider.url, active: false });
  await recordProviderActivity(message.provider, existing ? 'reusing tab' : 'opened tab', existing ? 'A matching provider tab was available.' : 'No reusable matching provider tab was returned by this browser.');
  if (tab.id == null) return { ok: false, reason: "The provider tab could not be created." };
  if (tab.status !== "complete") await waitForProviderTab(tab.id);
  let lastError = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    try {
      const result = await chrome.tabs.sendMessage(tab.id, { type: "sc_insert_provider_prompt", provider: message.provider, prompt: String(message.prompt || ""), autoSubmit: Boolean(message.autoSubmit) });
      if (result?.ok) {
        await chrome.storage.local.set({ sc_provider_last_tab: { provider: message.provider, tabId: tab.id, at: new Date().toISOString() } });
        const targets = await chrome.storage.local.get('sc_provider_targets');
        await chrome.storage.local.set({ sc_provider_targets: { ...(targets.sc_provider_targets || {}), [message.provider]: { tabId: tab.id, at: new Date().toISOString() } } });
        await chrome.storage.local.set({ sc_provider_last_status: { provider: message.provider, submitted: Boolean(result.submitted), at: new Date().toISOString() } });
        const stored = await chrome.storage.local.get('sc_provider_prompt_history');
        const prior = Array.isArray(stored.sc_provider_prompt_history) ? stored.sc_provider_prompt_history : [];
        const record = { provider: message.provider, prompt: String(message.prompt || ''), submitted: Boolean(result.submitted), at: new Date().toISOString() };
        await chrome.storage.local.set({ sc_provider_prompt_history: [record, ...prior.filter((item) => item.prompt !== record.prompt)].slice(0, 12) });
        await recordProviderActivity(message.provider, result.submitted ? 'sent' : 'inserted draft', result.submitted ? 'Provider send control accepted the prompt.' : 'Prompt is in the provider composer; send it there if needed.');
        return result;
      }
      lastError = new Error(result?.reason || "The provider composer is not ready.");
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  const failure = { ok: false, reason: `${message.provider}: ${lastError?.message || "open a signed-in provider chat and try again."}` };
  await chrome.storage.local.set({ sc_provider_last_status: { provider: message.provider, error: failure.reason, at: new Date().toISOString() } });
  await recordProviderActivity(message.provider, 'failed', failure.reason);
  return failure;
}

async function deliverProviderBatch(message) {
  const providers = [...new Set(Array.isArray(message.providers) ? message.providers : [])].filter((provider) => PROVIDERS[provider]);
  if (!providers.length) return { ok: false, reason: "Choose at least one supported AI target." };
  const results = [];
  for (const provider of providers) results.push({ provider, ...(await deliverProviderPrompt({ ...message, provider })) });
  const successful = results.filter((result) => result.ok);
  return { ok: successful.length > 0, sent: successful.filter((result) => result.submitted).length, inserted: successful.filter((result) => !result.submitted).length, results, reason: successful.length ? '' : results.map((result) => result.reason).filter(Boolean).join(' · ') };
}

// A single, deliberately sequential queue for playlist transcript backups.
// It only visits YouTube pages the user already selected from an open playlist;
// no third-party transcript service or API key is involved.
let playlistTranscriptQueue = null;
let recoveringPlaylistTranscriptQueue = true;
let playlistBackupWriteChain = Promise.resolve();

const TRANSCRIPT_TAB_LOAD_TIMEOUT_MS = 30000;
const TRANSCRIPT_RESPONSE_TIMEOUT_MS = 20000;
const TRANSCRIPT_MESSAGE_RETRIES = 8;
const PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY = "sc_playlist_transcript_queue_state";

function storageGet(keys) {
  return chrome.storage.local.get(keys);
}

function storageSet(items) {
  return chrome.storage.local.set(items);
}

function storageRemove(keys) {
  return chrome.storage.local.remove(keys);
}

function serializePlaylistBackupWrite(operation) {
  const work = playlistBackupWriteChain.then(operation, operation);
  // Keep the chain usable after a rejected write while returning the original
  // outcome to its caller.
  playlistBackupWriteChain = work.catch(() => {});
  return work;
}

async function persistQueueState(queue) {
  await storageSet({
    [PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY]: {
      playlist: queue.playlist,
      originTabId: queue.originTabId,
      total: queue.items.length,
      completed: queue.completed,
      counts: queue.counts,
      currentIndex: queue.currentIndex,
      nextIndex: queue.nextIndex,
      currentItem: queue.currentIndex == null ? null : queue.items[queue.currentIndex],
      ownedTabId: queue.ownedTabId || null,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function clearQueueState() {
  await storageRemove(PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY);
}

async function recoverInterruptedPlaylistTranscriptQueue() {
  try {
    const stored = await storageGet([PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY]);
    const state = stored[PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY];
    if (!state) return;
    if (state.ownedTabId) await chrome.tabs.remove(state.ownedTabId).catch(() => {});
    const interrupted = {
      playlist: state.playlist,
      originTabId: state.originTabId,
      items: Array.from({ length: state.total || 0 }),
      completed: state.completed || 0,
      counts: { complete: 0, "no-transcript": 0, error: 0, stopped: 0, ...state.counts },
      cancelled: false,
    };
    let currentItemAlreadyRecorded = false;
    if (state.currentItem) {
      const backupKey = `sc_playlist_backup_${state.playlist?.id}`;
      const backup = await storageGet([backupKey]);
      const itemKey = state.currentItem.videoId || `${state.currentItem.position}:${state.currentItem.title}`;
      const savedItem = (backup[backupKey]?.items || []).find((item) =>
        (item.videoId || `${item.position}:${item.title}`) === itemKey,
      );
      currentItemAlreadyRecorded = Boolean(savedItem?.transcriptCollection?.collectedAt);
    }
    if (state.currentItem && !currentItemAlreadyRecorded) {
      const outcome = { status: "error", reason: "Transcript collection was interrupted by an extension background restart.", collectedAt: new Date().toISOString(), segments: [] };
      try {
        await persistTranscriptOutcome(interrupted, state.currentItem, outcome);
        interrupted.counts.error++;
        interrupted.completed++;
      } catch (error) {
        console.warn("Couldn't record interrupted transcript item", error);
      }
    }
    reportQueue(interrupted, { status: "error", message: "Transcript collection was interrupted. Completed results were kept; start again to collect remaining videos." });
    await clearQueueState();
  } catch (error) {
    console.warn("Couldn't recover interrupted transcript collection", error);
  } finally {
    recoveringPlaylistTranscriptQueue = false;
  }
}

recoverInterruptedPlaylistTranscriptQueue();

function queueSnapshot(queue, extra = {}) {
  return {
    type: "sc_playlist_transcript_progress",
    playlistId: queue.playlist.id,
    completed: queue.completed,
    total: queue.items.length,
    completeCount: queue.counts.complete,
    noTranscriptCount: queue.counts["no-transcript"],
    errorCount: queue.counts.error,
    stoppedCount: queue.counts.stopped,
    status: queue.cancelled ? "stopped" : queue.completed >= queue.items.length ? "complete" : "running",
    ...extra,
  };
}

function reportQueue(queue, extra) {
  if (queue?.originTabId == null) return;
  chrome.tabs.sendMessage(queue.originTabId, queueSnapshot(queue, extra)).catch(() => {});
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Video page load timed out")), timeoutMs);
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") finish();
    };
    const finish = (error) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      error ? reject(error) : resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
    // A tiny page can finish between tabs.create() and listener registration.
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch(() => finish(new Error("Video tab closed before transcript collection started")));
  });
}

async function requestTranscriptFromTab(tabId) {
  let lastError = null;
  for (let attempt = 0; attempt < TRANSCRIPT_MESSAGE_RETRIES; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Transcript request timed out")), TRANSCRIPT_RESPONSE_TIMEOUT_MS);
        chrome.tabs.sendMessage(tabId, { type: "sc_collect_transcript" }).then(
          (response) => {
            clearTimeout(timer);
            resolve(response);
          },
          (error) => {
            clearTimeout(timer);
            reject(error);
          },
        );
      });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError || new Error("Transcript content script did not respond");
}

async function persistTranscriptOutcome(queue, item, outcome) {
  // Callers await this from outside the writer chain. Keeping the entire
  // read/merge/write operation here makes outcomes serial with queue setup,
  // API metadata, and explicit export snapshots.
  return serializePlaylistBackupWrite(async () => {
    const key = `sc_playlist_backup_${queue.playlist.id}`;
    const stored = await storageGet([key]);
    const backup = stored[key] || {
      format: queue.playlist.format || "social-companion-playlist-backup",
      schemaVersion: queue.playlist.schemaVersion || 1,
      ...queue.playlist,
      items: queue.items,
    };
    const itemKey = item.videoId || `${item.position}:${item.title}`;
    const items = (backup.items || queue.items).map((candidate) => {
      const candidateKey = candidate.videoId || `${candidate.position}:${candidate.title}`;
      return candidateKey === itemKey
        ? { ...candidate, transcriptCollection: outcome }
        : candidate;
    });
    await storageSet({
      [key]: {
        ...backup,
        items,
        transcriptCollectionUpdatedAt: new Date().toISOString(),
      },
    });
  });
}

async function initializePlaylistTranscriptBackup(queue) {
  return serializePlaylistBackupWrite(async () => {
    const key = `sc_playlist_backup_${queue.playlist.id}`;
    const stored = await storageGet([key]);
    const previousBackup = stored[key] || {};
    const previousByKey = new Map((previousBackup.items || []).map((item) => [item.videoId || `${item.position}:${item.title}`, item]));
    queue.items = queue.items.map((item) => {
      const previous = previousByKey.get(item.videoId || `${item.position}:${item.title}`);
      return previous?.transcriptCollection
        ? { ...previous, ...item, transcriptCollection: previous.transcriptCollection }
        : { ...previous, ...item };
    });
    await storageSet({
      [key]: {
        ...previousBackup,
        format: queue.playlist.format || "social-companion-playlist-backup",
        schemaVersion: queue.playlist.schemaVersion || 1,
        ...queue.playlist,
        exportedAt: new Date().toISOString(),
        items: queue.items,
      },
    });
  });
}

async function runPlaylistTranscriptQueue(queue) {
  reportQueue(queue, { message: "Starting transcript collection…" });
  for (let index = 0; index < queue.items.length; index++) {
    const item = queue.items[index];
    if (queue.cancelled) break;
    let createdTabId = null;
    let outcome;
    queue.currentIndex = index;
    queue.nextIndex = index;
    await persistQueueState(queue).catch((error) => console.warn("Couldn't checkpoint transcript queue", error));
    if (!item.videoId || item.unavailable) {
      outcome = { status: "no-transcript", reason: "Unavailable video has no playable YouTube page.", collectedAt: new Date().toISOString(), segments: [] };
    } else {
      try {
        const tab = await chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`, active: false });
        createdTabId = tab.id;
        queue.ownedTabId = createdTabId;
        await persistQueueState(queue).catch((error) => console.warn("Couldn't save transcript tab ownership", error));
        await waitForTabComplete(createdTabId, TRANSCRIPT_TAB_LOAD_TIMEOUT_MS);
        if (queue.cancelled) {
          outcome = { status: "stopped", reason: "Stopped before transcript collection finished.", collectedAt: new Date().toISOString(), segments: [] };
        } else {
          const response = await requestTranscriptFromTab(createdTabId);
          outcome = {
            status: ["complete", "no-transcript", "error"].includes(response?.status) ? response.status : "error",
            reason: response?.reason || "No caption tracks were exposed by YouTube.",
            collectedAt: new Date().toISOString(),
            segments: Array.isArray(response?.segments) ? response.segments : [],
          };
          if (queue.cancelled) {
            outcome = { status: "stopped", reason: "Stopped before transcript collection finished.", collectedAt: new Date().toISOString(), segments: [] };
          }
        }
      } catch (error) {
        outcome = { status: queue.cancelled ? "stopped" : "error", reason: error?.message || "Transcript collection failed.", collectedAt: new Date().toISOString(), segments: [] };
      } finally {
        if (createdTabId) await chrome.tabs.remove(createdTabId).catch(() => {});
        queue.ownedTabId = null;
      }
    }
    try {
      await persistTranscriptOutcome(queue, item, outcome);
    } catch (error) {
      outcome = { status: "error", reason: `Couldn't save this transcript locally: ${error?.message || "storage quota or permission error"}`, collectedAt: new Date().toISOString(), segments: [] };
      try {
        await persistTranscriptOutcome(queue, item, outcome);
      } catch (retryError) {
        console.warn("Couldn't persist playlist transcript outcome", retryError);
      }
    }
    queue.completed++;
    queue.counts[outcome.status] = (queue.counts[outcome.status] || 0) + 1;
    // Current item and next cursor are committed together before another item
    // starts; recovery only considers a non-null current item in-flight.
    queue.currentIndex = null;
    queue.nextIndex = index + 1;
    await persistQueueState(queue).catch((error) => console.warn("Couldn't checkpoint transcript queue", error));
    const outcomeDetail = outcome.status === "complete" ? "collected" : `${outcome.status}: ${outcome.reason}`;
    reportQueue(queue, { message: `${queue.completed}/${queue.items.length}: ${item.title || item.videoId} — ${outcomeDetail}` });
  }

  if (queue.cancelled && queue.completed < queue.items.length) {
    for (let index = queue.completed; index < queue.items.length; index++) {
      const item = queue.items[index];
      const outcome = { status: "stopped", reason: "Stopped by user before this video was opened.", collectedAt: new Date().toISOString(), segments: [] };
      try {
        await persistTranscriptOutcome(queue, item, outcome);
      } catch (error) {
        console.warn("Couldn't persist stopped playlist transcript outcome", error);
      }
      queue.completed++;
      queue.counts.stopped++;
      queue.currentIndex = null;
      queue.nextIndex = index + 1;
      await persistQueueState(queue).catch((error) => console.warn("Couldn't checkpoint transcript queue", error));
      reportQueue(queue, { message: "Transcript collection stopped." });
    }
  }
  reportQueue(queue, { message: queue.cancelled ? "Transcript collection stopped." : "Transcript collection finished." });
  playlistTranscriptQueue = null;
  await clearQueueState().catch((error) => console.warn("Couldn't clear transcript queue checkpoint", error));
}

// Tab-scrape: open a URL in a new tab, inject scraper, return results
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "sc_playlist_transcript_queue_start") {
    if (playlistTranscriptQueue || recoveringPlaylistTranscriptQueue) {
      sendResponse({ ok: false, reason: "A playlist transcript collection is already running." });
      return;
    }
    const playlist = msg.playlist;
    const items = Array.isArray(msg.items) ? msg.items : [];
    if (!playlist?.id || !items.length || !sender.tab?.id) {
      sendResponse({ ok: false, reason: "Open a playlist with collected videos before starting transcript collection." });
      return;
    }
    playlistTranscriptQueue = {
      playlist,
      items: items.map((item) => ({ ...item })),
      originTabId: sender.tab.id,
      completed: 0,
      currentIndex: null,
      nextIndex: 0,
      cancelled: false,
      counts: { complete: 0, "no-transcript": 0, error: 0, stopped: 0 },
    };
    // Claim durable ownership before any initializer awaits storage, so another
    // tab's optional API flow immediately observes that this backup is locked.
    persistQueueState(playlistTranscriptQueue).then(() => initializePlaylistTranscriptBackup(playlistTranscriptQueue)).then(() => {
      sendResponse({ ok: true, total: playlistTranscriptQueue.items.length });
      runPlaylistTranscriptQueue(playlistTranscriptQueue).catch((error) => {
        console.error("Playlist transcript queue failed", error);
        if (playlistTranscriptQueue) {
          reportQueue(playlistTranscriptQueue, { message: `Transcript collection failed: ${error.message}`, status: "error" });
          playlistTranscriptQueue = null;
        }
      });
    }).catch((error) => {
      console.error("Couldn't claim or initialize playlist transcript backup", error);
      playlistTranscriptQueue = null;
      sendResponse({ ok: false, reason: `Couldn't prepare playlist backup: ${error.message}` });
    });
    return true;
  }

  if (msg.type === "sc_save_playlist_api_backup") {
    serializePlaylistBackupWrite(async () => {
      const playlist = msg.playlist;
      const apiItems = Array.isArray(msg.items) ? msg.items : [];
      if (!playlist?.id || !apiItems.length) {
        return { ok: false, reason: "Playlist API backup data is incomplete." };
      }
      const state = await storageGet([PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY]);
      if (playlistTranscriptQueue?.playlist?.id === playlist.id || state[PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY]?.playlist?.id === playlist.id) {
        return { ok: false, reason: "Transcript collection is running for this playlist; API metadata was not saved." };
      }
      const key = `sc_playlist_backup_${playlist.id}`;
      const stored = await storageGet([key]);
      const previousBackup = stored[key] || {};
      const previousByKey = new Map((previousBackup.items || []).map((item) => [item.videoId || `${item.position}:${item.title}`, item]));
      const items = apiItems.map((item) => {
        const previous = previousByKey.get(item.videoId || `${item.position}:${item.title}`);
        return previous?.transcriptCollection ? { ...item, transcriptCollection: previous.transcriptCollection } : item;
      });
      await storageSet({
        [key]: {
          ...previousBackup,
          format: playlist.format || "social-companion-playlist-backup",
          schemaVersion: playlist.schemaVersion || 1,
          ...playlist,
          exportedAt: new Date().toISOString(),
          source: "youtube-data-api",
          items,
        },
      });
      return { ok: true, items };
    }).then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error?.message || "Couldn't save API playlist metadata." }));
    return true;
  }

  if (msg.type === "sc_save_playlist_export_backup") {
    serializePlaylistBackupWrite(async () => {
      const playlist = msg.playlist;
      const snapshotItems = Array.isArray(msg.items) ? msg.items : [];
      if (!playlist?.id || !snapshotItems.length) {
        return { ok: false, reason: "Playlist export snapshot is incomplete.", items: [] };
      }
      const key = `sc_playlist_backup_${playlist.id}`;
      const state = await storageGet([PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY, key]);
      const existingBackup = state[key] || {};
      if (playlistTranscriptQueue?.playlist?.id === playlist.id || state[PLAYLIST_TRANSCRIPT_QUEUE_STATE_KEY]?.playlist?.id === playlist.id) {
        return {
          ok: false,
          reason: "Transcript collection owns this playlist backup; exporting its saved progress instead.",
          items: existingBackup.items || [],
        };
      }
      const previousByKey = new Map((existingBackup.items || []).map((item) => [item.videoId || `${item.position}:${item.title}`, item]));
      const items = snapshotItems.map((item) => {
        const previous = previousByKey.get(item.videoId || `${item.position}:${item.title}`);
        return previous?.transcriptCollection
          ? { ...previous, ...item, transcriptCollection: previous.transcriptCollection }
          : { ...previous, ...item };
      });
      await storageSet({
        [key]: {
          ...existingBackup,
          format: playlist.format || "social-companion-playlist-backup",
          schemaVersion: playlist.schemaVersion || 1,
          ...playlist,
          exportedAt: new Date().toISOString(),
          items,
        },
      });
      return { ok: true, items };
    }).then(sendResponse).catch((error) => sendResponse({ ok: false, reason: error?.message || "Couldn't save playlist export snapshot.", items: [] }));
    return true;
  }

  if (msg.type === "sc_list_playlist_backups") {
    chrome.storage.local.get(null, (data) => {
      const backups = [];
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith("sc_playlist_backup_") && value && value.items) {
          backups.push({
            playlistId: key.replace("sc_playlist_backup_", ""),
            playlistTitle: value.playlistTitle || key.replace("sc_playlist_backup_", ""),
            videoCount: value.items.length,
            exportedAt: value.exportedAt,
            hasTranscripts: value.items.some((i) => i.transcriptCollection && i.transcriptCollection.status === "complete"),
            source: value.source || "scraped",
            items: value.items,
          });
        }
      }
      sendResponse({ ok: true, backups });
    });
    return true;
  }

  if (msg.type === "sc_playlist_transcript_queue_stop") {
    if (!playlistTranscriptQueue || playlistTranscriptQueue.originTabId !== sender.tab?.id) {
      sendResponse({ ok: false, reason: "No transcript collection is running in this playlist tab." });
      return;
    }
    playlistTranscriptQueue.cancelled = true;
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "cd_scrape_tab") {
    (async () => {
      try {
        const tab = await chrome.tabs.create({ url: msg.url, active: false });
        // Wait for tab to finish loading
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("tab load timeout")),
            20000,
          );
          const listener = (tabId, info) => {
            if (tabId === tab.id && info.status === "complete") {
              clearTimeout(timer);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });

        // Small extra wait for AMP rendering
        await new Promise((r) => setTimeout(r, 2000));

        // Inject scraper into the tab
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const words = [];
            const seen = new Set();
            document
              .querySelectorAll("li.wordlistentry-row")
              .forEach((entry) => {
                const id = entry.dataset.wordId || "";
                const phraseEl = entry.querySelector("a .phrase");
                const word = (phraseEl?.textContent || "")
                  .replace(/\s+/g, " ")
                  .trim();
                if (!word) return;
                const pos = (
                  entry.querySelector("a .pos")?.textContent || ""
                ).trim();
                const gcSpans = entry.querySelectorAll("a .gram .gc");
                const grammar =
                  gcSpans.length === 1
                    ? gcSpans[0].textContent.trim()
                    : gcSpans.length > 1
                      ? [...gcSpans]
                          .map((s) => s.textContent.trim())
                          .join(" or ")
                      : "";
                const usage = [...entry.querySelectorAll("a .usage, a .dusage")]
                  .map((e) => e.textContent.trim())
                  .filter(Boolean)
                  .join(", ");
                const domain = [
                  ...entry.querySelectorAll("a .domain, a .ddomain"),
                ]
                  .map((e) => e.textContent.trim())
                  .filter(Boolean)
                  .join(", ");
                const cefr = (
                  entry.querySelector("a .epp-xref, a .dxref")?.textContent ||
                  ""
                ).trim();
                const definition = (
                  entry.querySelector(".def")?.textContent || ""
                ).trim();
                const dictionary = (
                  entry.querySelector(".h6, .lm-0")?.textContent || ""
                ).trim();
                const key = id + "-" + word;
                if (seen.has(key)) return;
                seen.add(key);
                words.push({
                  word,
                  pos,
                  grammar,
                  usage,
                  domain,
                  cefr,
                  definition,
                  dictionary,
                  id,
                });
              });
            return words;
          },
        });

        // Close the tab
        await chrome.tabs.remove(tab.id);

        sendResponse({ words: results?.[0]?.result || [] });
      } catch (e) {
        sendResponse({ words: [], error: e.message });
      }
    })();
    return true; // async sendResponse
  }
});
