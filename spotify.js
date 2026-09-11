// Social Companion — Spotify episode capture (open.spotify.com/episode/*)
// Metadata + transcript extractor. No cookies/tokens leave the page: the
// episode Bearer token is fetched same-origin and used only to call Spotify's
// own transcript endpoint for the open episode.
//
// Page facts this relies on (verified against a live episode DOM):
// - #transcript-panel rows are UNTIMED, speaker-grouped divs; the first row
//   is an auto-generated disclaimer. Timed cues only come from the
//   transcript-read-along API.
// - Spotify disables text selection in places; we re-enable it inside the
//   transcript/description panels so lines can be selected and copied.

(function () {
  "use strict";

  const H = window.SpotifyHelpers || {};
  const getEpisodeId = H.getSpotifyEpisodeId || ((u) => {
    const m = String(u || location.href).match(/episode\/([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  });

  let currentEpisodeId = "";
  let segments = []; // {startMs:number|null, speaker:string|null, text}
  let transcriptNotice = "";
  let transcriptMeta = { status: "idle", message: "Waiting for this episode…", source: "" };
  let lastCapture = { episodeId: "", markdown: "", at: "" };
  // Per-episode one-shot flags: the transcript API is unreachable from this
  // browser profile (content blocker / logged-out token endpoint), and the
  // panel was already auto-scrolled to force lazy rows to render.
  let apiBlockedForEpisode = "";
  let autoScrolledFor = "";
  let _panelObserver = null;

  function setStatus(status, message, source = "") {
    transcriptMeta = { status, videoId: currentEpisodeId, message, source, updatedAt: new Date().toISOString() };
    renderStatus();
  }

  /** Page-level toast (mirrors YouTube's showToast) for copy/download receipts. */
  function scToast(msg, ms = 2600) {
    try {
      let t = document.getElementById("sc-spotify-toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "sc-spotify-toast";
        t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(0);background:rgba(15,15,20,.96);color:#fff;padding:10px 18px;border-radius:10px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:2147483647;border:1px solid rgba(29,185,84,.4);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;";
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

  function $(sel, root = document) {
    try { return root.querySelector(sel); } catch { return null; }
  }
  function $all(sel, root = document) {
    try { return Array.from(root.querySelectorAll(sel)); } catch { return []; }
  }
  function text(el) {
    return (el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  // --- Selection unlock: Spotify sets user-select:none on large containers.
  // Re-enable selection inside readable content only (never on controls). ---
  function injectSelectionFix() {
    if (document.getElementById("sc-spotify-select-fix")) return;
    const style = document.createElement("style");
    style.id = "sc-spotify-select-fix";
    style.textContent = `
      #transcript-panel, #transcript-panel *,
      #description-panel, #description-panel *,
      [data-testid="episode-list"], [data-testid="episode-list"] *,
      [data-testid="playlist-tracklist"], [data-testid="playlist-tracklist"] *,
      #sc-spotify-widget, #sc-spotify-widget *,
      #sc-spotify-pl-widget, #sc-spotify-pl-widget *,
      #sc-spotify-ly-widget, #sc-spotify-ly-widget * {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
      #sc-sp-head, #sc-sp-head * {
        user-select: none !important;
        -webkit-user-select: none !important;
        cursor: move;
      }`;
    document.head.appendChild(style);
  }

  function extractSpotifyMetadata() {
    const episodeId = getEpisodeId(location.href);
    const url = `https://open.spotify.com/episode/${episodeId}`;
    const episode =
      text($('[data-testid="episodeTitle"]')) ||
      text($('[data-testid="entityTitle"] h1')) ||
      document.title.replace(/\s*[•·|-]\s*Spotify\s*$/i, "").trim() ||
      "Spotify episode";
    const show =
      text($('[data-testid="showTitle"]')) ||
      text($('[data-testid="entityAuthor"]')) ||
      "";
    let date = "";
    let duration = "";
    let durationMs = null;
    const actionBar = $('[data-testid="action-bar"]');
    if (actionBar) {
      const dateEl = $all("p", actionBar).find((p) => /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(p.textContent || ""));
      if (dateEl) date = text(dateEl);
      const progress = $('[role="progressbar"]', actionBar);
      if (progress) {
        const max = Number(progress.getAttribute("aria-valuemax"));
        if (Number.isFinite(max) && max > 0) durationMs = Math.round(max);
        const totalMatch = String(progress.getAttribute("aria-valuetext") || "").match(/of\s+(.+)$/);
        if (totalMatch) duration = totalMatch[1].trim();
      }
    }
    const explicit = Boolean(
      $('[aria-label="Explicit"]') || /\bexplicit\b/i.test(actionBar?.textContent || ""),
    );
    const descPanel = $("#description-panel") || $('[aria-labelledby="description-tab"]');
    const description = descPanel
      ? $all("p", descPanel).map(text).filter(Boolean).join("\n\n")
      : "";
    const showIdMatch = ($('a[href*="/show/"]')?.getAttribute("href") || "").match(/\/show\/([A-Za-z0-9]+)/);
    const img =
      $('img[src*="scdn.co/image"]')?.src ||
      $('meta[property="og:image"]')?.content ||
      "";
    return {
      episodeId, url, episode, show, publisher: show,
      showId: showIdMatch ? showIdMatch[1] : "",
      date, duration, durationMs, explicit, description, image: img,
    };
  }

  // --- Related episodes from the visible episode list ---
  function extractRelatedEpisodes(limit = 25) {
    const list = $('[data-testid="episode-list"]') || document;
    const seen = new Set();
    const out = [];
    for (const a of $all('a[href*="/episode/"]', list)) {
      const href = a.getAttribute("href") || "";
      const idMatch = href.match(/\/episode\/([A-Za-z0-9]+)/);
      if (!idMatch) continue;
      const id = idMatch[1];
      if (id === currentEpisodeId || seen.has(id)) continue;
      seen.add(id);
      const row = a.closest("div, li") || a;
      const rowText = text(row);
      const title = a.getAttribute("aria-label") || text(a) || rowText.slice(0, 120);
      const durMatch = rowText.match(/\b\d{1,3}:\d{2}(?::\d{2})?\b/);
      const dateMatch = rowText.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/);
      out.push({
        title: title.trim().slice(0, 160) || "Untitled episode",
        url: `https://open.spotify.com/episode/${id}`,
        duration: durMatch ? durMatch[0] : "",
        date: dateMatch ? dateMatch[0] : "",
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  function transcriptTab() {
    return $('[data-testid="transcript-tab"]') || $("#transcript-tab");
  }

  function transcriptPanel() {
    return (
      $("#transcript-panel") ||
      $('[aria-labelledby="transcript-tab"]') ||
      $('[data-testid="transcript-panel"]')
    );
  }

  /**
   * Parse #transcript-panel via the shared, unit-tested helper (structure-
   * based, no hashed classes). Falls back to the local copy when helpers
   * fail to load.
   */
  function scrapeDomTranscript() {
    const panel = transcriptPanel();
    if (!panel) return { notice: "", segments: [] };
    if (H.scrapeSpotifyPanel) {
      try {
        return H.scrapeSpotifyPanel(panel);
      } catch (e) {
        console.warn("[Social Companion] shared panel parser failed:", e);
      }
    }
    const rows = Array.from(panel.children || []);
    const t = (row) => (row?.textContent || "").replace(/\s+/g, " ").trim();
    let notice = "";
    const segments = [];
    let speaker = "";
    for (const row of rows) {
      const line = t(row.querySelector('span[dir="auto"]') || row);
      if (!line) continue;
      if (/generated automatically/i.test(line) && line.length < 140) {
        notice = line;
        continue;
      }
      if (/^speaker \d+$/i.test(line)) {
        speaker = line.replace(/^speaker\s*/i, "Speaker ");
        continue;
      }
      segments.push({ startMs: null, speaker, text: line });
    }
    return { notice, segments };
  }

  async function ensureTranscriptTabLoaded(timeoutMs = 6000) {
    const tab = transcriptTab();
    if (!tab) return false;
    if (tab.getAttribute("aria-disabled") === "true") return false;
    if (tab.getAttribute("aria-selected") !== "true") {
      tab.click();
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { segments: segs } = scrapeDomTranscript();
      if (segs.length > 0) return true;
      await new Promise((r) => setTimeout(r, 350));
    }
    return Boolean(transcriptPanel());
  }

  async function fetchWebPlayerToken() {
    let res;
    try {
      res = await fetch(
        "https://open.spotify.com/get_access_token?reason=transport&productType=web-player",
        { credentials: "include" },
      );
    } catch (e) {
      const err = new Error("Transcript token request was blocked (content blocker or offline?).");
      err.code = "token-blocked";
      throw err;
    }
    if (!res.ok) {
      const action = (H.getTranscriptApiAction || (() => "retry"))(res.status);
      const err = new Error(
        action === "skip-api"
          ? "Transcript API unreachable here (tracker blocker or logged-out token endpoint) — using the page Transcript tab instead."
          : `Token request failed (${res.status})`,
      );
      err.code = action === "skip-api" ? "token-blocked" : "token-error";
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (!data?.accessToken) {
      const err = new Error("No Spotify web-player token (are you logged in?)");
      err.code = "auth";
      throw err;
    }
    return data.accessToken;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Nearest ancestor that actually scrolls (Spotify nests custom scrollers). */
  function scrollContainerOf(el) {
    let node = el?.parentElement || null;
    while (node && node !== document.body && node !== document.documentElement) {
      try {
        const style = getComputedStyle(node);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight + 20
        ) {
          return node;
        }
      } catch {}
      node = node.parentElement;
    }
    return document.scrollingElement || null;
  }

  /**
   * Step-scroll the transcript's scroll container top→bottom so Spotify
   * lazy-renders every cue row, then restore the top. Runs at most once per
   * episode automatically; manual Sync always re-runs it on demand.
   */
  async function autoScrollPanelToLoad(episodeId) {
    const panel = transcriptPanel();
    const scroller = panel ? scrollContainerOf(panel) : null;
    if (!panel || !scroller) return false;
    try {
      const step = Math.max(240, Math.floor((scroller.clientHeight || 600) * 0.8));
      const max = scroller.scrollHeight || 0;
      for (let y = 0; y <= max; y += step) {
        if (getEpisodeId(location.href) !== episodeId) return false;
        scroller.scrollTop = y;
        await sleep(220);
      }
      scroller.scrollTop = 0;
      await sleep(250);
      return true;
    } catch (e) {
      console.warn("[Social Companion] transcript auto-scroll failed:", e);
      return false;
    }
  }

  /**
   * Watch for the transcript panel to render (SPA navigation renders it
   * lazily) and auto-capture the moment rows appear — the Spotify
   * equivalent of YouTube's auto transcript sync.
   */
  function watchTranscriptPanel(episodeId) {
    if (_panelObserver) {
      _panelObserver.disconnect();
      _panelObserver = null;
    }
    const stopAfter = setTimeout(() => {
      if (_panelObserver) {
        _panelObserver.disconnect();
        _panelObserver = null;
      }
    }, 90000);
    _panelObserver = new MutationObserver(() => {
      if (getEpisodeId(location.href) !== episodeId || segments.length) {
        clearTimeout(stopAfter);
        if (_panelObserver) {
          _panelObserver.disconnect();
          _panelObserver = null;
        }
        return;
      }
      let parsed = null;
      try {
        parsed = scrapeDomTranscript();
      } catch {
        return;
      }
      if (parsed.segments.length > 0) {
        transcriptNotice = parsed.notice;
        segments = parsed.segments;
        setStatus("ready", `Transcript verified · ${parsed.segments.length} lines (page tab, auto-captured)`, "page transcript tab (untimed, speaker-grouped)");
        renderLines();
        clearTimeout(stopAfter);
        if (_panelObserver) {
          _panelObserver.disconnect();
          _panelObserver = null;
        }
      }
    });
    _panelObserver.observe(document.body, { childList: true, subtree: true });
  }

  async function fetchReadAlongTranscript(episodeId) {
    const token = await fetchWebPlayerToken();
    const res = await fetch(
      `https://spclient.wg.spotify.com/transcript-read-along/v2/episode/${encodeURIComponent(episodeId)}?format=json`,
      { headers: { authorization: `Bearer ${token}`, "app-platform": "WebPlayer" } },
    );
    if (res.status === 404) {
      const err = new Error("Spotify has no transcript for this episode.");
      err.code = "no-transcript";
      throw err;
    }
    if (res.status === 401 || res.status === 403) {
      const err = new Error("Transcript needs a logged-in Spotify session. Log in and retry.");
      err.code = "auth";
      throw err;
    }
    if (!res.ok) throw new Error(`Transcript request failed (${res.status})`);
    const json = await res.json();
    const parsed = (H.parseTranscriptReadAlong || (() => []))(json);
    return { segments: parsed, raw: json };
  }

  async function collectTranscript({ allowTabClick = true, autoScroll = false } = {}) {
    const episodeId = getEpisodeId(location.href);
    if (!episodeId) throw new Error("Open a Spotify episode first.");
    // 1) Timed read-along API first — it carries timestamps the DOM lacks.
    // Skipped entirely once this browser profile proves it unreachable (403 /
    // blocked token endpoint): the page Transcript tab is the path instead.
    if (apiBlockedForEpisode !== episodeId) {
      try {
        const { segments: apiSegs } = await fetchReadAlongTranscript(episodeId);
        if (apiSegs.length) {
          transcriptNotice = "";
          return { segments: apiSegs, source: "Spotify transcript API (timed)", status: `Transcript verified · ${apiSegs.length} timed lines` };
        }
      } catch (e) {
        if (e?.code === "no-transcript" || e?.code === "auth") throw e;
        if (e?.code === "token-blocked") {
          apiBlockedForEpisode = episodeId;
          console.warn("[Social Companion] transcript API unreachable, using page tab:", e.message);
        } else {
          console.warn("[Social Companion] Spotify transcript API failed, trying page tab:", e);
        }
      }
    }
    // 2) Rendered DOM tab (untimed, speaker-grouped) — auto-clicked like
    // YouTube's auto transcript sync, then step-scrolled so lazy rows render.
    if (allowTabClick) {
      try {
        await ensureTranscriptTabLoaded();
        if (autoScroll && autoScrolledFor !== episodeId) {
          autoScrolledFor = episodeId;
          await autoScrollPanelToLoad(episodeId);
        }
      } catch (e) {
        console.warn("[Social Companion] Spotify DOM transcript failed:", e);
      }
    }
    const { notice, segments: domSegs } = scrapeDomTranscript();
    if (domSegs.length) {
      transcriptNotice = notice;
      const via = apiBlockedForEpisode === episodeId
        ? "page transcript tab (untimed — transcript API blocked here, allow open.spotify.com in your content blocker for timed lines)"
        : "page transcript tab (untimed, speaker-grouped)";
      return { segments: domSegs, source: via, status: `Transcript verified · ${domSegs.length} lines (page tab, no timestamps)` };
    }
    const panel = transcriptPanel();
    const raw = panel ? (panel.textContent || "").replace(/\s+/g, " ").trim() : "";
    if (raw && raw.length > 80) {
      return { segments: [{ startMs: null, speaker: "", text: raw }], source: "page transcript tab (raw)", status: "Transcript captured without structure." };
    }
    throw new Error("No transcript found. Open the episode's Transcript tab while logged in, then Sync again.");
  }

  function hasTimestamp(seg) {
    return seg?.startMs !== null && seg?.startMs !== undefined &&
      Number.isFinite(Number(seg.startMs)) && Number(seg.startMs) >= 0;
  }

  function formatSegmentsPlain(segs) {
    const fmt = H.formatSpotifyTimestamp || ((ms) => String(ms));
    return segs.map((s) => {
      const prefix = s.speaker ? `**${s.speaker}:** ` : "";
      const ts = hasTimestamp(s) ? `[${fmt(s.startMs)}] ` : "";
      return `${ts}${prefix}${s.text}`;
    }).join("\n");
  }

  async function buildMarkdown() {
    const meta = extractSpotifyMetadata();
    const related = extractRelatedEpisodes();
    let statusLine = transcriptMeta.message;
    let source = transcriptMeta.source;
    try {
      if (!segments.length || transcriptMeta.videoId !== currentEpisodeId) {
        const out = await collectTranscript();
        segments = out.segments;
        source = out.source;
        statusLine = out.status;
        setStatus("ready", statusLine, source);
      }
    } catch (e) {
      if (e?.code === "no-transcript" || e?.code === "auth") setStatus("unavailable", e.message, "");
      else setStatus("error", e?.message || "Couldn't load this transcript.", "");
      statusLine = transcriptMeta.message;
      source = "";
    }
    let crossRef = null;
    try {
      const stored = await chrome.storage.local.get([`sc_spotify_match_${meta.episodeId}`]);
      crossRef = stored[`sc_spotify_match_${meta.episodeId}`] || null;
    } catch {}
    const markdown = (H.buildSpotifyMarkdown || ((m) => `# ${m.episode}`))(
      { ...meta, transcriptSource: source, transcriptStatus: transcriptMeta.status === "ready" ? statusLine : transcriptMeta.message, transcriptNotice },
      segments,
      { crossRef, related, capturedAt: new Date().toISOString() },
    );
    lastCapture = { episodeId: meta.episodeId, markdown, at: new Date().toISOString() };
    return { markdown, meta, related };
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

  function safeFilename(meta, ext = ".md") {
    const base = `${meta.show ? meta.show + " - " : ""}${meta.episode}`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 120) || "spotify-episode";
    return `${base}${ext}`;
  }

  // --- Message contract (mirrors YouTube so popup/background keep working) ---
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const route = currentRoute();
    if (route.kind === "playlist") {
      if (message.type === "sc_get_capture_status") {
        sendResponse({
          ok: true,
          videoId: route.id,
          title: (plMetaCache || extractPlaylistMetadata()).title,
          transcriptAvailable: plTracks.length > 0,
          platform: "spotify",
        });
        return;
      }
      if (message.type === "sc_get_current_markdown" || message.type === "sc_download_current_markdown") {
        (async () => {
          if (!plTracks.length) await backupPlaylist({ scroll: true });
          const meta = plMetaCache || extractPlaylistMetadata();
          return {
            markdown: (H.buildPlaylistMarkdown || ((m) => `# ${m.title}`))(meta, plTracks, { capturedAt: new Date().toISOString() }),
            meta,
          };
        })().then(({ markdown, meta }) => {
          if (message.type === "sc_download_current_markdown") {
            const base = (meta.title || "spotify-playlist").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
            downloadFile(`${base}.md`, markdown);
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: true, markdown, title: meta.title || "Spotify playlist", platform: "spotify" });
          }
        }).catch((e) => sendResponse({ ok: false, reason: e?.message || "Couldn't back up this playlist." }));
        return true;
      }
      if (message.type === "sc_download_current_transcript") {
        (async () => {
          if (!plTracks.length) await backupPlaylist({ scroll: true });
          const meta = plMetaCache || extractPlaylistMetadata();
          const base = (meta.title || "spotify-playlist").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
          downloadFile(`${base}.csv`, playlistToCsv(plTracks), "text/csv");
          return { ok: true };
        })().then(sendResponse).catch((e) => sendResponse({ ok: false, reason: e?.message || "Couldn't download this track list." }));
        return true;
      }
      return;
    }
    if (route.kind === "track") {
      if (message.type === "sc_get_capture_status") {
        sendResponse({
          ok: true,
          videoId: route.id,
          title: (lyricMetaCache || extractTrackMetadata()).title,
          transcriptAvailable: lyricLines.length > 0,
          platform: "spotify",
        });
        return;
      }
      if (message.type === "sc_get_current_markdown" || message.type === "sc_download_current_markdown" || message.type === "sc_download_current_transcript") {
        (async () => {
          if (!lyricLines.length) {
            const out = await collectLyrics();
            lyricLines = out.lines;
            setLyricStatus("ready", out.status, { source: out.source, synced: out.synced });
            renderLyricLines();
          }
          const meta = lyricMetaCache || extractTrackMetadata();
          const md = (H.buildLyricsMarkdown || ((m) => `# ${m.title}`))(meta, lyricLines, { synced: lyricStatus.synced, source: lyricStatus.source, capturedAt: new Date().toISOString() });
          return { md, meta };
        })().then(({ md, meta }) => {
          if (message.type === "sc_get_current_markdown") {
            sendResponse({ ok: true, markdown: md, title: meta.title || "Spotify lyrics", platform: "spotify" });
          } else {
            const base = `${(meta.artists[0] ? meta.artists[0] + " - " : "")}${meta.title}`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 100) || "spotify-lyrics";
            downloadFile(message.type === "sc_download_current_transcript" ? `${base}.lyrics.txt` : `${base}.md`, message.type === "sc_download_current_transcript" ? `${meta.title}\n${meta.url}\n\n${lyricLines.map((l) => (l && typeof l === "object" ? l.text : String(l))).join("\n")}\n` : md, message.type === "sc_download_current_transcript" ? "text/plain" : "text/markdown");
            sendResponse({ ok: true });
          }
        }).catch((e) => sendResponse({ ok: false, reason: e?.message || "Couldn't capture these lyrics." }));
        return true;
      }
      return;
    }
    if (message.type === "sc_get_capture_status") {
      const episodeId = getEpisodeId(location.href);
      const ready = Boolean(episodeId) && segments.length > 0 && transcriptMeta.videoId === episodeId && transcriptMeta.status === "ready";
      sendResponse({
        ok: true,
        videoId: episodeId, // popup checks `videoId`; map episode -> videoId
        episodeId,
        title: episodeId ? extractSpotifyMetadata().episode : "",
        transcriptAvailable: ready,
        platform: "spotify",
      });
      return;
    }
    if (message.type === "sc_get_current_markdown") {
      if (!getEpisodeId(location.href)) {
        sendResponse({ ok: false, reason: "Open a Spotify episode first." });
        return;
      }
      buildMarkdown().then(({ markdown, meta }) => {
        sendResponse({ ok: true, markdown, title: meta.episode || "Spotify capture", platform: "spotify" });
      }).catch((e) => sendResponse({ ok: false, reason: e?.message || "Could not prepare this Spotify capture." }));
      return true;
    }
    if (message.type === "sc_download_current_markdown") {
      buildMarkdown().then(({ markdown, meta }) => {
        downloadFile(safeFilename(meta), markdown);
        sendResponse({ ok: true });
      }).catch((e) => sendResponse({ ok: false, reason: e?.message || "Couldn't save this episode." }));
      return true;
    }
    if (message.type === "sc_download_current_transcript") {
      (async () => {
        if (!segments.length || transcriptMeta.videoId !== currentEpisodeId) {
          const out = await collectTranscript();
          segments = out.segments;
          setStatus("ready", out.status, out.source);
        }
        const meta = extractSpotifyMetadata();
        const head = `${meta.episode}\n${meta.url}${transcriptNotice ? `\n\nNote: ${transcriptNotice}` : ""}\n\n`;
        downloadFile(safeFilename(meta, ".transcript.txt"), head + formatSegmentsPlain(segments) + "\n", "text/plain");
        return { ok: true };
      })().then(sendResponse).catch((e) => sendResponse({ ok: false, reason: e?.message || "Couldn't download this transcript." }));
      return true;
    }
    if (message.type === "sc_spotify_save_match") {
      const episodeId = getEpisodeId(location.href);
      chrome.storage.local.set({ [`sc_spotify_match_${episodeId}`]: message.match }).then(() => sendResponse({ ok: true }));
      return true;
    }
  });

  // --- YT-notes-style widget: Transcript / Details / Related tabs ---
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  function injectWidget() {
    if (document.getElementById("sc-spotify-widget")) return;
    const el = document.createElement("div");
    el.id = "sc-spotify-widget";
    // Floating panel (mirrors the X/Reddit companion): draggable by its
    // header, collapsible, position persisted — never blocks page content.
    el.style.cssText = "position:fixed;bottom:96px;right:24px;width:380px;max-height:540px;display:flex;flex-direction:column;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(18,18,22,.97);color:#f8fafc;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.45);overflow:hidden;z-index:9999;";
    el.innerHTML = `
      <div id="sc-sp-head" data-sc-head style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:#24212d;border-bottom:1px solid rgba(167,139,250,.28);cursor:move;user-select:none;-webkit-user-select:none;">
        <strong style="font-size:13px;">🎙️ Spotify capture</strong>
        <span style="display:flex;align-items:center;gap:6px;">
          <span id="sc-sp-status" style="font-size:11px;padding:3px 8px;border:1px solid #555;border-radius:999px;white-space:nowrap;">…</span>
          <button id="sc-sp-min" data-sc-min title="Collapse / expand" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:13px;line-height:1;cursor:pointer;">–</button>
          <button id="sc-sp-hide" data-sc-hide title="Hide until next episode" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:12px;line-height:1;cursor:pointer;">×</button>
        </span>
      </div>
      <div id="sc-sp-body" data-sc-body style="display:flex;flex-direction:column;min-height:0;overflow:hidden;"></div>`;
    document.body.appendChild(el);

    const body = el.querySelector("#sc-sp-body");
    body.innerHTML = `
      <div style="display:flex;gap:4px;padding:6px;background:rgba(0,0,0,.2);">
        <button data-sc-tab="transcript" style="flex:1;padding:9px;border:none;border-radius:8px;background:#1db954;color:#04120a;font-weight:800;font-size:12px;cursor:pointer;">Transcript</button>
        <button data-sc-tab="details" style="flex:1;padding:9px;border:none;border-radius:8px;background:transparent;color:#94a3b8;font-weight:700;font-size:12px;cursor:pointer;">Details</button>
        <button data-sc-tab="related" style="flex:1;padding:9px;border:none;border-radius:8px;background:transparent;color:#94a3b8;font-weight:700;font-size:12px;cursor:pointer;">Related</button>
      </div>
      <div id="sc-sp-pane-transcript" style="padding:12px 14px;overflow-y:auto;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <button id="sc-sp-sync" style="padding:7px 11px;border-radius:8px;border:none;background:#1db954;color:#04120a;font-weight:800;font-size:12px;cursor:pointer;">Sync transcript</button>
          <button id="sc-sp-select" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;" title="Select the transcript text on the page so you can copy part of it">Select text</button>
          <button id="sc-sp-copy" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Copy</button>
          <button id="sc-sp-dl" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Download .md</button>
        </div>
        <input id="sc-sp-search" placeholder="Search transcript…" style="width:100%;box-sizing:border-box;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);color:inherit;font-size:12px;outline:none;margin-bottom:8px;">
        <div id="sc-sp-meta" style="font-size:11px;opacity:.75;margin-bottom:8px;">Loading episode metadata…</div>
        <div id="sc-sp-lines" style="max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-size:12px;display:flex;flex-direction:column;gap:6px;">Not synced yet.</div>
      </div>
      <div id="sc-sp-pane-details" style="display:none;padding:12px 14px;font-size:12px;overflow-y:auto;"></div>
      <div id="sc-sp-pane-related" style="display:none;padding:12px 14px;font-size:12px;overflow-y:auto;"></div>
      <div style="font-size:11px;opacity:.6;padding:0 14px 12px;">Transcripts need the episode's Transcript tab (login). Text selection is unlocked inside transcript/description. Nothing private is exported — only visible episode text.</div>`;

    const tabs = $all("[data-sc-tab]", el);
    const panes = {
      transcript: $("#sc-sp-pane-transcript", el),
      details: $("#sc-sp-pane-details", el),
      related: $("#sc-sp-pane-related", el),
    };
    tabs.forEach((btn) => {
      btn.onclick = () => {
        tabs.forEach((b) => {
          const active = b === btn;
          b.style.background = active ? "#1db954" : "transparent";
          b.style.color = active ? "#04120a" : "#94a3b8";
        });
        Object.entries(panes).forEach(([name, pane]) => {
          if (pane) pane.style.display = name === btn.dataset.scTab ? "block" : "none";
        });
        if (btn.dataset.scTab === "details") renderDetailsPane();
        if (btn.dataset.scTab === "related") renderRelatedPane();
      };
    });

    el.querySelector("#sc-sp-sync").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.textContent = "Syncing…";
      btn.disabled = true;
      try {
        const out = await collectTranscript({ allowTabClick: true, autoScroll: true });
        segments = out.segments;
        setStatus("ready", out.status, out.source);
        renderLines();
      } catch (err) {
        setStatus(err?.code === "auth" || err?.code === "no-transcript" ? "unavailable" : "error", err?.message || "Sync failed.");
        renderLines();
      } finally {
        btn.textContent = "Sync transcript";
        btn.disabled = false;
      }
    };
    el.querySelector("#sc-sp-select").onclick = () => {
      const panel = transcriptPanel();
      if (!panel) {
        setStatus(transcriptMeta.status, "Open the Transcript tab first, then Select text.");
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(panel);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      panel.scrollIntoView({ block: "center" });
    };
    el.querySelector("#sc-sp-copy").onclick = async () => {
      try {
        const { markdown } = await buildMarkdown();
        await navigator.clipboard.writeText(markdown);
        scToast(`📋 Episode capture copied (${segments.length} transcript lines).`);
        renderLines();
      } catch (err) {
        scToast(`❌ Copy failed — ${err?.message || "try Download instead"}.`);
      }
    };
    el.querySelector("#sc-sp-dl").onclick = async () => {
      try {
        const { markdown, meta } = await buildMarkdown();
        downloadFile(safeFilename(meta), markdown);
      } catch (err) {
        scToast(`❌ Download failed — ${err?.message || "retry"}.`);
      }
    };
    el.querySelector("#sc-sp-search").oninput = (e) => renderLines(e.target.value);
    wireFloatingChrome(el);
    renderStatus();
  }

  // Draggable / collapsible / hideable floating chrome with persisted geometry.
  function wireFloatingChrome(el, posKey = "sc_spotify_widget_pos", collapsedKey = "sc_spotify_widget_collapsed") {
    const head = el.querySelector("[data-sc-head]");
    const body = el.querySelector("[data-sc-body]");
    const minBtn = el.querySelector("[data-sc-min]");
    const hideBtn = el.querySelector("[data-sc-hide]");
    try {
      chrome.storage.local.get([posKey, collapsedKey], (data) => {
        const pos = data?.[posKey];
        if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
          el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, pos.left))}px`;
          el.style.top = `${Math.max(0, Math.min(window.innerHeight - 60, pos.top))}px`;
          el.style.right = "auto";
          el.style.bottom = "auto";
        }
        if (data?.[collapsedKey] && body && minBtn) {
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
          chrome.storage.local.set({ [collapsedKey]: collapsed });
        } catch {}
      };
    }
    if (hideBtn) {
      hideBtn.onclick = () => el.remove();
    }
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
        chrome.storage.local.set({ [posKey]: { left: Math.round(rect.left), top: Math.round(rect.top) } });
      } catch {}
    });
  }

  function renderLines(filter = "") {
    const box = document.getElementById("sc-sp-lines");
    if (!box) return;
    const q = String(filter || "").toLowerCase().trim();
    const list = q ? segments.filter((s) => (`${s.speaker} ${s.text}`).toLowerCase().includes(q)) : segments;
    if (!list.length) {
      box.textContent = segments.length ? "No lines match." : (transcriptMeta.message || "Not synced yet.");
      return;
    }
    const fmt = H.formatSpotifyTimestamp || ((ms) => String(ms));
    box.innerHTML = "";
    let lastSpeaker = null;
    for (const s of list.slice(0, 400)) {
      if (s.speaker && s.speaker !== lastSpeaker && !q) {
        const h = document.createElement("div");
        h.style.cssText = "font-weight:800;color:#1db954;margin-top:4px;";
        h.textContent = s.speaker;
        box.appendChild(h);
        lastSpeaker = s.speaker;
      }
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;line-height:1.45;";
      if (hasTimestamp(s)) {
        const t = document.createElement("span");
        t.style.cssText = "font-weight:800;color:#1db954;min-width:42px;";
        t.textContent = fmt(s.startMs);
        row.appendChild(t);
      }
      const p = document.createElement("span");
      p.textContent = (q && s.speaker ? `${s.speaker}: ` : "") + s.text;
      row.appendChild(p);
      box.appendChild(row);
    }
    if (list.length > 400) {
      const more = document.createElement("div");
      more.style.opacity = "0.6";
      more.textContent = `… ${list.length - 400} more lines (use Download .md for all)`;
      box.appendChild(more);
    }
  }

  function renderDetailsPane() {
    const pane = document.getElementById("sc-sp-pane-details");
    if (!pane) return;
    const m = extractSpotifyMetadata();
    pane.innerHTML = `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;">
        <span style="opacity:.6;">Episode</span><strong>${esc(m.episode)}</strong>
        <span style="opacity:.6;">Show</span><span>${esc(m.show || "—")}</span>
        <span style="opacity:.6;">Published</span><span>${esc(m.date || "—")}</span>
        <span style="opacity:.6;">Duration</span><span>${esc(m.duration || (m.durationMs ? String(m.durationMs) : "—"))}</span>
        <span style="opacity:.6;">Explicit</span><span>${m.explicit ? "Yes" : "No"}</span>
        <span style="opacity:.6;">ID</span><span style="font-family:monospace;">${esc(m.episodeId)}</span>
      </div>
      <div style="margin-top:8px;"><a href="${esc(m.url)}" target="_blank" style="color:#1db954;">Open on Spotify ↗</a></div>
      ${m.description ? `<div style="margin-top:8px;white-space:pre-wrap;opacity:.9;">${esc(m.description).slice(0, 1200)}</div>` : ""}
      ${transcriptNotice ? `<div style="margin-top:8px;opacity:.7;font-style:italic;">Note: ${esc(transcriptNotice)}</div>` : ""}`;
  }

  function renderRelatedPane() {
    const pane = document.getElementById("sc-sp-pane-related");
    if (!pane) return;
    const rel = extractRelatedEpisodes();
    if (!rel.length) {
      pane.textContent = "No other episodes visible. Scroll the episode list on the page, then reopen this tab.";
      return;
    }
    pane.innerHTML = "";
    const head = document.createElement("div");
    head.style.opacity = "0.7";
    head.style.marginBottom = "6px";
    head.textContent = `${rel.length} visible episodes (scroll page list for more):`;
    pane.appendChild(head);
    for (const r of rel) {
      const row = document.createElement("div");
      row.style.cssText = "padding:6px 0;border-top:1px solid rgba(255,255,255,.08);";
      const a = document.createElement("a");
      a.href = r.url;
      a.style.color = "#1db954";
      a.textContent = r.title;
      row.appendChild(a);
      const sub = document.createElement("div");
      sub.style.opacity = "0.65";
      sub.textContent = [r.date, r.duration].filter(Boolean).join(" · ");
      row.appendChild(sub);
      pane.appendChild(row);
    }
  }

  function renderStatus() {
    const badge = document.getElementById("sc-sp-status");
    const metaLine = document.getElementById("sc-sp-meta");
    const palette = { ready: "#34d399", waiting: "#fbbf24", unavailable: "#94a3b8", error: "#fb7185", idle: "#94a3b8" };
    const color = palette[transcriptMeta.status] || "#94a3b8";
    if (badge) {
      badge.textContent =
        transcriptMeta.status === "ready" ? "Transcript verified" :
        transcriptMeta.status === "waiting" ? "Checking…" :
        transcriptMeta.status === "unavailable" ? "No transcript" :
        transcriptMeta.status === "error" ? "Error" : "Not synced";
      badge.style.color = color;
      badge.style.borderColor = `${color}66`;
    }
    if (metaLine && currentEpisodeId) {
      try {
        const m = extractSpotifyMetadata();
        metaLine.textContent = `${m.episode}${m.show ? ` • ${m.show}` : ""}${m.date ? ` • ${m.date}` : ""}${m.duration ? ` • ${m.duration}` : ""} — ${transcriptMeta.message}`;
      } catch {}
    }
  }

  /* ---------------- Playlist route (/playlist/<id>) ---------------- */

  const getPlaylistId = H.getSpotifyPlaylistId || ((u) => {
    const m = String(u || location.href).match(/playlist\/([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  });
  const getTrackId = H.getSpotifyTrackId || ((u) => {
    const m = String(u || location.href).match(/track\/([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  });

  let currentPlId = "";
  let plTracks = [];
  let plMetaCache = null;
  let plStatus = { status: "idle", message: "Playlist detected." };

  function extractPlaylistMetadata() {
    const playlistId = getPlaylistId(location.href);
    const url = `https://open.spotify.com/playlist/${playlistId}`;
    const title =
      text($('[data-testid="entityTitle"] h1')) ||
      document.title.replace(/\s*[•·|-]\s*Spotify\s*$/i, "").trim() ||
      "Spotify playlist";
    const owner = text($('a[data-testid="creator-link"]')) || "";
    const headerScope =
      $('[data-testid="entityTitle"]')?.closest("div")?.parentElement || document;
    const headerText = text(headerScope).slice(0, 2000);
    const countMatch = headerText.match(/([\d,]+)\s+songs?/);
    const lenMatch = headerText.match(/about\s+(.+?hr.+?min|.+?min.+?sec)/);
    const descEl = headerScope.querySelector("p, span");
    return {
      playlistId, url, title, owner,
      songCount: countMatch ? countMatch[0] : "",
      totalDuration: lenMatch ? lenMatch[0].replace(/^about\s+/, "") : "",
      description: "",
    };
  }

  function playlistGrid() {
    return $('[data-testid="playlist-tracklist"]');
  }

  function scrapePlaylistGrid() {
    const grid = playlistGrid();
    if (!grid || !H.scrapePlaylistRows) return [];
    try {
      return H.scrapePlaylistRows(grid);
    } catch (e) {
      console.warn("[Social Companion] playlist scrape failed:", e);
      return [];
    }
  }

  /** Step-scroll the grid until the row count stabilizes (3 stale passes). */
  async function autoScrollGridToLoad(playlistId) {
    const grid = playlistGrid();
    const scroller = grid ? scrollContainerOf(grid) : null;
    if (!grid || !scroller) return scrapePlaylistGrid();
    let lastCount = -1;
    let stale = 0;
    for (let pass = 0; pass < 40; pass++) {
      if (getPlaylistId(location.href) !== playlistId) break;
      scroller.scrollTop = scroller.scrollHeight;
      await sleep(450);
      const rows = scrapePlaylistGrid();
      if (rows.length === lastCount) {
        stale++;
        if (stale >= 3) break;
      } else {
        stale = 0;
        lastCount = rows.length;
      }
    }
    scroller.scrollTop = 0;
    await sleep(250);
    return scrapePlaylistGrid();
  }

  function setPlStatus(status, message) {
    plStatus = { status, message };
    const badge = document.getElementById("sc-sp-pl-status");
    const metaLine = document.getElementById("sc-sp-pl-meta");
    const palette = { ready: "#34d399", waiting: "#fbbf24", unavailable: "#94a3b8", error: "#fb7185", idle: "#94a3b8" };
    if (badge) {
      const color = palette[status] || "#94a3b8";
      badge.textContent = status === "ready" ? `${plTracks.length} tracks` : message.slice(0, 28);
      badge.style.color = color;
      badge.style.borderColor = `${color}66`;
    }
    if (metaLine && plMetaCache) {
      metaLine.textContent = `${plMetaCache.title}${plMetaCache.owner ? ` • ${plMetaCache.owner}` : ""} — ${message}`;
    }
  }

  function playlistToCsv(tracks) {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = ["Position,Title,Artists,Album,Duration,URL"];
    for (const t of tracks) {
      rows.push([t.position, q(t.title), q((t.artists || []).join("; ")), q(t.album || ""), t.duration || "", t.url || ""].join(","));
    }
    return rows.join("\n");
  }

  async function backupPlaylist({ scroll = true } = {}) {
    const playlistId = getPlaylistId(location.href);
    if (!playlistId) throw new Error("Open a Spotify playlist first.");
    plMetaCache = extractPlaylistMetadata();
    setPlStatus("waiting", "Reading visible tracks…");
    const tracks = scroll
      ? await autoScrollGridToLoad(playlistId)
      : scrapePlaylistGrid();
    if (getPlaylistId(location.href) !== playlistId) throw new Error("Navigated away mid-backup.");
    plTracks = tracks;
    if (!tracks.length) {
      setPlStatus("unavailable", "No rows rendered — scroll the list, then Backup again.");
    } else {
      setPlStatus("ready", `Backed up ${tracks.length} tracks.`);
    }
    renderPlTracks();
    return { meta: plMetaCache, tracks };
  }

  function renderPlTracks() {
    const box = document.getElementById("sc-sp-pl-lines");
    if (!box) return;
    if (!plTracks.length) {
      box.textContent = plStatus.message || "Not backed up yet.";
      return;
    }
    box.innerHTML = "";
    for (const t of plTracks.slice(0, 300)) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;line-height:1.4;";
      const n = document.createElement("span");
      n.style.cssText = "opacity:.55;min-width:30px;text-align:right;";
      n.textContent = `${t.position}.`;
      const p = document.createElement("span");
      p.textContent = `${t.title}${t.artists?.length ? ` — ${t.artists.join(", ")}` : ""}${t.duration ? ` (${t.duration})` : ""}${t.explicit ? " 🅴" : ""}`;
      row.append(n, p);
      box.appendChild(row);
    }
    if (plTracks.length > 300) {
      const more = document.createElement("div");
      more.style.opacity = "0.6";
      more.textContent = `… ${plTracks.length - 300} more (use Download for all)`;
      box.appendChild(more);
    }
  }

  function injectPlaylistWidget() {
    if (document.getElementById("sc-spotify-pl-widget")) return;
    const el = document.createElement("div");
    el.id = "sc-spotify-pl-widget";
    el.style.cssText = "position:fixed;bottom:96px;right:24px;width:380px;max-height:540px;display:flex;flex-direction:column;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(18,18,22,.97);color:#f8fafc;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.45);overflow:hidden;z-index:9999;";
    el.innerHTML = `
      <div data-sc-head style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:#24212d;border-bottom:1px solid rgba(167,139,250,.28);cursor:move;user-select:none;-webkit-user-select:none;">
        <strong style="font-size:13px;">🎵 Playlist backup</strong>
        <span style="display:flex;align-items:center;gap:6px;">
          <span id="sc-sp-pl-status" style="font-size:11px;padding:3px 8px;border:1px solid #555;border-radius:999px;white-space:nowrap;">…</span>
          <button data-sc-min title="Collapse / expand" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:13px;line-height:1;cursor:pointer;">–</button>
          <button data-sc-hide title="Hide until next playlist" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:12px;line-height:1;cursor:pointer;">×</button>
        </span>
      </div>
      <div data-sc-body style="display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:12px 14px;gap:8px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button id="sc-sp-pl-backup" style="padding:7px 11px;border-radius:8px;border:none;background:#1db954;color:#04120a;font-weight:800;font-size:12px;cursor:pointer;">Backup tracks</button>
          <button id="sc-sp-pl-copy" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Copy MD</button>
          <button id="sc-sp-pl-csv" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">CSV</button>
          <button id="sc-sp-pl-dl" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Download .md</button>
        </div>
        <div id="sc-sp-pl-meta" style="font-size:11px;opacity:.75;">Loading playlist…</div>
        <div id="sc-sp-pl-lines" style="max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-size:12px;display:flex;flex-direction:column;gap:5px;">Not backed up yet.</div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#sc-sp-pl-backup").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.textContent = "Backing up…";
      btn.disabled = true;
      try {
        await backupPlaylist({ scroll: true });
      } catch (err) {
        setPlStatus("error", err?.message || "Backup failed.");
        renderPlTracks();
      } finally {
        btn.textContent = "Backup tracks";
        btn.disabled = false;
      }
    };
    el.querySelector("#sc-sp-pl-copy").onclick = async () => {
      try {
        if (!plTracks.length) await backupPlaylist({ scroll: false }).catch(() => {});
        const md = (H.buildPlaylistMarkdown || ((m) => `# ${m.title}`))(plMetaCache || extractPlaylistMetadata(), plTracks, { capturedAt: new Date().toISOString() });
        await navigator.clipboard.writeText(md);
        setPlStatus(plTracks.length ? "ready" : plStatus.status, plTracks.length ? `Copied ${plTracks.length} tracks.` : plStatus.message);
        scToast(plTracks.length ? `📋 Playlist copied (${plTracks.length} tracks).` : "⚠️ Nothing to copy yet — press Backup tracks.");
      } catch (err) {
        scToast(`❌ Copy failed — ${err?.message || "try Download instead"}.`);
      }
    };
    const downloadPl = async (kind) => {
      try {
        if (!plTracks.length) await backupPlaylist({ scroll: true }).catch(() => {});
        if (!plTracks.length) {
          scToast("⚠️ Nothing to download yet — press Backup tracks.");
          return;
        }
        const meta = plMetaCache || extractPlaylistMetadata();
        const base = (meta.title || "spotify-playlist").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
        if (kind === "csv") {
          downloadFile(`${base}.csv`, playlistToCsv(plTracks), "text/csv");
        } else {
          downloadFile(`${base}.md`, (H.buildPlaylistMarkdown || ((m) => `# ${m.title}`))(meta, plTracks, { capturedAt: new Date().toISOString() }));
        }
      } catch (err) {
        scToast(`❌ Download failed — ${err?.message || "retry"}.`);
      }
    };
    el.querySelector("#sc-sp-pl-csv").onclick = () => downloadPl("csv");
    el.querySelector("#sc-sp-pl-dl").onclick = () => downloadPl("md");
    wireFloatingChrome(el, "sc_spotify_pl_pos", "sc_spotify_pl_collapsed");
    setPlStatus("idle", "Playlist detected.");
  }

  /* ---------------- Track route (/track/<id>) — lyrics ---------------- */

  let currentTrId = "";
  let lyricLines = []; // strings, or {startMs,text} when synced
  let lyricMetaCache = null;
  let lyricStatus = { status: "idle", message: "Track detected.", source: "", synced: false };

  function extractTrackMetadata() {
    const trackId = getTrackId(location.href);
    const url = `https://open.spotify.com/track/${trackId}`;
    const header = $('[data-testid="entityTitle"]')?.closest("div") || document;
    const title =
      text($('[data-testid="entityTitle"] h1')) ||
      document.title.replace(/\s*[•·|-]\s*Spotify\s*$/i, "").trim() ||
      "Spotify track";
    const artists = Array.from(header.querySelectorAll('a[href^="/artist/"]'))
      .map((a) => text(a)).filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 6);
    const headerText = text(header).slice(0, 1200);
    const statMatch = headerText.match(/(\d{1,3}:\d{2})\s*•\s*([\d,]+)/);
    const albumLink = header.querySelector('a[href^="/album/"]');
    return {
      trackId, url, title, artists,
      album: albumLink ? text(albumLink) : "",
      duration: statMatch ? statMatch[1] : "",
      playCount: statMatch ? statMatch[2] : "",
      provider: "",
    };
  }

  function findLyricsSection() {
    const heads = $all("h1, h2, h3").filter((h) => text(h).toLowerCase() === "lyrics");
    for (const h of heads) {
      let node = h.parentElement;
      for (let depth = 0; depth < 4 && node && node !== document.body; depth++) {
        const kids = Array.from(node.children || {}).length ? Array.from(node.children) : [];
        const lineCount = kids.filter((k) => text(k).length > 1).length;
        if (lineCount >= 3) return node;
        node = node.parentElement;
      }
    }
    return null;
  }

  function expandLyricsSection(section) {
    if (!section) return;
    const btn = Array.from(section.querySelectorAll("button")).find((b) => /show more|see more|expand/i.test(b.textContent || ""));
    if (btn) {
      try {
        btn.click();
      } catch {}
    }
  }

  function unlockSelection(el) {
    if (!el) return;
    try {
      el.style.userSelect = "text";
      el.style.webkitUserSelect = "text";
      Array.from(el.querySelectorAll("*")).forEach((n) => {
        n.style.userSelect = "text";
        n.style.webkitUserSelect = "text";
      });
    } catch {}
  }

  async function fetchSyncedLyrics(trackId) {
    let token;
    try {
      token = await fetchWebPlayerToken();
    } catch (e) {
      if (e?.code === "token-blocked") {
        const err = new Error("Lyrics API unreachable here (content blocker?) — reading the page Lyrics section instead.");
        err.code = "token-blocked";
        throw err;
      }
      throw e;
    }
    const res = await fetch(
      `https://spclient.wg.spotify.com/color-lyrics/v2/track/${encodeURIComponent(trackId)}?format=json&vocalRemoval=false`,
      { headers: { authorization: `Bearer ${token}`, "app-platform": "WebPlayer" } },
    );
    if (res.status === 404) {
      const err = new Error("Spotify has no lyrics for this track.");
      err.code = "no-lyrics";
      throw err;
    }
    if (res.status === 401 || res.status === 403) {
      const err = new Error("Lyrics need a logged-in Spotify session. Log in and retry.");
      err.code = "auth";
      throw err;
    }
    if (!res.ok) throw new Error(`Lyrics request failed (${res.status})`);
    const json = await res.json();
    const parsed = (H.parseColorLyrics || (() => []))(json);
    return { lines: parsed, provider: "Musixmatch via Spotify" };
  }

  function setLyricStatus(status, message, extra = {}) {
    lyricStatus = { status, message, ...extra };
    const badge = document.getElementById("sc-sp-ly-status");
    const palette = { ready: "#34d399", waiting: "#fbbf24", unavailable: "#94a3b8", error: "#fb7185", idle: "#94a3b8" };
    if (badge) {
      const color = palette[status] || "#94a3b8";
      badge.textContent = status === "ready" ? "Lyrics ready" : message.slice(0, 30);
      badge.style.color = color;
      badge.style.borderColor = `${color}66`;
    }
    const metaLine = document.getElementById("sc-sp-ly-meta");
    if (metaLine && lyricMetaCache) {
      metaLine.textContent = `${lyricMetaCache.title}${lyricMetaCache.artists?.length ? ` • ${lyricMetaCache.artists.join(", ")}` : ""} — ${message}`;
    }
  }

  async function collectLyrics() {
    const trackId = getTrackId(location.href);
    if (!trackId) throw new Error("Open a Spotify track first.");
    lyricMetaCache = extractTrackMetadata();
    // 1) Synced API first (timestamps) — skipped when the token endpoint is
    // known-blocked in this profile.
    if (apiBlockedForEpisode !== `track:${trackId}`) {
      try {
        const { lines, provider } = await fetchSyncedLyrics(trackId);
        if (lines.length) {
          lyricMetaCache.provider = provider;
          return { lines, synced: true, source: "Spotify synced lyrics", status: `Lyrics ready · ${lines.length} synced lines` };
        }
      } catch (e) {
        if (e?.code === "no-lyrics" || e?.code === "auth") throw e;
        if (e?.code === "token-blocked") {
          apiBlockedForEpisode = `track:${trackId}`;
          console.warn("[Social Companion] lyrics API unreachable, using page section:", e.message);
        } else {
          console.warn("[Social Companion] synced lyrics failed, trying page section:", e);
        }
      }
    }
    // 2) Visible Lyrics section on the track page.
    const section = findLyricsSection();
    if (section) {
      expandLyricsSection(section);
      await sleep(600);
      unlockSelection(section);
      const lines = (H.extractLyricsLines || (() => []))(section);
      if (lines.length) {
        return { lines, synced: false, source: "page lyrics section", status: `Lyrics ready · ${lines.length} lines (page section)` };
      }
    }
    throw new Error("No lyrics found. Spotify shows lyrics only for tracks that have them (login may be required).");
  }

  function renderLyricLines() {
    const box = document.getElementById("sc-sp-ly-lines");
    if (!box) return;
    if (!lyricLines.length) {
      box.textContent = lyricStatus.message || "Not synced yet.";
      return;
    }
    const fmt = H.formatSpotifyTimestamp || ((ms) => String(ms));
    box.innerHTML = "";
    for (const l of lyricLines.slice(0, 300)) {
      const row = document.createElement("div");
      row.style.lineHeight = "1.45";
      if (l && typeof l === "object") {
        row.textContent = lyricStatus.synced && l.startMs != null ? `[${fmt(l.startMs)}] ${l.text}` : l.text;
      } else {
        row.textContent = String(l);
      }
      box.appendChild(row);
    }
    if (lyricLines.length > 300) {
      const more = document.createElement("div");
      more.style.opacity = "0.6";
      more.textContent = `… ${lyricLines.length - 300} more (use Download for all)`;
      box.appendChild(more);
    }
  }

  function injectLyricsWidget() {
    if (document.getElementById("sc-spotify-ly-widget")) return;
    const el = document.createElement("div");
    el.id = "sc-spotify-ly-widget";
    el.style.cssText = "position:fixed;bottom:96px;right:24px;width:380px;max-height:540px;display:flex;flex-direction:column;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(18,18,22,.97);color:#f8fafc;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.45);overflow:hidden;z-index:9999;";
    el.innerHTML = `
      <div data-sc-head style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;background:#24212d;border-bottom:1px solid rgba(167,139,250,.28);cursor:move;user-select:none;-webkit-user-select:none;">
        <strong style="font-size:13px;">🎤 Lyrics capture</strong>
        <span style="display:flex;align-items:center;gap:6px;">
          <span id="sc-sp-ly-status" style="font-size:11px;padding:3px 8px;border:1px solid #555;border-radius:999px;white-space:nowrap;">…</span>
          <button data-sc-min title="Collapse / expand" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:13px;line-height:1;cursor:pointer;">–</button>
          <button data-sc-hide title="Hide until next track" style="width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-size:12px;line-height:1;cursor:pointer;">×</button>
        </span>
      </div>
      <div data-sc-body style="display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:12px 14px;gap:8px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button id="sc-sp-ly-sync" style="padding:7px 11px;border-radius:8px;border:none;background:#1db954;color:#04120a;font-weight:800;font-size:12px;cursor:pointer;">Sync lyrics</button>
          <button id="sc-sp-ly-copy" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Copy</button>
          <button id="sc-sp-ly-dl" style="padding:7px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;font-weight:700;font-size:12px;cursor:pointer;">Download .md</button>
        </div>
        <div id="sc-sp-ly-meta" style="font-size:11px;opacity:.75;">Loading track…</div>
        <div id="sc-sp-ly-lines" style="max-height:280px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-size:12px;display:flex;flex-direction:column;gap:4px;">Not synced yet.</div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#sc-sp-ly-sync").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.textContent = "Syncing…";
      btn.disabled = true;
      try {
        const out = await collectLyrics();
        lyricLines = out.lines;
        setLyricStatus("ready", out.status, { source: out.source, synced: out.synced });
        renderLyricLines();
      } catch (err) {
        setLyricStatus(err?.code === "auth" || err?.code === "no-lyrics" ? "unavailable" : "error", err?.message || "Sync failed.");
        renderLyricLines();
      } finally {
        btn.textContent = "Sync lyrics";
        btn.disabled = false;
      }
    };
    el.querySelector("#sc-sp-ly-copy").onclick = async () => {
      try {
        if (!lyricLines.length) {
          try {
            const out = await collectLyrics();
            lyricLines = out.lines;
            setLyricStatus("ready", out.status, { source: out.source, synced: out.synced });
          } catch (err) {
            setLyricStatus("error", err?.message || "Sync failed.");
            scToast(`❌ Lyrics sync failed — ${err?.message || "retry"}.`);
            return;
          }
        }
        const md = (H.buildLyricsMarkdown || ((m) => `# ${m.title}`))(
          lyricMetaCache || extractTrackMetadata(), lyricLines,
          { synced: lyricStatus.synced, source: lyricStatus.source, capturedAt: new Date().toISOString() },
        );
        await navigator.clipboard.writeText(md);
        scToast(`📋 Lyrics copied (${lyricLines.length} lines).`);
        renderLyricLines();
      } catch (err) {
        scToast(`❌ Copy failed — ${err?.message || "try Download instead"}.`);
      }
    };
    el.querySelector("#sc-sp-ly-dl").onclick = async () => {
      try {
        if (!lyricLines.length) {
          try {
            const out = await collectLyrics();
            lyricLines = out.lines;
            setLyricStatus("ready", out.status, { source: out.source, synced: out.synced });
          } catch (err) {
            setLyricStatus("error", err?.message || "Sync failed.");
            scToast(`❌ Lyrics sync failed — ${err?.message || "retry"}.`);
            return;
          }
        }
        const meta = lyricMetaCache || extractTrackMetadata();
        const base = `${(meta.artists[0] ? meta.artists[0] + " - " : "")}${meta.title}`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 100) || "spotify-lyrics";
        downloadFile(`${base}.md`, (H.buildLyricsMarkdown || ((m) => `# ${m.title}`))(meta, lyricLines, { synced: lyricStatus.synced, source: lyricStatus.source, capturedAt: new Date().toISOString() }));
      } catch (err) {
        scToast(`❌ Download failed — ${err?.message || "retry"}.`);
      }
    };
    wireFloatingChrome(el, "sc_spotify_ly_pos", "sc_spotify_ly_collapsed");
    setLyricStatus("idle", "Track detected.");
  }

  function currentRoute() {
    const href = location.href;
    if (H.currentSpotifyRoute) {
      const kind = H.currentSpotifyRoute(href);
      if (kind === "episode") return { kind, id: getEpisodeId(href) };
      if (kind === "playlist") return { kind, id: getPlaylistId(href) };
      if (kind === "track") return { kind, id: getTrackId(href) };
    } else if (getEpisodeId(href)) {
      return { kind: "episode", id: getEpisodeId(href) };
    }
    return { kind: "", id: "" };
  }

  function removeOtherWidgets(keep) {
    if (keep !== "episode") {
      currentEpisodeId = "";
      if (_panelObserver) {
        _panelObserver.disconnect();
        _panelObserver = null;
      }
      document.getElementById("sc-spotify-widget")?.remove();
    }
    if (keep !== "playlist") {
      currentPlId = "";
      document.getElementById("sc-spotify-pl-widget")?.remove();
    }
    if (keep !== "track") {
      currentTrId = "";
      document.getElementById("sc-spotify-ly-widget")?.remove();
    }
  }

  function onRouteChange() {
    const { kind, id } = currentRoute();
    if (!kind || !id) {
      removeOtherWidgets("");
      return;
    }
    if (kind === "playlist") {
      removeOtherWidgets("playlist");
      if (id !== currentPlId) {
        currentPlId = id;
        plTracks = [];
        plMetaCache = null;
        injectSelectionFix();
        injectPlaylistWidget();
        setPlStatus("waiting", "Playlist detected. Auto-backing up…");
        setTimeout(async () => {
          if (getPlaylistId(location.href) !== id || plTracks.length) return;
          try {
            await backupPlaylist({ scroll: true });
          } catch {
            if (getPlaylistId(location.href) === id && !plTracks.length) {
              setPlStatus("waiting", "List not readable yet — scroll it, or press Backup tracks.");
              renderPlTracks();
            }
          }
        }, 2500);
      }
      return;
    }
    if (kind === "track") {
      removeOtherWidgets("track");
      if (id !== currentTrId) {
        currentTrId = id;
        lyricLines = [];
        lyricMetaCache = null;
        injectSelectionFix();
        injectLyricsWidget();
        setLyricStatus("waiting", "Track detected. Auto-syncing lyrics…");
        setTimeout(async () => {
          if (getTrackId(location.href) !== id || lyricLines.length) return;
          try {
            const out = await collectLyrics();
            if (getTrackId(location.href) !== id || lyricLines.length) return;
            lyricLines = out.lines;
            setLyricStatus("ready", out.status, { source: out.source, synced: out.synced });
            renderLyricLines();
          } catch {
            if (getTrackId(location.href) === id && !lyricLines.length) {
              setLyricStatus("waiting", "Lyrics not readable yet — open the Lyrics section, or press Sync.");
              renderLyricLines();
            }
          }
        }, 2500);
      }
      return;
    }
    // Episode route (existing flow).
    removeOtherWidgets("episode");
    if (id !== currentEpisodeId) {
      currentEpisodeId = id;
      segments = [];
      transcriptNotice = "";
      setStatus("waiting", "Episode detected. Auto-syncing transcript…");
      injectSelectionFix();
      injectWidget();
      // Observer path: capture the instant Spotify renders panel rows.
      watchTranscriptPanel(id);
      // Active path (mirrors YouTube auto-sync): auto-click the Transcript
      // tab, step-scroll lazy rows into render, then scrape.
      setTimeout(async () => {
        if (getEpisodeId(location.href) !== id || segments.length) return;
        try {
          const out = await collectTranscript({ allowTabClick: true, autoScroll: true });
          if (getEpisodeId(location.href) !== id || segments.length) return;
          segments = out.segments;
          setStatus("ready", out.status, out.source);
          renderLines();
        } catch {
          if (getEpisodeId(location.href) === id && !segments.length) {
            setStatus("waiting", "Transcript tab not readable yet — it syncs when rows render, or press Sync.");
            renderLines();
          }
        }
      }, 2000);
    }
    renderStatus();
  }

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onRouteChange();
    }
  }, 1200);
  injectSelectionFix();
  onRouteChange();
})();
