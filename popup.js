'use strict';

const statusEl = document.getElementById('status');
const titleEl = document.getElementById('pageTitle');
const metaEl = document.getElementById('pageMeta');
let activeTabId = null;

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
      return;
    }
    titleEl.textContent = response.title || 'Current YouTube video';
    metaEl.textContent = response.transcriptAvailable ? 'Transcript is ready locally.' : 'Transcript not saved yet — Sync it in the page widget.';
  } catch {
    titleEl.textContent = 'Page capture unavailable';
    metaEl.textContent = 'Open a YouTube video, then reopen this popup.';
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
document.getElementById('openArchive').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));

refreshStatus();
