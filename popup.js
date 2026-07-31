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
  const providers = Array.from(document.querySelectorAll('[data-provider-target]:checked')).map((input) => input.dataset.providerTarget);
  if (!providers.length) return setStatus('Choose at least one AI target.', 'error');
  const autoSubmit = document.getElementById('sendAutomatically').checked;
  const startNewChat = document.getElementById('startNewChat').checked;
  setStatus(`Opening ${providers.join(', ')}…`);
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_prompt_batch', providers, prompt, autoSubmit, startNewChat });
  if (!response?.ok) setStatus(response?.reason || 'Could not open the selected AI targets.', 'error');
  else setStatus(response.sent ? `Sent to ${response.sent} AI target${response.sent === 1 ? '' : 's'}.` : `Prompt inserted into ${response.inserted} AI target${response.inserted === 1 ? '' : 's'}.`, 'success');
}

async function rerunPrompt(record) {
  document.querySelectorAll('[data-provider-target]').forEach((input) => { input.checked = input.dataset.providerTarget === record.provider; });
  setStatus(`Reopening ${record.provider}…`);
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_prompt', provider: record.provider, prompt: record.prompt, autoSubmit: document.getElementById('sendAutomatically').checked, startNewChat: document.getElementById('startNewChat').checked });
  if (!response?.ok) setStatus(response?.reason || `Could not open ${record.provider}.`, 'error');
  else setStatus(response.submitted ? `Sent in ${record.provider}.` : `Prompt inserted in ${record.provider}; send it when ready.`, 'success');
}

async function readProviderReply() {
  setStatus('Reading the newest visible provider reply…');
  const response = await chrome.runtime.sendMessage({ type: 'sc_provider_read_reply' });
  if (!response?.ok) return setStatus(response?.reason || 'No provider reply is available yet.', 'error');
  document.getElementById('replyCard').hidden = false;
  document.getElementById('providerReply').textContent = response.text;
  setStatus(`Read latest ${response.provider} reply.`, 'success');
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
document.getElementById('copyPageContext').addEventListener('click', copyActivePageContext);
document.getElementById('openChatGPT').addEventListener('click', async () => {
  if (await copyActivePageContext()) chrome.tabs.create({ url: 'https://chatgpt.com/' });
});
document.getElementById('readProviderReply').addEventListener('click', readProviderReply);
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
renderPromptHistory();
renderRecipes();
