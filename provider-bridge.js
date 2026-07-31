'use strict';

// Only handles a user-triggered draft/submit. It does not inspect account data,
// cookies, storage, prior chats, or network traffic.
(() => {
  const provider = location.hostname === 'chatgpt.com' ? 'chatgpt'
    : location.hostname === 'gemini.google.com' ? 'gemini'
      : location.hostname === 'claude.ai' ? 'claude'
        : location.hostname === 'grok.com' ? 'grok' : '';
  const composers = {
    chatgpt: ['#prompt-textarea', 'textarea[placeholder*="Message"]', '[contenteditable="true"][data-lexical-editor="true"]'],
    gemini: ['rich-textarea [contenteditable="true"]', '[contenteditable="true"][aria-label*="Enter a prompt"]', '[contenteditable="true"]'],
    claude: ['[contenteditable="true"][data-placeholder]', 'div[contenteditable="true"]', 'textarea'],
    grok: ['textarea', '[contenteditable="true"]'],
  };
  const sendButtons = {
    chatgpt: ['[data-testid="send-button"]', 'button[aria-label*="Send"]'],
    gemini: ['button[aria-label*="Send"]', 'button[aria-label*="Submit"]'],
    claude: ['button[aria-label*="Send"]', 'button[type="submit"]'],
    grok: ['button[aria-label*="Send"]', 'button[type="submit"]'],
  };
  function visible(selectors) {
    return selectors.map((selector) => document.querySelector(selector)).find((element) => element && element.getClientRects().length);
  }
  function write(composer, prompt) {
    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(composer), 'value')?.set;
      setter ? setter.call(composer, prompt) : composer.value = prompt;
    } else {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, prompt);
      if (!composer.textContent?.trim()) composer.textContent = prompt;
    }
    composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'sc_insert_provider_prompt' || message.provider !== provider) return;
    try {
      const composer = visible(composers[provider] || []);
      if (!composer) return sendResponse({ ok: false, reason: `Could not find the ${provider} composer. Sign in and open a new chat first.` });
      write(composer, String(message.prompt || ''));
      const button = message.autoSubmit ? visible(sendButtons[provider] || []) : null;
      if (button) button.click();
      sendResponse({ ok: true, submitted: Boolean(button) });
    } catch (error) {
      sendResponse({ ok: false, reason: error?.message || `Could not write into ${provider}.` });
    }
  });
})();
