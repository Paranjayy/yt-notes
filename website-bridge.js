(() => {
  'use strict';

  // Narrow bridge for our own web client only. The page can ask to perform an
  // explicit provider handoff, but it never receives account/session data.
  const MAX_PROMPT_LENGTH = 250000;
  const PROVIDERS = new Set(['chatgpt', 'gemini', 'claude', 'grok']);

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.type !== 'sc_website_provider_prompt' || typeof message.requestId !== 'string') return;
    const providers = [...new Set(Array.isArray(message.providers) ? message.providers : [])].filter((provider) => PROVIDERS.has(provider));
    const prompt = typeof message.prompt === 'string' ? message.prompt : '';
    let response;
    if (!providers.length) response = { ok: false, reason: 'Choose at least one supported AI provider.' };
    else if (!prompt.trim()) response = { ok: false, reason: 'There is no prompt to send.' };
    else if (prompt.length > MAX_PROMPT_LENGTH) response = { ok: false, reason: `This prompt is over the ${MAX_PROMPT_LENGTH.toLocaleString()} character bridge limit. Download or copy it instead.` };
    else {
      try {
        response = await chrome.runtime.sendMessage({
          type: 'sc_provider_prompt_batch',
          providers,
          prompt,
          autoSubmit: Boolean(message.autoSubmit),
          startNewChat: Boolean(message.startNewChat),
        });
      } catch (error) {
        response = { ok: false, reason: error?.message || 'The extension could not contact its provider bridge.' };
      }
    }
    window.postMessage({ type: 'sc_website_provider_result', requestId: message.requestId, response }, location.origin);
  });
})();
