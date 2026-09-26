// Social Companion — X/Twitter capture (x.com/<handle> + /status/<id>)
// Thread/post reader. Route-gated to public post + profile surfaces only —
// home, explore, search, messages, and settings are never captured.

(function () {
  "use strict";

  const H = window.TwitterHelpers || {};
  const parseRoute = H.parseXRoute || (() => ({ kind: "", handle: "", statusId: "" }));

  let currentKey = "";
  let tweets = [];
  let profile = null;
  let txStatus = { status: "idle", message: "Waiting…", updatedAt: "" };
  let _observer = null;

  function setStatus(status, message) {
    txStatus = { status, message, updatedAt: new Date().toISOString() };
    const badge = document.getElementById("sc-x-status");
    const palette = { ready: "#34d399", waiting: "#fbbf24", unavailable: "#94a3b8", error: "#fb7185", idle: "#94a3b8" };
    if (badge) {
      const color = palette[status] || "#94a3b8";
      badge.textContent = status === "ready" ? `${tweets.length} posts` : message.slice(0, 32);
      badge.style.color = color;
      badge.style.borderColor = `${color}66`;
    }
    const meta = document.getElementById("sc-x-meta");
    if (meta && currentKey) meta.textContent = message;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Page-level toast for copy/download receipts. */
  function scToast(msg, ms = 2600) {
    try {
      let t = document.getElementById("sc-x-toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "sc-x-toast";
        t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(10,10,14,.96);color:#fff;padding:10px 18px;border-radius:10px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:2147483647;border:1px solid rgba(255,255,255,.25);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;";
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = "1";
      clearTimeout(t._timer);
      t._timer = setTimeout(() => {
        t.style.opacity = "0";
      }, ms);
    } catch {}
  }

  function timelineRoot() {
    return document.querySelector('main [data-testid="primaryColumn"]') || document.querySelector("main") || document.body;
  }

  function scrollContainerOf(el) {
    let node = el?.parentElement || null;
    while (node && node !== document.body && node !== document.documentElement) {
      try {
        const style = getComputedStyle(node);
        if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 20) {
          return node;
        }
      } catch {}
      node = node.parentElement;
    }
    return document.scrollingElement || null;
  }

  function snapshotVisible() {
    const scrape = H.scrapeVisibleTweets || (() => []);
    const prof = H.scrapeProfileHeader || (() => null);
    return { tweets: scrape(timelineRoot()), profile: prof(document) };
  }

  /** Step-scroll the timeline until the post count stabilizes. */
  async function autoScrollTimeline(key, maxPasses = 30) {
    const scroller = scrollContainerOf(timelineRoot());
    if (!scroller) return snapshotVisible().tweets;
    let lastCount = -1;
    let stale = 0;
    for (let pass = 0; pass < maxPasses; pass++) {
      if (parseRoute(location.href).kind === "" || routeKey() !== key) break;
      scroller.scrollTop = scroller.scrollHeight;
      await sleep(600);
      const n = snapshotVisible().tweets.length;
      if (n === lastCount) {
        stale++;
        if (stale >= 3) break;
      } else {
        stale = 0;
        lastCount = n;
      }
    }
    try {
      scroller.scrollTop = 0;
    } catch {}
    return snapshotVisible().tweets;
  }

  function routeKey() {
    const r = parseRoute(location.href);
    if (r.kind === "post") return `post:${r.statusId}`;
    if (r.kind === "profile") return `profile:${r.handle}`;
    return "";
  }

  function watchTimeline(key) {
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    const stopAfter = setTimeout(() => {
      if (_observer) {
        _observer.disconnect();
        _observer = null;
      }
    }, 90000);
    _observer = new MutationObserver(() => {
      if (routeKey() !== key) {
        clearTimeout(stopAfter);
        if (_observer) {
          _observer.disconnect();
          _observer = null;
        }
        return;
      }
      const snap = snapshotVisible();
      if (snap.tweets.length > tweets.length) {
        tweets = snap.tweets;
        profile = snap.profile || profile;
        setStatus("ready", `Captured ${tweets.length} visible posts.`);
        renderPreview();
      }
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  async function capture({ scroll = false } = {}) {
    const r = parseRoute(location.href);
    if (!r.kind) throw new Error("Open an X post or profile first.");
    r.url = location.href;
    setStatus("waiting", scroll ? "Reading posts (scrolling timeline)…" : "Reading visible posts…");
    const snap = scroll
      ? { tweets: await autoScrollTimeline(routeKey()), profile: snapshotVisible().profile }
      : snapshotVisible();
    if (routeKey() !== (r.kind === "post" ? `post:${r.statusId}` : `profile:${r.handle}`)) {
      throw new Error("Navigated away mid-capture.");
    }
    tweets = snap.tweets;
    profile = snap.profile;
    if (!tweets.length) {
      setStatus("unavailable", "No posts rendered — scroll the timeline, then Capture again.");
    } else {
      setStatus("ready", `Captured ${tweets.length} visible posts.`);
    }
    renderPreview();
    const md = (H.buildXMarkdown || (() => ""))({ route: r, profile, tweets, capturedAt: new Date().toISOString() });
    return { route: r, markdown: md };
  }

  function renderPreview() {
    const box = document.getElementById("sc-x-lines");
    if (!box) return;
    if (!tweets.length) {
      box.textContent = txStatus.message || "Not captured yet.";
      return;
    }
    box.innerHTML = "";
    for (const t of tweets.slice(0, 100)) {
      const row = document.createElement("div");
      row.style.cssText = "padding:6px 0;border-top:1px solid rgba(255,255,255,.08);";
      const head = document.createElement("div");
      head.style.cssText = "font-weight:700;font-size:12px;";
      head.textContent = `${t.author} (@${t.handle})${t.time ? ` · ${t.time}` : ""}`;
      const body = document.createElement("div");
      body.style.cssText = "font-size:12px;opacity:.9;margin-top:2px;white-space:pre-wrap;word-break:break-word;";
      body.textContent = (t.text || "_(media-only)_").slice(0, 400);
      const stats = document.createElement("div");
      stats.style.cssText = "font-size:11px;opacity:.6;margin-top:2px;";
      stats.textContent = `💬 ${t.replies || 0} · 🔁 ${t.reposts || 0} · ❤️ ${t.likes || 0}${t.views ? ` · 👁️ ${t.views}` : ""}${t.hasVideo ? " · 🎬" : ""}${t.hasPhoto ? " · 📷" : ""}`;
      row.append(head, body, stats);
      box.appendChild(row);
    }
    if (tweets.length > 100) {
      const more = document.createElement("div");
      more.style.opacity = "0.6";
      more.textContent = `… ${tweets.length - 100} more (use Download for all)`;
      box.appendChild(more);
    }
  }
  /** Local AI-DOM snapshot (low/high) — widget entry point to the cleaner. */
  async function copyAiSnapshot(mode = "low") {
    const cleanMode = mode === "high" ? "high" : "low";
    try {
      const root = document.querySelector("main") || document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll("#sc-x-widget, #sc-x-toast").forEach((el) => el.remove());
      const bytesBefore = clone.outerHTML.length;
      if (typeof window.stripDomNoise === "function") {
        window.stripDomNoise(clone, cleanMode);
      } else {
        clone.querySelectorAll("script, style, noscript, iframe").forEach((el) => el.remove());
      }
      const html = clone.outerHTML;
      const snapshot = {
        metadata: {
          timestamp: new Date().toISOString(),
          url: location.href,
          title: document.title,
          type: cleanMode === "high" ? "High-Density" : "Token-Optimized",
          mode: cleanMode,
          bytesBefore,
          bytesAfter: html.length,
        },
        stack: [],
        clean_dom: html,
      };
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      scToast(`🤖 ${cleanMode} snapshot copied (${html.length.toLocaleString()} chars).`);
    } catch (err) {
      scToast(`❌ Snapshot failed — ${err?.message || "retry"}.`);
    }
  }

  function downloadFile(filename, text, mime = "text/markdown") {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    // Single choke point: every widget + popup download toasts from here.
    scToast(`📥 Downloaded ${filename}.`);
  }

  function injectPanel() {
    if (document.getElementById("sc-x-widget")) return;
    const el = document.createElement("div");
    el.id = "sc-x-widget";
    el.style.cssText = "position:fixed;bottom:96px;right:24px;width:380px;max-height:540px;display:flex;flex-direction:column;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(10,10,12,.97);color:#f8fafc;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5);overflow:hidden;z-index:9999;";
    el.innerHTML = `
      <div data-sc-head style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:#16161c;border-bottom:1px solid rgba(255,255,255,.12);cursor:move;user-select:none;-webkit-user-select:none;">
        <strong style="font-size:13px;">𝕏 Post capture</strong>
        <span style="display:flex;align-items:center;gap:6px;">
          <span id="sc-x-status" style="font-size:11px;padding:3px 8px;border:1px solid #555;border-radius:999px;white-space:nowrap;">…</span>
          <button data-sc-min title="Collapse / expand" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:13px;line-height:1;cursor:pointer;">–</button>
          <button data-sc-hide title="Hide until navigation" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:12px;line-height:1;cursor:pointer;">×</button>
        </span>
      </div>
      <div data-sc-body style="display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:12px 14px;gap:8px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button id="sc-x-capture" style="padding:7px 11px;border-radius:8px;border:none;background:#e7e9ea;color:#000;font-weight:800;font-size:12px;cursor:pointer;">Capture posts</button>
          <button id="sc-x-copy" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Copy</button>
          <button id="sc-x-dl" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Download .md</button>
          <button id="sc-x-snap" title="Copy low-clean DOM snapshot" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">📸 DOM</button>
          <button id="sc-x-snap-high" title="Copy high-density DOM snapshot" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">📸 High</button>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:.06em;opacity:.6;margin-bottom:4px;">QUICK COPY</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button data-x-copy="text" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:11px;cursor:pointer;">Text only</button>
            <button data-x-copy="links" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:11px;cursor:pointer;">Links</button>
            <button data-x-copy="compact" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:11px;cursor:pointer;">Compact</button>
            <button data-x-copy="thread" title="Unroll same-author thread in reading order" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:11px;cursor:pointer;">🧵 Unroll</button>
          </div>
        </div>
        <div id="sc-x-meta" style="font-size:11px;opacity:.75;">…</div>
        <div id="sc-x-lines" style="max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-size:12px;">Not captured yet.</div>
        <div style="font-size:11px;opacity:.6;">Public posts only — no DMs, no private content. Scroll the timeline for more, then Capture again.</div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#sc-x-capture").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.textContent = "Capturing…";
      btn.disabled = true;
      try {
        await capture({ scroll: true });
      } catch (err) {
        setStatus("error", err?.message || "Capture failed.");
        renderPreview();
      } finally {
        btn.textContent = "Capture posts";
        btn.disabled = false;
      }
    };
    el.querySelector("#sc-x-copy").onclick = async () => {
      try {
        const { markdown } = await capture({ scroll: false });
        await navigator.clipboard.writeText(markdown);
        scToast(`📋 X capture copied (${tweets.length} posts).`);
      } catch (err) {
        setStatus("error", err?.message || "Copy failed.");
        scToast(`❌ Copy failed — ${err?.message || "try Download instead"}.`);
      }
    };
    el.querySelector("#sc-x-snap").onclick = () => copyAiSnapshot("low");
    el.querySelector("#sc-x-snap-high").onclick = () => copyAiSnapshot("high");
    el.querySelector("#sc-x-dl").onclick = async () => {
      try {
        const { route, markdown } = await capture({ scroll: false });
        const base = (`x-${route.handle}-${route.statusId || "posts"}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 100);
        downloadFile(`${base}.md`, markdown);
      } catch (err) {
        setStatus("error", err?.message || "Download failed.");
        scToast(`❌ Download failed — ${err?.message || "retry"}.`);
      }
    };
    el.querySelectorAll("[data-x-copy]").forEach((btn) => {
      btn.onclick = async () => {
        const format = btn.getAttribute("data-x-copy");
        try {
          if (!tweets.length) await capture({ scroll: format === "thread" });
          if (!tweets.length) {
            scToast("⚠️ Nothing captured yet — scroll, then Capture posts.");
            return;
          }
          const r = parseRoute(location.href);
          r.url = location.href;
          if (format === "thread") {
            const thread = (H.extractThread || ((ts) => ts))(tweets, r);
            if (thread.length <= 1) {
              scToast("🧵 Single post — no continuation found.");
              return;
            }
            const out = (H.buildThreadMarkdown || (() => ""))({ route: r, profile, thread, capturedAt: new Date().toISOString() });
            await navigator.clipboard.writeText(out);
            scToast(`🧵 Thread unrolled (${thread.length} posts).`);
            return;
          }
          const out = (H.buildXMarkdown || (() => ""))({ route: r, profile, tweets, capturedAt: new Date().toISOString(), format });
          await navigator.clipboard.writeText(out);
          scToast(`📋 Copied ${format} (${tweets.length} posts).`);
        } catch (err) {
          scToast(`❌ Copy failed — ${err?.message || "retry"}.`);
        }
      };
    });
    wireChrome(el);
    setStatus("idle", "Post surface detected.");
  }

  function wireChrome(el) {
    const head = el.querySelector("[data-sc-head]");
    const body = el.querySelector("[data-sc-body]");
    const minBtn = el.querySelector("[data-sc-min]");
    const hideBtn = el.querySelector("[data-sc-hide]");
    try {
      chrome.storage.local.get(["sc_x_widget_pos", "sc_x_widget_collapsed"], (data) => {
        const pos = data?.sc_x_widget_pos;
        if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
          el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, pos.left))}px`;
          el.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, pos.top))}px`;
          el.style.right = "auto";
          el.style.bottom = "auto";
        }
        if (data?.sc_x_widget_collapsed && body && minBtn) {
          body.style.display = "none";
          minBtn.textContent = "+";
        }
      });
    } catch {}
    if (minBtn && body) {
      minBtn.onclick = () => {
        const collapsed = body.style.display !== "none";
        body.style.display = collapsed ? "none" : "flex";
        minBtn.textContent = collapsed ? "+" : "–";
        try {
          chrome.storage.local.set({ sc_x_widget_collapsed: collapsed });
        } catch {}
      };
    }
    if (hideBtn) hideBtn.onclick = () => el.remove();
    if (!head) return;
    let drag = null;
    head.addEventListener("mousedown", (e) => {
      if (e.target.closest("[data-sc-min], [data-sc-hide]")) return;
      const rect = el.getBoundingClientRect();
      drag = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag || !document.body.contains(el)) {
        drag = null;
        return;
      }
      el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, e.clientX - drag.x))}px`;
      el.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, e.clientY - drag.y))}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
    });
    window.addEventListener("mouseup", () => {
      if (!drag) return;
      drag = null;
      try {
        const rect = el.getBoundingClientRect();
        chrome.storage.local.set({ sc_x_widget_pos: { left: Math.round(rect.left), top: Math.round(rect.top) } });
      } catch {}
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const r = parseRoute(location.href);
    if (!r.kind) return;
    if (message.type === "sc_get_capture_status") {
      sendResponse({
        ok: true,
        videoId: r.kind === "post" ? r.statusId : `@${r.handle}`,
        title: r.kind === "post" ? `Post by @${r.handle}` : `Posts by @${r.handle}`,
        transcriptAvailable: tweets.length > 0,
        platform: "x",
      });
      return;
    }
    if (message.type === "sc_get_current_markdown" || message.type === "sc_download_current_markdown" || message.type === "sc_download_current_transcript") {
      capture({ scroll: false }).then(({ route, markdown }) => {
        if (message.type === "sc_get_current_markdown") {
          sendResponse({ ok: true, markdown, title: `Post by @${route.handle}`, platform: "x" });
        } else {
          const base = (`x-${route.handle}-${route.statusId || "posts"}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 100);
          downloadFile(`${base}.md`, markdown);
          sendResponse({ ok: true });
        }
      }).catch((e) => sendResponse({ ok: false, reason: e?.message || "Couldn't capture these posts." }));
      return true;
    }
  });

  function onRouteChange() {
    const key = routeKey();
    if (!key) {
      currentKey = "";
      if (_observer) {
        _observer.disconnect();
        _observer = null;
      }
      document.getElementById("sc-x-widget")?.remove();
      return;
    }
    if (key !== currentKey) {
      currentKey = key;
      tweets = [];
      profile = null;
      injectPanel();
      setStatus("waiting", "Post surface detected. Auto-reading visible posts…");
      watchTimeline(key);
      setTimeout(async () => {
        if (routeKey() !== key || tweets.length) return;
        try {
          await capture({ scroll: false });
        } catch {
          if (routeKey() === key && !tweets.length) {
            setStatus("waiting", "Posts not rendered yet — they capture as they load, or press Capture.");
            renderPreview();
          }
        }
      }, 2000);
    }
  }

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onRouteChange();
    }
  }, 1200);
  onRouteChange();
})();
