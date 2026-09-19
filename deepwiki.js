// Social Companion — DeepWiki capture (deepwiki.com + Devin app.devin.ai wiki)
// Rendered article + sidebar inventory for public DeepWiki and Devin wikis.
// Devin's wiki is client-rendered, so multi-page capture walks the live SPA
// links instead of fetching the app shell.

(function () {
  "use strict";

  const H = window.DeepwikiHelpers || {};
  const parseRoute = H.parseDeepwikiRoute || (() => ({ kind: "" }));

  let currentKey = "";
  let pages = [];
  let articles = [];
  let articleMarkdown = "";
  let pageTitle = "";
  let dwStatus = { status: "idle", message: "Waiting…" };
  let _observer = null;
  let captureWalkActive = false;

  function scToast(msg, ms = 2600) {
    try {
      let t = document.getElementById("sc-deepwiki-toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "sc-deepwiki-toast";
        t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(12,12,16,.96);color:#fff;padding:10px 18px;border-radius:10px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:2147483647;border:1px solid rgba(56,189,248,.5);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;";
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
    if (!r.kind) return "";
    return `${r.host}:${r.owner}/${r.repo}#${r.pageId || "index"}`;
  }

  function keyForUrl(url) {
    const r = parseRoute(url);
    return r.kind ? `${r.host}:${r.owner}/${r.repo}#${r.pageId || "index"}` : "";
  }

  function setStatus(status, message) {
    dwStatus = { status, message };
    const badge = document.getElementById("sc-dw-status");
    const palette = { ready: "#34d399", waiting: "#fbbf24", unavailable: "#94a3b8", error: "#fb7185", idle: "#94a3b8" };
    if (badge) {
      const color = palette[status] || "#94a3b8";
      badge.textContent = status === "ready" ? `${pages.length} pages · ${articleMarkdown.length ? "article ok" : "no article"}` : message.slice(0, 34);
      badge.style.color = color;
      badge.style.borderColor = `${color}66`;
    }
    const meta = document.getElementById("sc-dw-meta");
    if (meta && currentKey) meta.textContent = message;
  }

  function snapshotVisible() {
    const scrape = H.scrapeDeepwikiSidebar || (() => []);
    const extract = H.extractWikiMarkdown || (() => "");
    const found = scrape(document, location.href);
    const md = extract(document);
    let title = "";
    try {
      const body = (H.findWikiBody || (() => null))(document);
      const h1 = body ? body.querySelector("h1") : null;
      title = (h1 && h1.textContent ? h1.textContent : document.title || "").replace(/\s+/g, " ").trim().slice(0, 160);
    } catch {}
    return { pages: found, markdown: md, title };
  }

  function findPageAnchor(targetHref) {
    const targetKey = keyForUrl(targetHref);
    return Array.from(document.querySelectorAll("a[href]")).find((anchor) => {
      try { return keyForUrl(anchor.href) === targetKey; } catch { return false; }
    });
  }

  async function waitForRenderedPage(targetHref, expectedTitle = "", timeoutMs = 9000) {
    const targetKey = keyForUrl(targetHref);
    const started = Date.now();
    let lastLength = 0;
    let stableReads = 0;
    while (Date.now() - started < timeoutMs) {
      if (routeKey() === targetKey) {
        // Do not clone/parse the whole article on every poll. Large Mermaid
        // SVGs make that path especially expensive. A cheap body-text
        // signature is enough to know when React has finished replacing the
        // previous page; snapshot once after two stable reads.
        const body = (H.findWikiBody || (() => null))(document);
        const heading = body?.querySelector?.("h1")?.textContent?.replace(/\s+/g, " ").trim() || "";
        const titleReady = !expectedTitle || heading === expectedTitle || heading.includes(expectedTitle) || expectedTitle.includes(heading);
        const textLength = Number(body?.textContent?.replace(/\s+/g, " ").trim().length || 0);
        stableReads = textLength === lastLength ? stableReads + 1 : 0;
        lastLength = textLength;
        if (titleReady && textLength >= 50 && stableReads >= 1) {
          const snap = snapshotVisible();
          if (snap.markdown.length >= 50) return snap;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    throw new Error(`Timed out waiting for ${targetHref}`);
  }

  async function navigateToPage(targetHref, expectedTitle = "") {
    if (routeKey() === keyForUrl(targetHref)) return snapshotVisible();
    const anchor = findPageAnchor(targetHref);
    if (!anchor) throw new Error(`Could not find the wiki link for ${targetHref}`);
    anchor.click();
    return waitForRenderedPage(targetHref, expectedTitle);
  }

  async function capture({ allPages = true } = {}) {
    const r = parseRoute(location.href);
    if (!r.kind) throw new Error("Open a DeepWiki repo or page first.");
    setStatus("waiting", "Reading rendered article…");
    // Give React a beat to hydrate after SPA navigation.
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (routeKey() !== keyForUrl(r.url || location.href)) {
      throw new Error("Navigated away mid-capture.");
    }
    const snap = snapshotVisible();
    pages = snap.pages;
    articleMarkdown = snap.markdown;
    pageTitle = snap.title;
    const startHref = location.href.split("#")[0];
    const startPage = { id: r.pageId || "index", title: pageTitle || r.pageId || "Overview", href: startHref };
    if (!pages.some((page) => keyForUrl(page.href) === routeKey())) pages = [startPage, ...pages];

    const targets = [];
    const seen = new Set();
    for (const page of pages) {
      const key = keyForUrl(page.href);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      targets.push(page);
    }
    articles = [];
    const originalKey = routeKey();
    const originalArticle = { id: r.pageId || "index", title: pageTitle, markdown: articleMarkdown, url: startHref };
    const shouldWalk = allPages && targets.length > 1;
    if (!shouldWalk && articleMarkdown.length >= 50) articles.push(originalArticle);

    if (shouldWalk) {
      captureWalkActive = true;
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        setStatus("waiting", `Reading wiki page ${index + 1}/${targets.length}…`);
        try {
          const pageSnap = await navigateToPage(target.href, target.title);
          articles.push({ id: target.id, title: pageSnap.title || target.title, markdown: pageSnap.markdown, url: target.href });
        } catch (error) {
          scToast(`⚠️ Skipped ${target.title || target.id}: ${error.message}`);
        }
      }
      if (routeKey() !== originalKey) {
        try { await navigateToPage(startHref, originalArticle.title); } catch {}
      }
      const restored = snapshotVisible();
      articleMarkdown = restored.markdown || originalArticle.markdown;
      pageTitle = restored.title || originalArticle.title;
      currentKey = routeKey();
      captureWalkActive = false;
    }
    if (!articleMarkdown || articleMarkdown.length < 50) setStatus("unavailable", "Article not rendered yet — wait for it to load, then Capture again.");
    else setStatus("ready", `Captured ${articles.length || 1}/${targets.length || 1} wiki pages (${pages.length} listed).`);
    renderPreview();
    const markdown = (H.buildDeepwikiMarkdown || (() => ""))({
      route: r,
      pageTitle: pageTitle || r.pageId || `${r.owner}/${r.repo}`,
      pageId: r.pageId,
      markdown: articleMarkdown,
      pages,
      articles,
      capturedAt: new Date().toISOString(),
      url: location.href.split("?")[0],
    });
    return { route: r, markdown };
  }

  function renderPreview() {
    const box = document.getElementById("sc-dw-lines");
    if (!box) return;
    if (!articleMarkdown && !pages.length) {
      box.textContent = dwStatus.message || "Not captured yet.";
      return;
    }
    box.innerHTML = "";
    if (pageTitle) {
      const head = document.createElement("div");
      head.style.cssText = "font-weight:700;font-size:12px;margin-bottom:4px;";
      head.textContent = pageTitle;
      box.appendChild(head);
    }
    if (articleMarkdown) {
      const excerpt = document.createElement("div");
      excerpt.style.cssText = "font-size:12px;opacity:.9;white-space:pre-wrap;margin-bottom:6px;";
      excerpt.textContent = articleMarkdown.slice(0, 1200);
      box.appendChild(excerpt);
    }
    const listHead = document.createElement("div");
    listHead.style.cssText = "font-size:11px;opacity:.65;margin:4px 0;";
    listHead.textContent = `Wiki pages discovered: ${pages.length}`;
    box.appendChild(listHead);
    for (const p of pages.slice(0, 100)) {
      const row = document.createElement("div");
      row.style.cssText = "padding:4px 0;border-top:1px solid rgba(255,255,255,.08);font-size:12px;";
      row.textContent = `${p.id} — ${p.title}`;
      box.appendChild(row);
    }
    if (pages.length > 100) {
      const more = document.createElement("div");
      more.style.opacity = "0.6";
      more.textContent = `… ${pages.length - 100} more (use Download for all)`;
      box.appendChild(more);
    }
  }

  async function copyAiSnapshot(mode = "low") {
    const cleanMode = mode === "high" ? "high" : "low";
    try {
      const root = document.querySelector("main") || document.body;
      const clone = root.cloneNode(true);
      clone.querySelectorAll("#sc-dw-widget, #sc-deepwiki-toast").forEach((el) => el.remove());
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
    if (document.getElementById("sc-dw-widget")) return;
    const el = document.createElement("div");
    el.id = "sc-dw-widget";
    el.style.cssText = "position:fixed;bottom:96px;right:24px;width:380px;max-height:540px;display:flex;flex-direction:column;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(12,12,16,.97);color:#f8fafc;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5);overflow:hidden;z-index:9999;";
    el.innerHTML = `
      <div data-sc-head style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:#1c1c22;border-bottom:1px solid rgba(56,189,248,.35);cursor:move;user-select:none;-webkit-user-select:none;">
        <strong style="font-size:13px;">📚 DeepWiki capture</strong>
        <span style="display:flex;align-items:center;gap:6px;">
          <span id="sc-dw-status" style="font-size:11px;padding:3px 8px;border:1px solid #555;border-radius:999px;white-space:nowrap;">…</span>
          <button data-sc-min title="Collapse / expand" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:13px;line-height:1;cursor:pointer;">–</button>
          <button data-sc-hide title="Hide until navigation" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:12px;line-height:1;cursor:pointer;">×</button>
        </span>
      </div>
      <div data-sc-body style="display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:12px 14px;gap:8px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button id="sc-dw-capture" style="padding:7px 11px;border-radius:8px;border:none;background:#0284c7;color:#fff;font-weight:800;font-size:12px;cursor:pointer;">Capture</button>
          <button id="sc-dw-copy" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Copy</button>
          <button id="sc-dw-links" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Links</button>
          <button id="sc-dw-dl" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Download .md</button>
          <button id="sc-dw-snap" title="Copy low-clean DOM snapshot" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">📸 DOM</button>
          <button id="sc-dw-snap-high" title="Copy high-density DOM snapshot" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">📸 High</button>
        </div>
        <div id="sc-dw-meta" style="font-size:11px;opacity:.75;">…</div>
        <div id="sc-dw-lines" style="max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-size:12px;">Not captured yet.</div>
        <div style="font-size:11px;opacity:.6;">Capture walks the rendered wiki pages in this tab, then returns you to the page you started on.</div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#sc-dw-capture").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.textContent = "Capturing…";
      btn.disabled = true;
      try {
        await capture({ allPages: true });
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
        await capture({ allPages: true });
        const r = parseRoute(location.href);
        const out = (H.buildDeepwikiMarkdown || (() => ""))({
          route: r,
          pageTitle: pageTitle || r.pageId || `${r.owner}/${r.repo}`,
          pageId: r.pageId,
          markdown: articleMarkdown,
          pages,
          articles,
          capturedAt: new Date().toISOString(),
          url: location.href.split("?")[0],
          format,
        });
        await navigator.clipboard.writeText(out);
        scToast(format === "links" ? "📋 Page links copied." : `📋 DeepWiki capture copied (${articleMarkdown.length.toLocaleString()} chars).`);
      } catch (err) {
        scToast(`❌ Copy failed — ${err?.message || "retry"}.`);
      }
    };
    el.querySelector("#sc-dw-copy").onclick = () => quickCopy("full");
    el.querySelector("#sc-dw-links").onclick = () => quickCopy("links");
    el.querySelector("#sc-dw-snap").onclick = () => copyAiSnapshot("low");
    el.querySelector("#sc-dw-snap-high").onclick = () => copyAiSnapshot("high");
    el.querySelector("#sc-dw-dl").onclick = async () => {
      try {
        const { route, markdown } = await capture({ allPages: true });
        const base = (`deepwiki-${route.owner}-${route.repo}-${route.pageId || "index"}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 100);
        downloadFile(`${base}.md`, markdown);
      } catch (err) {
        setStatus("error", err?.message || "Download failed.");
        scToast(`❌ Download failed — ${err?.message || "retry"}.`);
      }
    };
    wireChrome(el);
    setStatus("idle", "DeepWiki surface detected.");
  }

  function wireChrome(el) {
    const head = el.querySelector("[data-sc-head]");
    const body = el.querySelector("[data-sc-body]");
    const minBtn = el.querySelector("[data-sc-min]");
    const hideBtn = el.querySelector("[data-sc-hide]");
    try {
      chrome.storage.local.get(["sc_dw_widget_pos", "sc_dw_widget_collapsed"], (data) => {
        const pos = data?.sc_dw_widget_pos;
        if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
          el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, pos.left))}px`;
          el.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, pos.top))}px`;
          el.style.right = "auto";
          el.style.bottom = "auto";
        }
        if (data?.sc_dw_widget_collapsed && body && minBtn) {
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
          chrome.storage.local.set({ sc_dw_widget_collapsed: collapsed });
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
        chrome.storage.local.set({ sc_dw_widget_pos: { left: Math.round(rect.left), top: Math.round(rect.top) } });
      } catch {}
    });
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
      const grew = snap.pages.length > pages.length || snap.markdown.length > articleMarkdown.length + 200;
      if (grew) {
        pages = snap.pages;
        articleMarkdown = snap.markdown;
        if (snap.title) pageTitle = snap.title;
        if (articleMarkdown.length >= 50) setStatus("ready", `Captured ${pageTitle || "wiki page"} (${articleMarkdown.length.toLocaleString()} chars).`);
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
        videoId: r.pageId || `${r.owner}/${r.repo}`,
        title: pageTitle || (r.pageId ? `DeepWiki: ${r.pageId}` : `DeepWiki: ${r.owner}/${r.repo}`),
        transcriptAvailable: articleMarkdown.length >= 50,
        platform: "deepwiki",
      });
      return;
    }
    if (message.type === "sc_get_current_markdown" || message.type === "sc_download_current_markdown" || message.type === "sc_download_current_transcript") {
      capture({ allPages: true }).then(({ route, markdown }) => {
        if (message.type === "sc_get_current_markdown") {
          sendResponse({ ok: true, markdown, title: pageTitle || `DeepWiki: ${route.pageId || route.repo}`, platform: "deepwiki" });
        } else {
          const base = (`deepwiki-${route.owner}-${route.repo}-${route.pageId || "index"}`).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 100);
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
      document.getElementById("sc-dw-widget")?.remove();
      return;
    }
    if (key !== currentKey) {
      currentKey = key;
      if (captureWalkActive) return;
      pages = [];
      articleMarkdown = "";
      pageTitle = "";
      injectPanel();
      setStatus("waiting", "DeepWiki surface detected. Auto-reading rendered article…");
      watchThread(key);
      setTimeout(async () => {
        if (routeKey() !== key || articleMarkdown.length >= 50) return;
        try {
          await capture({ allPages: false });
        } catch {
          if (routeKey() === key && articleMarkdown.length < 50) {
            setStatus("waiting", "Article not rendered yet — it captures as it loads, or press Capture.");
            renderPreview();
          }
        }
      }, 2500);
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
