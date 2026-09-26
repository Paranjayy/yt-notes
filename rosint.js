// Social Companion — Rosint capture (rosint.dev/?u=<user> profile archive)
// Public Reddit archive data (Arctic Shift + PullPush) rendered by Rosint.
// Route-gated to ?u= profile pages only. Crawl-all-pages + both tabs runs
// only on explicit Capture press; auto-read stays on the visible page.

(function () {
  "use strict";

  const H = window.RosintHelpers || {};
  const parseRoute = H.parseRosintRoute || (() => ({ kind: "", username: "" }));

  const PAGE_CAP = 25;

  let currentKey = "";
  let posts = [];
  let comments = [];
  let profile = null;
  let pagesCrawled = { posts: 0, comments: 0 };
  let rsStatus = { status: "idle", message: "Waiting…" };
  let _observer = null;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function scToast(msg, ms = 2600) {
    try {
      let t = document.getElementById("sc-rosint-toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "sc-rosint-toast";
        t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(12,12,16,.96);color:#fff;padding:10px 18px;border-radius:10px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:2147483647;border:1px solid rgba(254,83,1,.5);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;";
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

  function routeKey() {
    const r = parseRoute(location.href);
    if (r.kind === "profile") return `rosint:${r.username}`;
    return "";
  }

  function setStatus(status, message) {
    rsStatus = { status, message };
    const badge = document.getElementById("sc-rosint-status");
    const palette = { ready: "#34d399", waiting: "#fbbf24", unavailable: "#94a3b8", error: "#fb7185", idle: "#94a3b8" };
    if (badge) {
      const color = palette[status] || "#94a3b8";
      badge.textContent = status === "ready" ? `${posts.length + comments.length} captured` : message.slice(0, 30);
      badge.style.color = color;
      badge.style.borderColor = `${color}66`;
    }
    const meta = document.getElementById("sc-rosint-meta");
    if (meta && currentKey) meta.textContent = message;
  }

  function snapshotVisible() {
    const scrapeProfile = H.scrapeRosintProfile || (() => null);
    const scrapeCards = H.scrapeRosintCards || (() => []);
    const r = parseRoute(location.href);
    return { profile: scrapeProfile(document, r.username), cards: scrapeCards(document) };
  }

  async function waitFor(fn, timeoutMs = 6000) {
    const start = Date.now();
    for (;;) {
      let v = null;
      try {
        v = fn();
      } catch {}
      if (v) return v;
      if (Date.now() - start > timeoutMs) return null;
      await sleep(300);
    }
  }

  /** Click collapsed card headers so full bodies render. Skips the media
   *  thumbnail (role=button, no aria-label) and the "show N comments"
   *  loaders (aria-expanded) — inline comments stay collapsed so card
   *  bodies aren't polluted; the Comments tab covers comments. */
  async function expandBodies(key) {
    let expanded = 0;
    try {
      const anchors = Array.from(document.querySelectorAll('a[href*="reddit.com/r/"]')).filter((a) =>
        /open in reddit/i.test((a.textContent || "").replace(/\s+/g, " ").trim())
      );
      const seen = new Set();
      for (const a of anchors) {
        if (routeKey() !== key) break;
        let node = a;
        let card = null;
        for (let d = 0; d < 12 && node?.parentElement; d++) {
          node = node.parentElement;
          try {
            if (node.querySelectorAll('a[href*="reddit.com/r/"]').length === 1) card = node;
            else break;
          } catch {}
        }
        if (!card || seen.has(card)) continue;
        seen.add(card);
        const head = card.firstElementChild;
        if (head && head.tagName === "DIV" && !head.hasAttribute("role")) {
          try {
            head.click();
            expanded++;
            if (expanded % 10 === 0) await sleep(250);
          } catch {}
        }
      }
    } catch {}
    if (expanded) await sleep(800);
    return expanded;
  }

  async function clickTab(key, name) {
    const find = H.findRosintTab || (() => null);
    const btn = find(document, name);
    if (!btn) return false;
    try {
      btn.click();
    } catch {
      return false;
    }
    // Wait until this tab's cards show up (or timeout — empty tabs exist).
    await waitFor(() => {
      if (routeKey() !== key) return true;
      return snapshotVisible().cards.length ? true : null;
    }, 5000);
    await sleep(500);
    return routeKey() === key;
  }

  function nextButton() {
    try {
      const btn = document.querySelector('button[aria-label="Next page"]');
      if (!btn || btn.disabled || btn.hasAttribute("disabled")) return null;
      return btn;
    } catch {
      return null;
    }
  }

  /** Crawl one tab across pages. Returns {items, pages}. */
  async function crawlTab(key, name) {
    const items = new Map();
    let pages = 0;
    if (!(await clickTab(key, name))) return { items: [], pages };
    for (let page = 0; page < PAGE_CAP; page++) {
      if (routeKey() !== key) break;
      await expandBodies(key);
      if (routeKey() !== key) break;
      const snap = snapshotVisible();
      for (const c of snap.cards) {
        if (c?.url && !items.has(c.url)) items.set(c.url, c);
      }
      pages++;
      setStatus("waiting", `Reading ${name}… page ${pages} (${items.size} items).`);
      renderPreview();
      const next = nextButton();
      if (!next) break;
      const before = items.size;
      try {
        next.click();
      } catch {
        break;
      }
      await sleep(1200);
      if (routeKey() !== key) break;
      // Stop when no new items arrive (last page re-rendered).
      const after = snapshotVisible().cards.length;
      if (after === 0) break;
      void before;
    }
    return { items: [...items.values()], pages };
  }

  async function capture({ crawl = false } = {}) {
    const r = parseRoute(location.href);
    if (!r.kind) throw new Error("Open a Rosint profile first (rosint.dev/?u=<name>).");
    const key = routeKey();
    if (crawl) {
      setStatus("waiting", "Crawling posts + comments across pages…");
      const p = await crawlTab(key, "Posts");
      if (routeKey() !== key) throw new Error("Navigated away mid-capture.");
      const c = await crawlTab(key, "Comments");
      if (routeKey() !== key) throw new Error("Navigated away mid-capture.");
      posts = p.items;
      comments = c.items;
      pagesCrawled = { posts: p.pages, comments: c.pages };
      profile = (H.scrapeRosintProfile || (() => null))(document, r.username);
      if (!posts.length && !comments.length) {
        setStatus("unavailable", "No results rendered — wait for Rosint to load, then Capture again.");
      } else {
        setStatus("ready", `Captured ${posts.length} posts + ${comments.length} comments.`);
      }
    } else {
      setStatus("waiting", "Reading visible results…");
      const snap = snapshotVisible();
      profile = snap.profile;
      // Visible-page capture lands in posts; tab origin unknown without crawl.
      posts = snap.cards;
      if (!posts.length) {
        setStatus("unavailable", "No results rendered — wait for Rosint to load, then Capture again.");
      } else {
        setStatus("ready", `Captured ${posts.length} visible results.`);
      }
    }
    renderPreview();
    const md = (H.buildRosintMarkdown || (() => ""))({
      route: r,
      profile,
      posts,
      comments,
      pagesCrawled,
      capturedAt: new Date().toISOString(),
    });
    return { route: r, markdown: md };
  }

  function renderPreview() {
    const box = document.getElementById("sc-rosint-lines");
    if (!box) return;
    const all = [...posts.map((c) => ({ ...c, tab: "post" })), ...comments.map((c) => ({ ...c, tab: "comment" }))];
    if (!all.length) {
      box.textContent = rsStatus.message || "Not captured yet.";
      return;
    }
    box.innerHTML = "";
    if (profile?.username) {
      const head = document.createElement("div");
      head.style.cssText = "font-weight:700;font-size:12px;margin-bottom:4px;";
      head.textContent = `u/${profile.username} — ${posts.length} posts, ${comments.length} comments`;
      box.appendChild(head);
    }
    for (const c of all.slice(0, 100)) {
      const row = document.createElement("div");
      row.style.cssText = "padding:5px 0;border-top:1px solid rgba(255,255,255,.08);font-size:12px;";
      const head = document.createElement("div");
      head.style.fontWeight = "700";
      head.textContent = `${c.subreddit || ""} · ${c.title || "(no title)"} (⬆️ ${c.score || "?"})`;
      const body = document.createElement("div");
      body.style.opacity = "0.9";
      body.textContent = (c.body || "_(body collapsed)_").slice(0, 300);
      row.append(head, body);
      box.appendChild(row);
    }
    if (all.length > 100) {
      const more = document.createElement("div");
      more.style.opacity = "0.6";
      more.textContent = `… ${all.length - 100} more (use Download for all)`;
      box.appendChild(more);
    }
  }

  /** Local AI-DOM snapshot (low/high) — widget entry point to the cleaner. */
  async function copyAiSnapshot(mode = "low") {
    const cleanMode = mode === "high" ? "high" : "low";
    try {
      const root = document.querySelector("main") || document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll("#sc-rosint-widget, #sc-rosint-toast").forEach((el) => el.remove());
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
    if (document.getElementById("sc-rosint-widget")) return;
    const el = document.createElement("div");
    el.id = "sc-rosint-widget";
    el.style.cssText = "position:fixed;bottom:96px;right:24px;width:380px;max-height:540px;display:flex;flex-direction:column;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(12,12,16,.97);color:#f8fafc;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5);overflow:hidden;z-index:9999;";
    el.innerHTML = `
      <div data-sc-head style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:#1c1c22;border-bottom:1px solid rgba(254,83,1,.35);cursor:move;user-select:none;-webkit-user-select:none;">
        <strong style="font-size:13px;">🕵️ Rosint capture</strong>
        <span style="display:flex;align-items:center;gap:6px;">
          <span id="sc-rosint-status" style="font-size:11px;padding:3px 8px;border:1px solid #555;border-radius:999px;white-space:nowrap;">…</span>
          <button data-sc-min title="Collapse / expand" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:13px;line-height:1;cursor:pointer;">–</button>
          <button data-sc-hide title="Hide until navigation" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:12px;line-height:1;cursor:pointer;">×</button>
        </span>
      </div>
      <div data-sc-body style="display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:12px 14px;gap:8px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button id="sc-rosint-capture" title="Crawl all pages on Posts + Comments tabs" style="padding:7px 11px;border-radius:8px;border:none;background:#fe5301;color:#fff;font-weight:800;font-size:12px;cursor:pointer;">Capture all</button>
          <button id="sc-rosint-copy" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Copy</button>
          <button id="sc-rosint-links" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Links</button>
          <button id="sc-rosint-dl" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Download .md</button>
          <button id="sc-rosint-snap" title="Copy low-clean DOM snapshot" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">📸 DOM</button>
          <button id="sc-rosint-snap-high" title="Copy high-density DOM snapshot" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">📸 High</button>
        </div>
        <div id="sc-rosint-meta" style="font-size:11px;opacity:.75;">…</div>
        <div id="sc-rosint-lines" style="max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-size:12px;">Not captured yet.</div>
        <div style="font-size:11px;opacity:.6;">Public archive only (Arctic Shift + PullPush). Capture all walks every page on both tabs.</div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#sc-rosint-capture").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.textContent = "Crawling…";
      btn.disabled = true;
      try {
        await capture({ crawl: true });
      } catch (err) {
        setStatus("error", err?.message || "Capture failed.");
        renderPreview();
      } finally {
        btn.textContent = "Capture all";
        btn.disabled = false;
      }
    };
    const quickCopy = async (format) => {
      try {
        if ((!posts.length && !comments.length) || routeKey() !== currentKey) {
          await capture({ crawl: false });
        }
        const r = parseRoute(location.href);
        const out = (H.buildRosintMarkdown || (() => ""))({ route: r, profile, posts, comments, pagesCrawled, capturedAt: new Date().toISOString(), format });
        await navigator.clipboard.writeText(out);
        scToast(format === "links" ? "📋 Links copied." : `📋 Rosint capture copied (${posts.length + comments.length} items).`);
      } catch (err) {
        scToast(`❌ Copy failed — ${err?.message || "retry"}.`);
      }
    };
    el.querySelector("#sc-rosint-copy").onclick = () => quickCopy("full");
    el.querySelector("#sc-rosint-links").onclick = () => quickCopy("links");
    el.querySelector("#sc-rosint-snap").onclick = () => copyAiSnapshot("low");
    el.querySelector("#sc-rosint-snap-high").onclick = () => copyAiSnapshot("high");
    el.querySelector("#sc-rosint-dl").onclick = async () => {
      try {
        const { route, markdown } = await capture({ crawl: false });
        const base = (`rosint-${route.username || "profile"}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 100);
        downloadFile(`${base}.md`, markdown);
      } catch (err) {
        setStatus("error", err?.message || "Download failed.");
        scToast(`❌ Download failed — ${err?.message || "retry"}.`);
      }
    };
    wireChrome(el);
    setStatus("idle", "Rosint surface detected.");
  }

  function wireChrome(el) {
    const head = el.querySelector("[data-sc-head]");
    const body = el.querySelector("[data-sc-body]");
    const minBtn = el.querySelector("[data-sc-min]");
    const hideBtn = el.querySelector("[data-sc-hide]");
    try {
      chrome.storage.local.get(["sc_rosint_widget_pos", "sc_rosint_widget_collapsed"], (data) => {
        const pos = data?.sc_rosint_widget_pos;
        if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
          el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, pos.left))}px`;
          el.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, pos.top))}px`;
          el.style.right = "auto";
          el.style.bottom = "auto";
        }
        if (data?.sc_rosint_widget_collapsed && body && minBtn) {
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
          chrome.storage.local.set({ sc_rosint_widget_collapsed: collapsed });
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
        chrome.storage.local.set({ sc_rosint_widget_pos: { left: Math.round(rect.left), top: Math.round(rect.top) } });
      } catch {}
    });
  }

  function watchResults(key) {
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
      if (snap.cards.length > posts.length + comments.length) {
        posts = snap.cards;
        comments = [];
        profile = snap.profile || profile;
        setStatus("ready", `Captured ${posts.length} visible results.`);
        renderPreview();
      }
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const r = parseRoute(location.href);
    if (!r.kind) return;
    if (message.type === "sc_get_capture_status") {
      sendResponse({
        ok: true,
        videoId: `u/${r.username}`,
        title: `u/${r.username} Rosint archive`,
        transcriptAvailable: posts.length + comments.length > 0,
        platform: "rosint",
      });
      return;
    }
    if (message.type === "sc_get_current_markdown" || message.type === "sc_download_current_markdown" || message.type === "sc_download_current_transcript") {
      capture({ crawl: false }).then(({ route, markdown }) => {
        if (message.type === "sc_get_current_markdown") {
          sendResponse({ ok: true, markdown, title: `u/${route.username} Rosint`, platform: "rosint" });
        } else {
          const base = (`rosint-${route.username || "profile"}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 100);
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
      document.getElementById("sc-rosint-widget")?.remove();
      return;
    }
    if (key !== currentKey) {
      currentKey = key;
      posts = [];
      comments = [];
      profile = null;
      pagesCrawled = { posts: 0, comments: 0 };
      injectPanel();
      setStatus("waiting", "Rosint surface detected. Auto-reading visible results…");
      watchResults(key);
      setTimeout(async () => {
        if (routeKey() !== key || posts.length || comments.length) return;
        try {
          await capture({ crawl: false });
        } catch {
          if (routeKey() === key && !posts.length && !comments.length) {
            setStatus("waiting", "Results not rendered yet — they capture as they load, or press Capture all.");
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
