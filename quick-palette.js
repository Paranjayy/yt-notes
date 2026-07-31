(() => {
  'use strict';

  const ROOT_ID = '__social_companion_quick_palette__';
  const existing = document.getElementById(ROOT_ID);
  if (existing) { existing.remove(); return; }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'position:fixed;z-index:2147483647;inset:0;display:grid;place-items:start center;padding-top:min(18vh,160px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
  const shadow = root.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host{all:initial} *{box-sizing:border-box}.veil{position:fixed;inset:0;background:rgba(5,4,10,.52);backdrop-filter:blur(3px)}.panel{position:relative;width:min(620px,calc(100vw - 28px));border:1px solid #4b416a;border-radius:16px;background:#16141f;color:#f5f3ff;box-shadow:0 24px 80px rgba(0,0,0,.52);padding:16px}.eyebrow{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#b9a4ff;font-weight:800}.heading{margin:5px 0 3px;font-size:19px;font-weight:760}.source{color:#aaa5bd;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.prompt{width:100%;min-height:100px;margin-top:14px;border:1px solid #413b53;border-radius:10px;background:#0f0e15;color:#f5f3ff;padding:10px;font:14px/1.42 inherit;resize:vertical}.prompt:focus{outline:2px solid #9271ff;outline-offset:1px}.row{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:10px}.target{border:1px solid #413b53;border-radius:999px;background:#242132;color:#ded9ec;padding:6px 9px;font-size:12px;cursor:pointer}.target:has(input:checked){border-color:#9b72ff;background:#34275d;color:#fff}.target input{accent-color:#9b72ff}.check{font-size:12px;color:#c7c0d6;display:flex;gap:5px;align-items:center}.spacer{flex:1}.run,.close{border:1px solid #4a4160;border-radius:9px;padding:9px 12px;font:700 13px inherit;cursor:pointer}.run{background:#9b72ff;border-color:#9b72ff;color:#180f2c}.close{background:#242132;color:#f5f3ff}.status{min-height:18px;margin-top:10px;color:#bdb6cb;font-size:12px}.status.good{color:#60dfb2}.status.bad{color:#ff9ba6}.hint{margin:10px 0 0;color:#8f899e;font-size:11px}.kbd{border:1px solid #484152;border-radius:4px;padding:1px 4px;color:#cfc9da}
    </style>
    <div class="veil"></div>
    <section class="panel" role="dialog" aria-modal="true" aria-label="Ask with Social Companion">
      <div class="eyebrow">Social Companion · active page</div>
      <div class="heading">Ask your signed-in AIs</div>
      <div class="source" id="source"></div>
      <textarea class="prompt" id="prompt" autofocus placeholder="What should the selected AI do with this context?"></textarea>
      <div class="row" aria-label="AI targets">
        <label class="target"><input type="checkbox" value="chatgpt" checked> ChatGPT</label>
        <label class="target"><input type="checkbox" value="gemini"> Gemini</label>
        <label class="target"><input type="checkbox" value="claude"> Claude</label>
        <label class="target"><input type="checkbox" value="grok"> Grok</label>
      </div>
      <div class="row"><label class="check"><input id="send" type="checkbox" checked> Send in my chat</label><label class="check"><input id="newChat" type="checkbox"> New chat</label><span class="spacer"></span><button class="close" id="close">Close</button><button class="run" id="run">Run selected AIs</button></div>
      <div class="status" id="status">Ready. The provider's own model picker and history stay in its tab.</div>
      <p class="hint">Uses your selection if present; otherwise a 12k-character page excerpt. <span class="kbd">Esc</span> closes.</p>
    </section>`;
  document.documentElement.append(root);

  const $ = (selector) => shadow.querySelector(selector);
  const selection = window.getSelection?.().toString().trim() || '';
  const readable = document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 12000) || '';
  const context = selection || readable;
  $('#source').textContent = `${selection ? 'Selection' : 'Page excerpt'} · ${document.title || location.hostname}`;
  const close = () => root.remove();
  $('#close').addEventListener('click', close);
  $('.veil').addEventListener('click', close);
  root.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
  setTimeout(() => $('#prompt').focus(), 0);

  $('#run').addEventListener('click', async () => {
    const instruction = $('#prompt').value.trim();
    const providers = Array.from(shadow.querySelectorAll('.target input:checked')).map((input) => input.value);
    const status = $('#status');
    if (!instruction) { status.textContent = 'Write an instruction first.'; status.className = 'status bad'; return; }
    if (!context) { status.textContent = 'This page did not expose readable text. Select text first.'; status.className = 'status bad'; return; }
    if (!providers.length) { status.textContent = 'Choose at least one AI target.'; status.className = 'status bad'; return; }
    const prompt = `Request: ${instruction}\n\nSource: ${document.title}\nURL: ${location.href}\n\n${context}`;
    status.textContent = `Opening ${providers.join(', ')}…`;
    status.className = 'status';
    $('#run').disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'sc_provider_prompt_batch', providers, prompt, autoSubmit: $('#send').checked, startNewChat: $('#newChat').checked });
      if (!response?.ok) throw new Error(response?.reason || 'No selected provider could receive the prompt.');
      const failed = (response.results || []).filter((result) => !result.ok).map((result) => result.provider);
      const count = (response.sent || response.inserted || 0);
      status.textContent = failed.length ? `Done for ${count}; ${failed.join(', ')} needs attention.` : `Done — ${response.sent ? 'sent' : 'inserted'} for ${count} provider${count === 1 ? '' : 's'}.`;
      status.className = `status ${failed.length ? 'bad' : 'good'}`;
    } catch (error) {
      status.textContent = error?.message || 'Could not send this prompt.';
      status.className = 'status bad';
    } finally { $('#run').disabled = false; }
  });
})();
