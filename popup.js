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
    } else {
      titleEl.textContent = response.title || 'Current YouTube video';
      metaEl.textContent = response.transcriptAvailable ? 'Transcript is ready locally.' : 'Transcript not saved yet — Sync it in the page widget.';
    }
  } catch {
    const tab = await activeTab().catch(() => null);
    activeTabId = tab?.id ?? null;
    titleEl.textContent = tab?.title || 'Active page';
    metaEl.textContent = 'Copy selected text or a short page context, then choose where to use it.';
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
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (limit) => ({ title: document.title, url: location.href, selection: window.getSelection()?.toString().trim() || '', text: document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, limit) || '' }),
      args: [pageContextLimit()],
    });
    const page = result?.[0]?.result;
    if (!page) throw new Error('This page did not expose readable context.');
    const body = page.selection || page.text;
    if (!body) throw new Error('Select text or open a readable page first.');
    const request = String(instruction || '').trim();
    const prefix = request ? `Request: ${request}\n\n` : '';
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
  const provider = document.getElementById('chatProvider').value;
  const autoSubmit = document.getElementById('sendAutomatically').checked;
  setStatus(`Opening ${provider}…`);
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_prompt', provider, prompt, autoSubmit });
  if (!response?.ok) setStatus(response?.reason || `Could not open ${provider}.`, 'error');
  else setStatus(response.submitted ? `Sent in ${provider}.` : `Prompt inserted in ${provider}; send it when ready.`, 'success');
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

refreshStatus();
