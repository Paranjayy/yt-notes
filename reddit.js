// Social Companion — Reddit capture (r/<sub> feed + comments/<id> thread)
// Attribute-first parsing of shreddit-* web components. Route-gated to
// public subreddit + post surfaces only — user pages, inbox, and settings
// are never captured.

(function () {
  "use strict";

  const H = window.RedditHelpers || {};
  const parseRoute = H.parseRedditRoute || (() => ({ kind: "", subreddit: "", postId: "" }));

  let currentKey = "";
  let posts = [];
  let comments = [];
  let header = null;
  let postCache = null;
  let rdStatus = { status: "idle", message: "Waiting…" };
  let _observer = null;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function scToast(msg, ms = 2600) {
    try {
      let t = document.getElementById("sc-reddit-toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "sc-reddit-toast";
        t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(12,12,16,.96);color:#fff;padding:10px 18px;border-radius:10px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:2147483647;border:1px solid rgba(255,69,0,.5);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;";
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

  function setStatus(status, message) {
    rdStatus = { status, message };
    const badge = document.getElementById("sc-rd-status");
    const palette = { ready: "#34d399", waiting: "#fbbf24", unavailable: "#94a3b8", error: "#fb7185", idle: "#94a3b8" };
    if (badge) {
      const color = palette[status] || "#94a3b8";
      const n = routeKind() === "post" ? comments.length : posts.length;
      badge.textContent = status === "ready" ? `${n} captured` : message.slice(0, 30);
      badge.style.color = color;
      badge.style.borderColor = `${color}66`;
    }
    const meta = document.getElementById("sc-rd-meta");
    if (meta && currentKey) meta.textContent = message;
  }

  function routeKind() {
    return parseRoute(location.href).kind;
  }

  function routeKey() {
    const r = parseRoute(location.href);
    if (r.kind === "post") return `post:${r.postId}`;
    if (r.kind === "subreddit") return `sub:${r.subreddit}`;
    return "";
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
    const scrapePosts = H.scrapeFeedPosts || (() => []);
    const scrapeHeader = H.scrapeSubredditHeader || (() => null);
    const scrapeCommentList = H.scrapeComments || (() => []);
    const r = parseRoute(location.href);
    return {
      posts: scrapePosts(document),
      comments: scrapeCommentList(document),
      header: scrapeHeader(document, r.subreddit),
    };
  }

  async function autoScrollToLoad(key, kind) {
    const scroller = scrollContainerOf(document.querySelector("main") || document.body);
    if (!scroller) return;
    let lastCount = -1;
    let stale = 0;
    for (let pass = 0; pass < 30; pass++) {
      if (routeKey() !== key) break;
      scroller.scrollTop = scroller.scrollHeight;
      await sleep(600);
      const snap = snapshotVisible();
      const n = kind === "post" ? snap.comments.length : snap.posts.length;
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
  }

  function watchThread(key) {
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
      const grew = routeKind() === "post"
        ? snap.comments.length > comments.length
        : snap.posts.length > posts.length;
      if (grew) {
        posts = snap.posts;
        comments = snap.comments;
        header = snap.header || header;
        setStatus("ready", `Captured ${routeKind() === "post" ? comments.length + " comments" : posts.length + " posts"}.`);
        renderPreview();
      }
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  function currentPostFact() {
    // Full-post facts: prefer the main post element, fall back to feed parse.
    let main = null;
    try {
      const els = Array.from(document.querySelectorAll("shreddit-post:not([slot])"));
      main = els.find((el) => {
        try {
          return !el.closest("shreddit-comment");
        } catch {
          return true;
        }
      }) || els[0] || null;
    } catch {
      main = null;
    }
    if (!main) return null;
    const scrape = H.scrapeFeedPost || (() => null);
    const p = scrape(main);
    if (!p) return null;
    const body = (H.extractPostBody || (() => ""))(main);
    const media = (H.collectRedditMedia || (() => []))(main);
    // The card attribute is the canonical media link when present.
    if (p.contentHref && !media.includes(p.contentHref.split("?")[0])) {
      media.unshift(p.contentHref.split("?")[0]);
    }
    return { ...p, body, media };
  }

  async function capture({ scroll = false } = {}) {
    const r = parseRoute(location.href);
    if (!r.kind) throw new Error("Open a subreddit or post first.");
    setStatus("waiting", scroll ? "Reading (scrolling to load more)…" : "Reading visible content…");
    if (scroll) await autoScrollToLoad(routeKey(), r.kind);
    if (routeKey() !== (r.kind === "post" ? `post:${r.postId}` : `sub:${r.subreddit}`)) {
      throw new Error("Navigated away mid-capture.");
    }
    const snap = snapshotVisible();
    posts = snap.posts;
    comments = snap.comments;
    header = snap.header;
    postCache = r.kind === "post" ? currentPostFact() : null;
    const n = r.kind === "post" ? comments.length : posts.length;
    if (!n && r.kind === "post" && !postCache) {
      setStatus("unavailable", "No post/comments rendered — scroll the thread, then Capture again.");
    } else {
      setStatus("ready", r.kind === "post" ? `Captured post + ${comments.length} comments.` : `Captured ${posts.length} posts.`);
    }
    renderPreview();
    const md = (H.buildRedditMarkdown || (() => ""))({ route: r, header, posts, comments, post: postCache, capturedAt: new Date().toISOString() });
    return { route: r, markdown: md };
  }

  function renderPreview() {
    const box = document.getElementById("sc-rd-lines");
    if (!box) return;
    const kind = routeKind();
    const list = kind === "post" ? comments : posts;
    if (!list.length) {
      box.textContent = rdStatus.message || "Not captured yet.";
      return;
    }
    box.innerHTML = "";
    if (kind === "post") {
      if (postCache) {
        const head = document.createElement("div");
        head.style.cssText = "font-weight:700;font-size:12px;margin-bottom:4px;";
        head.textContent = postCache.title;
        box.appendChild(head);
      }
      for (const c of list.slice(0, 100)) {
        const row = document.createElement("div");
        row.style.cssText = `padding:5px 0 5px ${Math.min(c.depth, 6) * 10}px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;`;
        const head = document.createElement("div");
        head.style.fontWeight = "700";
        head.textContent = `u/${c.author} (⬆️ ${c.score || "?"})`;
        const body = document.createElement("div");
        body.style.opacity = "0.9";
        body.textContent = (c.body || "_(no text)_").slice(0, 300);
        row.append(head, body);
        box.appendChild(row);
      }
    } else {
      for (const p of list.slice(0, 100)) {
        const row = document.createElement("div");
        row.style.cssText = "padding:5px 0;border-top:1px solid rgba(255,255,255,.08);font-size:12px;";
        row.textContent = `${p.position}. ${p.title} — u/${p.author || "?"} (⬆️ ${p.score || 0} · 💬 ${p.comments || 0})`;
        box.appendChild(row);
      }
    }
    if (list.length > 100) {
      const more = document.createElement("div");
      more.style.opacity = "0.6";
      more.textContent = `… ${list.length - 100} more (use Download for all)`;
      box.appendChild(more);
    }
  }

  /** Local AI-DOM snapshot (low/high) — widget entry point to the cleaner. */
  async function copyAiSnapshot(mode = "low") {
    const cleanMode = mode === "high" ? "high" : "low";
    try {
      const root = document.querySelector("main") || document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll("#sc-rd-widget, #sc-reddit-toast").forEach((el) => el.remove());
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
    scToast(`📥 Downloaded ${filename}.`);
  }

  function injectPanel() {
    if (document.getElementById("sc-rd-widget")) return;
    const el = document.createElement("div");
    el.id = "sc-rd-widget";
    el.style.cssText = "position:fixed;bottom:96px;right:24px;width:380px;max-height:540px;display:flex;flex-direction:column;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(12,12,16,.97);color:#f8fafc;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5);overflow:hidden;z-index:9999;";
    el.innerHTML = `
      <div data-sc-head style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:#1c1c22;border-bottom:1px solid rgba(255,69,0,.35);cursor:move;user-select:none;-webkit-user-select:none;">
        <strong style="font-size:13px;">🤖 Reddit capture</strong>
        <span style="display:flex;align-items:center;gap:6px;">
          <span id="sc-rd-status" style="font-size:11px;padding:3px 8px;border:1px solid #555;border-radius:999px;white-space:nowrap;">…</span>
          <button data-sc-min title="Collapse / expand" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:13px;line-height:1;cursor:pointer;">–</button>
          <button data-sc-hide title="Hide until navigation" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:12px;line-height:1;cursor:pointer;">×</button>
        </span>
      </div>
      <div data-sc-body style="display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:12px 14px;gap:8px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button id="sc-rd-capture" style="padding:7px 11px;border-radius:8px;border:none;background:#ff4500;color:#fff;font-weight:800;font-size:12px;cursor:pointer;">Capture</button>
          <button id="sc-rd-copy" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Copy</button>
          <button id="sc-rd-links" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Links</button>
          <button id="sc-rd-dl" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Download .md</button>
          <button id="sc-rd-snap" title="Copy low-clean DOM snapshot" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">📸 DOM</button>
          <button id="sc-rd-snap-high" title="Copy high-density DOM snapshot" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">📸 High</button>
        </div>
        <div id="sc-rd-meta" style="font-size:11px;opacity:.75;">…</div>
        <div id="sc-rd-lines" style="max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-size:12px;">Not captured yet.</div>
        <div style="font-size:11px;opacity:.6;">Public content only. Scroll the feed/thread for more, then Capture again.</div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#sc-rd-capture").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.textContent = "Capturing…";
      btn.disabled = true;
      try {
        await capture({ scroll: true });
      } catch (err) {
        setStatus("error", err?.message || "Capture failed.");
        renderPreview();
      } finally {
        btn.textContent = "Capture";
        btn.disabled = false;
      }
    };
    const quickCopy = async (format) => {
      try {
        if ((!posts.length && !comments.length) || routeKey() !== currentKey) {
          await capture({ scroll: false });
        }
        const r = parseRoute(location.href);
        const out = (H.buildRedditMarkdown || (() => ""))({ route: r, header, posts, comments, post: postCache, capturedAt: new Date().toISOString(), format });
        await navigator.clipboard.writeText(out);
        scToast(format === "links" ? "📋 Links copied." : `📋 Reddit capture copied (${routeKind() === "post" ? comments.length + " comments" : posts.length + " posts"}).`);
      } catch (err) {
        scToast(`❌ Copy failed — ${err?.message || "retry"}.`);
      }
    };
    el.querySelector("#sc-rd-copy").onclick = () => quickCopy("full");
    el.querySelector("#sc-rd-links").onclick = () => quickCopy("links");
    el.querySelector("#sc-rd-snap").onclick = () => copyAiSnapshot("low");
    el.querySelector("#sc-rd-snap-high").onclick = () => copyAiSnapshot("high");
    el.querySelector("#sc-rd-dl").onclick = async () => {
      try {
        const { route, markdown } = await capture({ scroll: false });
        const base = (`reddit-${route.subreddit}-${route.postId || "feed"}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 100);
        downloadFile(`${base}.md`, markdown);
      } catch (err) {
        setStatus("error", err?.message || "Download failed.");
        scToast(`❌ Download failed — ${err?.message || "retry"}.`);
      }
    };
    wireChrome(el);
    setStatus("idle", "Reddit surface detected.");
  }

  function wireChrome(el) {
    const head = el.querySelector("[data-sc-head]");
    const body = el.querySelector("[data-sc-body]");
    const minBtn = el.querySelector("[data-sc-min]");
    const hideBtn = el.querySelector("[data-sc-hide]");
    try {
      chrome.storage.local.get(["sc_rd_widget_pos", "sc_rd_widget_collapsed"], (data) => {
        const pos = data?.sc_rd_widget_pos;
        if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
          el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, pos.left))}px`;
          el.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, pos.top))}px`;
          el.style.right = "auto";
          el.style.bottom = "auto";
        }
        if (data?.sc_rd_widget_collapsed && body && minBtn) {
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
          chrome.storage.local.set({ sc_rd_widget_collapsed: collapsed });
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
        chrome.storage.local.set({ sc_rd_widget_pos: { left: Math.round(rect.left), top: Math.round(rect.top) } });
      } catch {}
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const r = parseRoute(location.href);
    if (!r.kind) return;
    if (message.type === "sc_get_capture_status") {
      sendResponse({
        ok: true,
        videoId: r.kind === "post" ? r.postId : `r/${r.subreddit}`,
        title: r.kind === "post" ? `Post in r/${r.subreddit}` : `r/${r.subreddit} feed`,
        transcriptAvailable: posts.length > 0 || comments.length > 0,
        platform: "reddit",
      });
      return;
    }
    if (message.type === "sc_get_current_markdown" || message.type === "sc_download_current_markdown" || message.type === "sc_download_current_transcript") {
      capture({ scroll: false }).then(({ route, markdown }) => {
        if (message.type === "sc_get_current_markdown") {
          sendResponse({ ok: true, markdown, title: `r/${route.subreddit}`, platform: "reddit" });
        } else {
          const base = (`reddit-${route.subreddit}-${route.postId || "feed"}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 100);
          downloadFile(`${base}.md`, markdown);
          sendResponse({ ok: true });
        }
      }).catch((e) => sendResponse({ ok: false, reason: e?.message || "Couldn't capture this page." }));
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
      document.getElementById("sc-rd-widget")?.remove();
      return;
    }
    if (key !== currentKey) {
      currentKey = key;
      posts = [];
      comments = [];
      header = null;
      postCache = null;
      injectPanel();
      setStatus("waiting", "Reddit surface detected. Auto-reading visible content…");
      watchThread(key);
      setTimeout(async () => {
        if (routeKey() !== key || posts.length || comments.length) return;
        try {
          await capture({ scroll: false });
        } catch {
          if (routeKey() === key && !posts.length && !comments.length) {
            setStatus("waiting", "Content not rendered yet — it captures as it loads, or press Capture.");
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
