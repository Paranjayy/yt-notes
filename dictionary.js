/**
 * Cambridge Dictionary Word List Scraper
 * Deep scrape via iframes (proper cookie auth) + full word metadata
 */
(function () {
  "use strict";

  const isIndex = /\/plus\/wordlist\/?$/.test(location.pathname);
  const isWordlistPage = /\/plus\/wordlist\/\d+/.test(location.pathname);
  if (!isIndex && !isWordlistPage) return;

  const log = (...a) =>
    console.log("%c[CD Scraper]", "color:#0d9488;font-weight:bold", ...a);
  const warn = (...a) => console.warn("[CD Scraper]", ...a);
  log("Content script loaded on", location.pathname);

  /* ═══════════════════════════════════════════════════════════════
     STYLES
     ═══════════════════════════════════════════════════════════════ */
  const SID = "cd-scraper-css";
  if (!document.getElementById(SID)) {
    const s = document.createElement("style");
    s.id = SID;
    s.textContent = `
      .cd-fab{position:fixed;bottom:28px;right:28px;z-index:2147483647;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;font-size:15px;font-weight:800;border:none;cursor:pointer;box-shadow:0 4px 24px rgba(13,148,136,.45);transition:transform .2s,box-shadow .3s;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;letter-spacing:-.5px}
      .cd-fab:hover{transform:scale(1.1);box-shadow:0 6px 32px rgba(13,148,136,.55),0 0 0 4px rgba(13,148,136,.2)}
      .cd-fab.cd-pulse{animation:cdpr 1.8s ease-out infinite}
      @keyframes cdpr{0%{box-shadow:0 4px 24px rgba(13,148,136,.45),0 0 0 0 rgba(13,148,136,.4)}70%{box-shadow:0 4px 24px rgba(13,148,136,.45),0 0 0 14px rgba(13,148,136,0)}100%{box-shadow:0 4px 24px rgba(13,148,136,.45),0 0 0 0 rgba(13,148,136,0)}}
      .cd-panel{position:fixed;bottom:96px;right:28px;z-index:2147483646;width:440px;max-height:80vh;background:#0f172a;color:#e2e8f0;border:1px solid rgba(255,255,255,.08);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;display:flex;flex-direction:column;overflow:hidden;animation:cdsu .25s ease-out}
      @keyframes cdsu{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
      .cd-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:linear-gradient(135deg,#0d9488,#0891b2);flex-shrink:0}
      .cd-hdr-l{display:flex;align-items:center;gap:10px}
      .cd-hdr-l svg{width:20px;height:20px;fill:#fff;flex-shrink:0}
      .cd-hdr-t{font-size:14px;font-weight:700;color:#fff;letter-spacing:-.3px}
      .cd-close{width:28px;height:28px;border-radius:8px;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
      .cd-close:hover{background:rgba(255,255,255,.25)}
      .cd-stats{display:flex;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .cd-stat{flex:1;text-align:center;padding:12px 8px;border-right:1px solid rgba(255,255,255,.06)}
      .cd-stat:last-child{border-right:none}
      .cd-stat-n{font-size:22px;font-weight:800;color:#2dd4bf;line-height:1}
      .cd-stat-l{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;margin-top:4px;font-weight:600}
      .cd-acts{display:flex;gap:6px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;flex-wrap:wrap}
      .cd-btn{padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#cbd5e1;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;white-space:nowrap}
      .cd-btn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);color:#fff}
      .cd-btn-p{background:#0d9488;border-color:#0d9488;color:#fff}
      .cd-btn-p:hover{background:#0f766e;border-color:#0f766e}
      .cd-btn:disabled{opacity:.5;cursor:not-allowed}
      .cd-tabs{display:flex;padding:0 16px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;overflow-x:auto}
      .cd-tab{padding:10px 14px;font-size:12px;font-weight:600;color:#64748b;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-family:inherit;white-space:nowrap}
      .cd-tab:hover{color:#94a3b8}
      .cd-tab-a{color:#2dd4bf;border-bottom-color:#2dd4bf}
      .cd-area{flex:1;overflow-y:auto;padding:8px 16px 16px;min-height:0}
      .cd-area::-webkit-scrollbar{width:5px}
      .cd-area::-webkit-scrollbar-track{background:transparent}
      .cd-area::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
      .cd-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;transition:background .15s}
      .cd-item:hover{background:rgba(255,255,255,.04)}
      .cd-ico{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
      .cd-ico-m{background:rgba(45,212,191,.15);color:#2dd4bf}
      .cd-ico-c{background:rgba(139,92,246,.15);color:#a78bfa}
      .cd-ico-u{background:rgba(251,191,36,.15);color:#fbbf24}
      .cd-ico-co{background:rgba(239,68,68,.15);color:#f87171}
      .cd-info{flex:1;min-width:0}
      .cd-name{font-size:13px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cd-name a{color:inherit;text-decoration:none}
      .cd-name a:hover{color:#2dd4bf}
      .cd-meta{font-size:11px;color:#64748b;margin-top:2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .cd-lvl{display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
      .cd-lv-be{background:rgba(34,197,94,.15);color:#4ade80}
      .cd-lv-in{background:rgba(251,191,36,.15);color:#fbbf24}
      .cd-lv-ad{background:rgba(239,68,68,.15);color:#f87171}
      .cd-lv-na{background:rgba(139,92,246,.15);color:#a78bfa}
      .cd-cnt{font-size:12px;font-weight:700;color:#94a3b8;white-space:nowrap}
      .cd-sect{padding:10px 12px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;display:flex;align-items:center;gap:8px}
      .cd-sect::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
      .cd-empty{text-align:center;padding:40px 20px;color:#64748b}
      .cd-empty-i{font-size:40px;margin-bottom:12px;opacity:.4}
      .cd-prog{padding:0 16px 12px;flex-shrink:0}
      .cd-prog-bar{height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
      .cd-prog-fill{height:100%;background:linear-gradient(90deg,#0d9488,#06b6d4);border-radius:2px;transition:width .3s ease;width:0%}
      .cd-prog-txt{font-size:11px;color:#64748b;margin-top:6px;text-align:center;min-height:16px}
      .cd-log{padding:0 16px 12px;flex-shrink:0;max-height:120px;overflow-y:auto;font-size:10px;font-family:monospace;color:#64748b;background:rgba(0,0,0,.2);border-radius:8px;margin:0 16px 12px}
      .cd-log::-webkit-scrollbar{width:3px}
      .cd-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1)}
      .cd-log-ok{color:#4ade80}
      .cd-log-err{color:#f87171}
      .cd-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);z-index:2147483647;background:#0d9488;color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;font-family:inherit;box-shadow:0 8px 32px rgba(0,0,0,.4);opacity:0;transition:all .3s ease;pointer-events:none}
      .cd-toast-s{opacity:1;transform:translateX(-50%) translateY(0)}
      @media(max-width:500px){.cd-panel{right:8px;left:8px;width:auto;bottom:88px}.cd-fab{bottom:16px;right:16px}}
    `;
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════════════════════════════════════
     UTILS
     ═══════════════════════════════════════════════════════════════ */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (s) =>
    (s || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const abs = (href) => new URL(href, location.origin).href;

  function toast(msg) {
    let t = document.querySelector(".cd-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "cd-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("cd-toast-s");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("cd-toast-s"), 2200);
  }

  function download(content, filename, mime) {
    const b = new Blob([content], { type: mime });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  }

  /* ═══════════════════════════════════════════════════════════════
     INDEX PAGE — parse wordlist rows from DOM
     ═══════════════════════════════════════════════════════════════ */
  function parseListRows(doc) {
    return [...doc.querySelectorAll("li.wordlist-row")].map((row) => {
      const a = row.querySelector(".wl-name a");
      const id = row.dataset.wordlistId || "";
      const url = a ? abs(a.href) : "";
      const raw = clean(a?.textContent || "");
      const count = +(raw.match(/\((\d+)\)/)?.[1] || 0);
      const name = clean(raw.replace(/\(\d+\)/, ""));
      let level =
        clean(row.querySelector(".wl-mobile a")?.textContent) ||
        clean(
          [...row.querySelectorAll("span a.fs14, span.fs14")]
            .map((x) => x.textContent)
            .find(Boolean),
        );
      let type = "unknown";
      if (row.classList.contains("sort-personal")) type = "my";
      else if (row.classList.contains("sort-cup")) type = "cambridge";
      else if (row.classList.contains("sort-community")) type = "community";
      return { type, id, name, count, level, url, words: [] };
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     WORDLIST PAGE — extract words from DOM with full metadata
     ═══════════════════════════════════════════════════════════════ */
  function parseWords(doc, sourceUrl) {
    const entries = doc.querySelectorAll("li.wordlistentry-row");
    const words = [];
    const seen = new Set();

    entries.forEach((entry) => {
      const id = entry.dataset.wordId || "";
      const phraseEl = entry.querySelector("a .phrase");
      const word = clean(phraseEl?.textContent);
      if (!word) return;

      const pos = clean(entry.querySelector("a .pos")?.textContent);

      // Grammar: [ I ], [ T ], [ C ], [ U ], [ I or T ], etc.
      const gcSpans = entry.querySelectorAll("a .gram .gc");
      const grammar =
        gcSpans.length === 1
          ? clean(gcSpans[0].textContent)
          : gcSpans.length > 1
            ? [...gcSpans].map((s) => clean(s.textContent)).join(" or ")
            : "";

      // Usage labels
      const usageEls = entry.querySelectorAll("a .usage, a .dusage");
      const usage = [...usageEls]
        .map((e) => clean(e.textContent))
        .filter(Boolean)
        .join(", ");

      // Domain labels
      const domainEls = entry.querySelectorAll("a .domain, a .ddomain");
      const domain = [...domainEls]
        .map((e) => clean(e.textContent))
        .filter(Boolean)
        .join(", ");

      // CEFR level
      const cefrEl = entry.querySelector("a .epp-xref, a .dxref");
      const cefr = clean(cefrEl?.textContent);

      // Definition
      const defEl = entry.querySelector(".def");
      const definition = clean(defEl?.textContent);

      // Dictionary source
      const dictEl = entry.querySelector(".h6, .lm-0");
      const dictionary = clean(dictEl?.textContent);

      const key = `${id}-${word}`;
      if (seen.has(key)) return;
      seen.add(key);

      words.push({
        word,
        pos,
        grammar,
        usage,
        domain,
        cefr,
        definition,
        dictionary,
        id,
      });
    });

    return words;
  }

  /* ═══════════════════════════════════════════════════════════════
     IFRAME LOADER — loads a URL in a hidden iframe, returns its doc
     ═══════════════════════════════════════════════════════════════ */
  function loadInIframe(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:none;";
      iframe.src = url;

      const timer = setTimeout(() => {
        iframe.remove();
        reject(new Error(`iframe timeout after ${timeout}ms for ${url}`));
      }, timeout);

      iframe.onload = () => {
        clearTimeout(timer);
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          // Small delay to let AMP finish rendering
          setTimeout(() => {
            const result = doc;
            iframe.remove();
            resolve(result);
          }, 800);
        } catch (e) {
          iframe.remove();
          reject(new Error(`iframe access error: ${e.message}`));
        }
      };

      iframe.onerror = () => {
        clearTimeout(timer);
        iframe.remove();
        reject(new Error(`iframe load error for ${url}`));
      };

      document.body.appendChild(iframe);
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     DISCOVER ALL LISTS from index pages
     ═══════════════════════════════════════════════════════════════ */
  async function discoverAllLists() {
    const urls = new Set([location.href]);
    const linkSelectors = [
      'a[href*="/plus/myWordlists"]',
      'a[href*="/plus/cambridgeWordlists"]',
      "#goToPersowl",
      "#goToAllwl",
    ];
    linkSelectors.forEach((sel) => {
      const href = document.querySelector(sel)?.href;
      if (href) urls.add(abs(href));
    });
    urls.add(abs("/plus/wordlist?type=personal"));
    urls.add(abs("/plus/wordlist?type=cup"));
    urls.add(abs("/plus/wordlist?type=community_default"));

    const allRows = [];
    for (const url of urls) {
      try {
        log("Fetching index:", url);
        let doc;
        if (url === location.href) {
          doc = document;
        } else {
          doc = await loadInIframe(url, 10000);
        }
        const rows = parseListRows(doc);
        log(`  → Found ${rows.length} lists from`, url);
        allRows.push(...rows);
        await sleep(200);
      } catch (e) {
        warn("Index failed:", url, e.message);
      }
    }

    // Deduplicate
    const map = new Map();
    allRows.forEach((r) => {
      const key = r.id || r.url || r.name;
      if (!map.has(key)) map.set(key, r);
    });
    const deduped = [...map.values()];
    log("Total unique lists:", deduped.length);
    return deduped;
  }

  /* ═══════════════════════════════════════════════════════════════
     DEEP SCRAPE — load each wordlist in iframe, extract words
     ═══════════════════════════════════════════════════════════════ */
  async function deepScrape(progressCb, logCb) {
    const lists = await discoverAllLists();
    const total = lists.length;

    for (let i = 0; i < total; i++) {
      const list = lists[i];
      progressCb(i, total, list.name);
      if (!list.url) {
        logCb(`Skipping ${list.name} — no URL`, "warn");
        continue;
      }

      try {
        logCb(`[${i + 1}/${total}] Loading: ${list.name}`);
        const doc = await loadInIframe(list.url, 15000);

        // Debug: check what we got
        const hasEntries = doc.querySelectorAll("li.wordlistentry-row").length;
        const hasLogout = doc.body?.textContent?.includes("Logout successful");
        const bodyLen = doc.body?.innerHTML?.length || 0;

        logCb(
          `  DOM body: ${bodyLen} chars, entries: ${hasEntries}, logout: ${hasLogout}`,
        );

        if (hasLogout) {
          logCb(`  ⚠ Auth issue — page shows "Logout successful"`, "err");
        }

        list.words = parseWords(doc, list.url);
        logCb(
          `  ✓ Scraped ${list.words.length}/${list.count} words`,
          list.words.length > 0 ? "ok" : "warn",
        );

        // Debug: show first few words
        if (list.words.length > 0) {
          logCb(
            `  Sample: ${list.words
              .slice(0, 3)
              .map((w) => w.word)
              .join(", ")}...`,
          );
        }

        await sleep(500);
      } catch (e) {
        warn("Wordlist failed:", list.name, e.message);
        logCb(`  ✗ Error: ${e.message}`, "err");
        list.words = [];
        list.error = String(e.message || e);
      }
    }

    progressCb(total, total, "Done");
    return lists;
  }

  /* ═══════════════════════════════════════════════════════════════
     STORAGE — trim data to avoid quota issues
     ═══════════════════════════════════════════════════════════════ */
  function save(lists) {
    // Trim: only keep essential word fields, no audio URLs
    const trimmed = lists.map((l) => ({
      ...l,
      words: l.words.map((w) => ({
        word: w.word,
        pos: w.pos,
        grammar: w.grammar,
        usage: w.usage,
        domain: w.domain,
        cefr: w.cefr,
        definition: w.definition,
        // Skip: dictionary, id, ukAudio, usAudio (saves lots of space)
      })),
    }));

    const payload = {
      scrapedAt: new Date().toISOString(),
      url: location.href,
      totalLists: trimmed.length,
      totalWords: trimmed.reduce((s, l) => s + l.words.length, 0),
      lists: trimmed,
    };

    try {
      chrome.storage.local.set({ cd_wordlists: payload });
      log(
        "Saved to storage:",
        payload.totalLists,
        "lists,",
        payload.totalWords,
        "words",
      );
    } catch (e) {
      warn("Storage save failed:", e.message);
      // Fallback: save minimal data
      try {
        const minimal = {
          scrapedAt: payload.scrapedAt,
          totalLists: trimmed.length,
          lists: trimmed.map((l) => ({
            ...l,
            words: l.words.map((w) => ({
              word: w.word,
              definition: w.definition,
            })),
          })),
        };
        chrome.storage.local.set({ cd_wordlists: minimal });
        log("Saved minimal version to storage");
      } catch (e2) {
        warn("Even minimal storage failed:", e2.message);
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     EXPORT FORMATS
     ═══════════════════════════════════════════════════════════════ */
  function toCSV(lists) {
    const h =
      "list_id,list_name,list_type,list_level,list_count,list_url,word,pos,grammar,usage,domain,cefr,definition";
    const rows = lists.flatMap((l) =>
      l.words.length
        ? l.words.map((w) =>
            [
              l.id,
              `"${l.name}"`,
              l.type,
              l.level || "",
              l.count,
              l.url,
              `"${w.word}"`,
              w.pos,
              `"${w.grammar}"`,
              `"${w.usage}"`,
              `"${w.domain}"`,
              w.cefr,
              `"${w.definition}"`,
            ].join(","),
          )
        : [
            [
              l.id,
              `"${l.name}"`,
              l.type,
              l.level || "",
              l.count,
              l.url,
              "",
              "",
              "",
              "",
              "",
              "",
              "",
            ].join(","),
          ],
    );
    return [h, ...rows].join("\n");
  }

  function toJSON(lists) {
    return JSON.stringify(
      {
        scrapedAt: new Date().toISOString(),
        totalLists: lists.length,
        totalWords: lists.reduce((s, l) => s + l.words.length, 0),
        lists,
      },
      null,
      2,
    );
  }

  function toMarkdown(lists) {
    let md = `# Cambridge Dictionary — Word Lists\n\n`;
    md += `> Scraped ${new Date().toLocaleString()}\n\n`;
    let tw = 0;
    lists.forEach((l) => {
      md += `## ${l.name}\n\n`;
      md += `**Type:** ${l.type} | **Level:** ${l.level || "—"} | **Expected:** ${l.count} | **Scraped:** ${l.words.length}\n\n`;
      if (l.words.length > 0) {
        md += `| # | Word | POS | Grammar | Usage | Domain | CEFR | Definition |\n`;
        md += `|---|------|-----|----------|-------|--------|------|------------|\n`;
        l.words.forEach((w, i) => {
          md += `| ${i + 1} | ${w.word} | ${w.pos} | ${w.grammar} | ${w.usage} | ${w.domain} | ${w.cefr || "—"} | ${w.definition} |\n`;
          tw++;
        });
      } else {
        md += `_No words scraped_\n`;
      }
      md += `\n`;
    });
    md += `---\n\n**Total:** ${lists.length} lists, ${tw} words\n`;
    return md;
  }

  function toAnki(lists) {
    const lines = [];
    const seen = new Set();
    lists.forEach((l) => {
      l.words.forEach((w) => {
        const key = w.word.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        lines.push(`${w.word}\t${w.definition}\t${w.pos}\t${l.name}`);
      });
    });
    return lines.join("\n");
  }

  /* ═══════════════════════════════════════════════════════════════
     UI
     ═══════════════════════════════════════════════════════════════ */
  const LVLC = {
    Beginner: "cd-lv-be",
    Intermediate: "cd-lv-in",
    Advanced: "cd-lv-ad",
    "Native Speaker": "cd-lv-na",
  };
  const ICO = {
    my: ["📝", "cd-ico-m"],
    cambridge: ["🏛️", "cd-ico-c"],
    community: ["👥", "cd-ico-co"],
    unknown: ["📄", "cd-ico-u"],
  };

  function renderList(lists, filter) {
    const filtered =
      filter === "all" ? lists : lists.filter((l) => l.type === filter);
    let html = "";
    const grouped = {};
    filtered.forEach((l) => {
      (grouped[l.type] ||= []).push(l);
    });

    Object.entries(grouped).forEach(([type, items]) => {
      const [emoji] = ICO[type] || ICO.unknown;
      html += `<div class="cd-sect">${emoji} ${items.length} list${items.length !== 1 ? "s" : ""}</div>`;
      items.forEach((l) => {
        const lvl = l.level
          ? `<span class="cd-lvl ${LVLC[l.level] || ""}">${l.level}</span>`
          : "";
        const wc = l.words.length || l.count;
        html += `
          <div class="cd-item">
            <div class="cd-ico ${ICO[type]?.[1] || "cd-ico-u"}">${emoji}</div>
            <div class="cd-info">
              <div class="cd-name"><a href="${l.url}" target="_blank" rel="noopener">${l.name}</a></div>
              <div class="cd-meta">${lvl}<span>${l.words.length ? `${l.words.length} scraped` : `${l.count} words`}</span><span>${l.id}</span></div>
            </div>
            <div class="cd-cnt">${wc}</div>
          </div>`;
      });
    });
    if (!html)
      html = `<div class="cd-empty"><div class="cd-empty-i">📭</div><div>No lists found.</div></div>`;
    return html;
  }

  /* ═══════════════════════════════════════════════════════════════
     PANEL
     ═══════════════════════════════════════════════════════════════ */
  function createPanel(lists) {
    const myC = lists.filter((l) => l.type === "my").length;
    const camC = lists.filter((l) => l.type === "cambridge").length;
    const comC = lists.filter((l) => l.type === "community").length;
    const unkC = lists.filter((l) => l.type === "unknown").length;
    const tw = lists.reduce((s, l) => s + (l.words.length || l.count), 0);
    const sw = lists.reduce((s, l) => s + l.words.length, 0);

    const panel = document.createElement("div");
    panel.className = "cd-panel";
    panel.innerHTML = `
      <div class="cd-hdr">
        <div class="cd-hdr-l">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span class="cd-hdr-t">Word List Scraper</span>
        </div>
        <button class="cd-close" title="Close">✕</button>
      </div>
      <div class="cd-stats">
        <div class="cd-stat"><div class="cd-stat-n">${lists.length}</div><div class="cd-stat-l">Lists</div></div>
        <div class="cd-stat"><div class="cd-stat-n">${tw.toLocaleString()}</div><div class="cd-stat-l">Total Words</div></div>
        <div class="cd-stat"><div class="cd-stat-n">${sw.toLocaleString()}</div><div class="cd-stat-l">Scraped</div></div>
        <div class="cd-stat"><div class="cd-stat-n">${myC}</div><div class="cd-stat-l">Mine</div></div>
      </div>
      <div class="cd-acts">
        <button class="cd-btn cd-btn-p" id="cd-scrape">🔍 Deep Scrape</button>
        <button class="cd-btn" id="cd-copy-json">📋 JSON</button>
        <button class="cd-btn" id="cd-copy-csv">📊 CSV</button>
        <button class="cd-btn" id="cd-copy-md">📝 MD</button>
        <button class="cd-btn" id="cd-copy-anki">🧠 Anki</button>
        <button class="cd-btn" id="cd-dl-all">⬇ All</button>
      </div>
      <div class="cd-tabs">
        <button class="cd-tab cd-tab-a" data-f="all">All (${lists.length})</button>
        <button class="cd-tab" data-f="my">Mine (${myC})</button>
        <button class="cd-tab" data-f="cambridge">Cambridge (${camC})</button>
        <button class="cd-tab" data-f="community">Community (${comC})</button>
        ${unkC ? `<button class="cd-tab" data-f="unknown">Other (${unkC})</button>` : ""}
      </div>
      <div class="cd-area" id="cd-area">${renderList(lists, "all")}</div>
    `;

    panel
      .querySelector(".cd-close")
      .addEventListener("click", () => panel.remove());

    // Tabs
    panel.querySelectorAll(".cd-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        panel
          .querySelectorAll(".cd-tab")
          .forEach((t) => t.classList.remove("cd-tab-a"));
        tab.classList.add("cd-tab-a");
        panel.querySelector("#cd-area").innerHTML = renderList(
          lists,
          tab.dataset.f,
        );
      });
    });

    // Deep Scrape
    panel.querySelector("#cd-scrape").addEventListener("click", async () => {
      const btn = panel.querySelector("#cd-scrape");
      btn.disabled = true;
      btn.textContent = "⏳ Scraping...";

      // Add progress + log panel
      let progEl = panel.querySelector(".cd-prog");
      if (!progEl) {
        progEl = document.createElement("div");
        progEl.className = "cd-prog";
        progEl.innerHTML = `<div class="cd-prog-bar"><div class="cd-prog-fill" id="cd-fill"></div></div><div class="cd-prog-txt" id="cd-ptxt">Starting...</div>`;
        btn.parentElement.after(progEl);
      }
      let logEl = panel.querySelector(".cd-log");
      if (!logEl) {
        logEl = document.createElement("div");
        logEl.className = "cd-log";
        logEl.id = "cd-log";
        progEl.after(logEl);
      }

      const fill = panel.querySelector("#cd-fill");
      const ptxt = panel.querySelector("#cd-ptxt");
      const logArea = panel.querySelector("#cd-log");

      const addLog = (msg, type) => {
        const line = document.createElement("div");
        line.className =
          type === "ok" ? "cd-log-ok" : type === "err" ? "cd-log-err" : "";
        line.textContent = msg;
        logArea.appendChild(line);
        logArea.scrollTop = logArea.scrollHeight;
        log(msg); // also console.log
      };

      try {
        const scraped = await deepScrape((done, total, name) => {
          fill.style.width = (total > 0 ? (done / total) * 100 : 0) + "%";
          ptxt.textContent =
            done < total ? `[${done}/${total}] ${name}` : `✅ Done`;
        }, addLog);

        lists.length = 0;
        scraped.forEach((l) => lists.push(l));
        save(lists);

        const newSW = lists.reduce((s, l) => s + l.words.length, 0);
        panel.querySelectorAll(".cd-stat-n")[2].textContent =
          newSW.toLocaleString();
        const activeTab = panel.querySelector(".cd-tab-a");
        panel.querySelector("#cd-area").innerHTML = renderList(
          lists,
          activeTab?.dataset.f || "all",
        );
        toast(`✅ ${newSW} words from ${lists.length} lists`);
      } catch (e) {
        ptxt.textContent = "❌ Error";
        addLog(`FATAL: ${e.message}`, "err");
      }

      btn.disabled = false;
      btn.textContent = "🔍 Deep Scrape";
    });

    // Exports
    panel.querySelector("#cd-copy-json").addEventListener("click", () => {
      navigator.clipboard
        .writeText(toJSON(lists))
        .then(() => toast("✅ JSON copied"));
    });
    panel.querySelector("#cd-copy-csv").addEventListener("click", () => {
      navigator.clipboard
        .writeText(toCSV(lists))
        .then(() => toast("✅ CSV copied"));
    });
    panel.querySelector("#cd-copy-md").addEventListener("click", () => {
      navigator.clipboard
        .writeText(toMarkdown(lists))
        .then(() => toast("✅ Markdown copied"));
    });
    panel.querySelector("#cd-copy-anki").addEventListener("click", () => {
      navigator.clipboard
        .writeText(toAnki(lists))
        .then(() => toast("✅ Anki TSV copied"));
    });
    panel.querySelector("#cd-dl-all").addEventListener("click", () => {
      const ts = new Date().toISOString().slice(0, 10);
      download(
        toJSON(lists),
        `cambridge-wordlists-${ts}.json`,
        "application/json",
      );
      download(toCSV(lists), `cambridge-wordlists-${ts}.csv`, "text/csv");
      download(
        toMarkdown(lists),
        `cambridge-wordlists-${ts}.md`,
        "text/markdown",
      );
      download(
        toAnki(lists),
        `cambridge-wordlists-${ts}.txt`,
        "text/tab-separated-values",
      );
      toast("✅ Downloaded all formats");
    });

    return panel;
  }

  /* ═══════════════════════════════════════════════════════════════
     SINGLE WORDLIST PAGE — scrape from live DOM
     ═══════════════════════════════════════════════════════════════ */
  function scrapeCurrentPage() {
    const words = parseWords(document, location.href);
    const title =
      document.querySelector("#word-list-name")?.value ||
      document.querySelector("h1")?.textContent?.trim() ||
      "Word List";
    const size = +(
      document.querySelector("#word-list-name")?.dataset?.wordlistSize ||
      words.length
    );
    log("Scraped current page:", words.length, "words from", title);
    return {
      type: "my",
      id: document.querySelector("#word-list-name")?.dataset?.wordlistId || "",
      name: title,
      count: size,
      level: "",
      url: location.href,
      words,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════════════════════ */
  async function init() {
    if (document.querySelector(".cd-fab")) return;

    let lists = [];
    if (isWordlistPage) {
      lists = [scrapeCurrentPage()];
    } else {
      lists = await discoverAllLists();
    }
    save(lists);

    const fab = document.createElement("button");
    fab.className = "cd-fab cd-pulse";
    fab.title = "Cambridge Word List Scraper";
    fab.textContent = "WL";
    document.body.appendChild(fab);

    let panel = null;
    fab.addEventListener("click", () => {
      if (panel) {
        panel.remove();
        panel = null;
        fab.classList.add("cd-pulse");
      } else {
        panel = createPanel(lists);
        document.body.appendChild(panel);
        fab.classList.remove("cd-pulse");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
