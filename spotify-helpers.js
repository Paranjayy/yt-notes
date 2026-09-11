/**
 * Spotify helpers — pure functions, no DOM / no chrome APIs.
 * Shared by the Spotify content script and unit tests.
 */

function getSpotifyEpisodeId(urlString = "") {
  try {
    const url = new URL(urlString, "https://open.spotify.com");
    const parts = url.pathname.split("/").filter(Boolean);
    // /episode/<id> and /embed/episode/<id>
    const epiIndex = parts.lastIndexOf("episode");
    if (epiIndex >= 0 && parts[epiIndex + 1]) {
      const raw = parts[epiIndex + 1].split("?")[0];
      if (/^[A-Za-z0-9]{10,}$/.test(raw)) return raw;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
    // spotify:episode:<id>
    const uriMatch = String(urlString).match(/spotify:episode:([A-Za-z0-9]+)/);
    if (uriMatch) return uriMatch[1];
    return "";
  } catch {
    const m = String(urlString).match(/episode\/([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  }
}

function isSpotifyEpisodeRoute(urlString = "") {
  try {
    const url = new URL(urlString, "https://open.spotify.com");
    if (!/(\.|^)spotify\.com$/.test(url.hostname)) return false;
    return Boolean(getSpotifyEpisodeId(url.toString()));
  } catch {
    return false;
  }
}

function formatSpotifyTimestamp(ms) {
  if (!Number.isFinite(Number(ms)) || Number(ms) < 0) return "0:00";
  const totalSec = Math.floor(Number(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseDurationToMs(input) {
  if (input == null) return null;
  if (typeof input === "number" && Number.isFinite(input)) {
    // Heuristic: > 10_000 => already ms, else seconds.
    return input > 10000 ? Math.round(input) : Math.round(input * 1000);
  }
  const str = String(input).trim();
  if (!str) return null;
  if (/^\d+$/.test(str)) {
    const n = Number(str);
    return n > 10000 ? n : n * 1000;
  }
  // "27 min 35 sec", "17 min 19 sec left", "1 hr 2 min", "45 sec"
  const hr = str.match(/(\d+(?:\.\d+)?)\s*h(?:r|our)?s?/i);
  const min = str.match(/(\d+(?:\.\d+)?)\s*min/i);
  const sec = str.match(/(\d+(?:\.\d+)?)\s*sec/i);
  if (hr || min || sec) {
    const ms =
      (hr ? Number(hr[1]) * 3600 : 0) +
      (min ? Number(min[1]) * 60 : 0) +
      (sec ? Number(sec[1]) : 0);
    return Math.round(ms * 1000);
  }
  // "27:35" or "1:02:03"
  const clock = str.match(/(\d+):(\d{2})(?::(\d{2}))?/);
  if (clock) {
    const parts = clock[0].split(":").map(Number);
    let total = 0;
    for (const p of parts) total = total * 60 + p;
    return total * 1000;
  }
  return null;
}

/**
 * Normalize the spclient transcript-read-along envelope into flat segments.
 * Accepts either the raw JSON (with alternatives[].words[]) or an already
 * flat {segments:[{startMs,text}]}, and tolerates language envelopes.
 */
function parseTranscriptReadAlong(payload) {
  if (!payload || typeof payload !== "object") return [];
  const out = [];
  const push = (startMs, endMs, text) => {
    const clean = String(text ?? "").replace(/\s+/g, " ").trim();
    if (!clean) return;
    out.push({
      startMs: Number.isFinite(Number(startMs)) ? Math.round(Number(startMs)) : 0,
      endMs: Number.isFinite(Number(endMs)) ? Math.round(Number(endMs)) : null,
      text: clean,
    });
  };

  // Flat shapes first.
  const flatLists = [
    payload.segments,
    payload.transcript?.segments,
    payload.results,
    payload.cues,
    payload.lines,
  ].filter(Array.isArray);
  for (const list of flatLists) {
    for (const seg of list) {
      if (!seg || typeof seg !== "object") continue;
      const text = seg.text ?? seg.words?.map((w) => w.text ?? w.word).join(" ") ?? seg.content ?? "";
      const start = seg.startMs ?? seg.startTimeMs ?? seg.start ?? seg.offsetMs ?? seg.offset ?? 0;
      const end = seg.endMs ?? seg.endTimeMs ?? seg.end ?? null;
      push(start, end, text);
    }
    if (out.length) break;
  }
  if (out.length) return mergeTranscriptSegments(out);

  // Spotify read-along shape: { alternatives: [ { words: [ { startTimeMs, endTimeMs, word ] } ] }
  const alternatives = Array.isArray(payload.alternatives)
    ? payload.alternatives
    : Array.isArray(payload.transcript?.alternatives)
      ? payload.transcript.alternatives
      : [];
  for (const alt of alternatives) {
    const words = Array.isArray(alt.words) ? alt.words : [];
    // Group words into sentence-ish cues (~8s windows) so exports stay readable.
    let bucket = [];
    let bucketStart = null;
    let bucketEnd = null;
    const flush = () => {
      if (bucket.length) push(bucketStart ?? 0, bucketEnd, bucket.join(" "));
      bucket = [];
      bucketStart = null;
      bucketEnd = null;
    };
    for (const w of words) {
      const text = w.word ?? w.text ?? "";
      const start = Number(w.startTimeMs ?? w.startMs ?? w.start ?? 0);
      const end = Number(w.endTimeMs ?? w.endMs ?? w.end ?? start);
      if (bucketStart == null) bucketStart = start;
      if (bucket.length && start - bucketStart > 8000) flush();
      if (bucketStart == null) bucketStart = start;
      bucket.push(String(text));
      bucketEnd = end;
    }
    flush();
    if (out.length) break;
  }
  return mergeTranscriptSegments(out);
}

/** Merge adjacent segments with identical text / tiny gaps; sort by start. */
function mergeTranscriptSegments(segments) {
  const sorted = [...segments]
    .filter((s) => s && s.text)
    .sort((a, b) => a.startMs - b.startMs);
  const merged = [];
  for (const seg of sorted) {
    const last = merged[merged.length - 1];
    if (last && (last.text === seg.text || (seg.startMs - (last.endMs ?? last.startMs) < 250 && last.text.endsWith(seg.text)))) {
      last.endMs = seg.endMs ?? last.endMs;
      continue;
    }
    merged.push({ ...seg });
  }
  return merged;
}

/**
 * Decide what to do for a transcript/token HTTP status.
 * - 404 on the read-along endpoint: episode genuinely has no transcript.
 * - 401: login required.
 * - 403: token endpoint blocked (content/tracker blocker) or forbidden —
 *   the page Transcript tab is still usable, so skip the API, don't error.
 * - anything else: retryable.
 */
function getTranscriptApiAction(status) {
  if (status === 404) return "empty";
  if (status === 401) return "auth";
  if (status === 403) return "skip-api";
  return "retry";
}

/**
 * Normalize titles so a Spotify-exclusive episode can be matched against a
 * YouTube upload with slightly different punctuation/casing/suffixes.
 * "Madeline Argy Debrief: Toxic Relationships • Call Her Daddy" -> core title.
 */
function normalizeEpisodeTitle(title = "") {
  return String(title || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[“”"‘’]/g, "")
    .replace(/\s*\|\s*.*/g, "") // "X | Show" -> X
    .replace(/\s*[•·–—-]\s*call her daddy\s*$/i, "")
    .replace(/\s*\(\s*(full episode|official|podcast|audio only|spotify exclusive)[^)]*\)/gi, "")
    .replace(/\s*-\s*(full episode|official|podcast|audio only|spotify exclusive)\s*$/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(title = "") {
  return new Set(normalizeEpisodeTitle(title).split(" ").filter((t) => t.length > 2));
}

/**
 * 0..1 similarity between a Spotify episode and a YouTube candidate.
 * Duration proximity breaks ties when titles are near-identical across parts.
 */
function episodeMatchScore(spotifyMeta = {}, yt = {}) {
  const a = tokenSet(spotifyMeta.episode || spotifyMeta.title || "");
  const b = tokenSet(yt.title || "");
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap++;
  const jaccard = overlap / (a.size + b.size - overlap);

  // Show/channel hint bonus.
  const show = String(spotifyMeta.show || "").toLowerCase();
  const channel = String(yt.channel || "").toLowerCase();
  const showBonus = show && channel && (channel.includes(show.slice(0, 8)) || show.includes(channel.slice(0, 8))) ? 0.08 : 0;

  // Duration proximity bonus (parse both to ms).
  let durationBonus = 0;
  const dA = parseDurationToMs(spotifyMeta.durationMs ?? spotifyMeta.duration);
  const dB = parseDurationToMs(yt.durationMs ?? yt.duration);
  if (dA && dB) {
    const diff = Math.abs(dA - dB);
    if (diff < 15_000) durationBonus = 0.12;
    else if (diff < 60_000) durationBonus = 0.06;
    else if (diff < 5 * 60_000) durationBonus = 0.02;
  }
  return Math.min(1, jaccard + showBonus + durationBonus);
}

function findBestYouTubeMatch(spotifyMeta = {}, candidates = []) {
  let best = null;
  for (const c of candidates) {
    const score = episodeMatchScore(spotifyMeta, c);
    if (!best || score > best.score) best = { candidate: c, score };
  }
  return best && best.score >= 0.35 ? best : null;
}

function escapeMarkdown(text = "") {
  return String(text ?? "");
}

/**
 * Parse a Spotify #transcript-panel element WITHOUT relying on hashed CSS
 * classes: direct child rows; a row whose whole text is "Speaker N" is a
 * speaker header, otherwise cue text lives in span[dir="auto"].
 * DOM-only (no chrome APIs) so it stays unit-testable under jsdom.
 * Returns { notice, segments:[{speaker, text, startMs:null}] }.
 */
function scrapeSpotifyPanel(panel) {
  if (!panel) return { notice: "", segments: [] };
  const rowText = (row) => (row?.textContent || "").replace(/\s+/g, " ").trim();
  const rows = Array.from(panel.children || []);
  let notice = "";
  const segments = [];
  const pushLine = (speaker, line) => {
    if (!line || /^speaker \d+$/i.test(line)) return;
    segments.push({ startMs: null, speaker: speaker || "", text: line });
  };
  if (rows.length > 1) {
    let speaker = "";
    for (const row of rows) {
      const t = rowText(row);
      if (!t) continue;
      if (/generated automatically/i.test(t) && t.length < 140) {
        notice = t;
        continue;
      }
      if (/^speaker \d+$/i.test(t)) {
        speaker = t.replace(/^speaker\s*/i, "Speaker ");
        continue;
      }
      let cue = null;
      try {
        cue = row.querySelector('span[dir="auto"]');
      } catch {
        cue = null;
      }
      pushLine(speaker, rowText(cue || row));
    }
  } else {
    let spans = [];
    try {
      spans = Array.from(panel.querySelectorAll('span[dir="auto"]'));
    } catch {
      spans = [];
    }
    let speaker = "";
    for (const span of spans) {
      const line = rowText(span);
      if (!line) continue;
      if (/^speaker \d+$/i.test(line)) {
        speaker = line.replace(/^speaker\s*/i, "Speaker ");
        continue;
      }
      if (/generated automatically/i.test(line) && line.length < 140) {
        notice = line;
        continue;
      }
      pushLine(speaker, line);
    }
  }
  const seen = new Set();
  const deduped = segments.filter((s) => {
    const k = `${s.speaker}|${s.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { notice, segments: deduped };
}

/**
 * Render transcript segments. Two shapes:
 * - timed:   [{startMs, text}] -> "[m:ss] text" lines (read-along API)
 * - speaker: [{speaker, text, startMs:null}] -> "**Speaker N**" grouped
 *   paragraphs (page transcript tab — Spotify's web panel is untimed).
 */
function hasTimestamp(seg) {
  // Note: Number(null) === 0, so null/undefined must be excluded explicitly.
  return seg?.startMs !== null && seg?.startMs !== undefined &&
    Number.isFinite(Number(seg.startMs)) && Number(seg.startMs) >= 0;
}

function renderTranscriptLines(segments = []) {
  const timed = segments.filter((s) => hasTimestamp(s) && s?.text);
  const untimed = segments.filter((s) => !hasTimestamp(s) && s?.text);
  const lines = [];
  for (const seg of timed) {
    lines.push(`[${formatSpotifyTimestamp(seg.startMs)}] ${seg.text}`);
  }
  if (untimed.length) {
    if (lines.length) lines.push("");
    let lastSpeaker = null;
    for (const seg of untimed) {
      const speaker = (seg.speaker || "").trim();
      if (speaker && speaker !== lastSpeaker) {
        lines.push(`**${speaker}**`);
        lines.push("");
        lastSpeaker = speaker;
      }
      lines.push(seg.text);
      lines.push("");
    }
  }
  return lines;
}

function buildSpotifyMarkdown(meta = {}, segments = [], opts = {}) {
  const {
    episodeId = "",
    url = "",
    episode = "Spotify episode",
    show = "",
    publisher = "",
    date = "",
    duration = "",
    durationMs = null,
    explicit = false,
    description = "",
    image = "",
    transcriptSource = "",
    transcriptStatus = "",
    transcriptNotice = "",
  } = meta;
  const notes = Array.isArray(opts.notes) ? opts.notes : [];
  const related = Array.isArray(opts.related) ? opts.related : [];
  const relatedLabel = opts.relatedLabel || (show ? `More from ${show}` : "Related episodes");
  const crossRef = opts.crossRef || null; // { youtubeUrl, youtubeTitle, score }
  const capturedAt = opts.capturedAt || new Date().toISOString();
  const lines = [];
  lines.push(`# ${escapeMarkdown(episode)}`);
  lines.push("");
  const badges = ["`spotify`", "`podcast-episode`"];
  if (explicit) badges.push("`explicit`");
  if (segments.length) badges.push("`transcript`");
  else badges.push("`no-transcript`");
  lines.push(badges.join(" "));
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Episode | ${escapeMarkdown(episode)} |`);
  if (show) lines.push(`| Show | ${escapeMarkdown(show)} |`);
  if (publisher && publisher !== show) lines.push(`| Publisher | ${escapeMarkdown(publisher)} |`);
  if (date) lines.push(`| Published | ${escapeMarkdown(date)} |`);
  if (duration) lines.push(`| Duration | ${escapeMarkdown(duration)} |`);
  else if (durationMs) lines.push(`| Duration | ${formatSpotifyTimestamp(durationMs)} |`);
  if (episodeId) lines.push(`| Episode ID | \`${episodeId}\` |`);
  if (url) lines.push(`| URL | ${url} |`);
  if (image) lines.push(`| Artwork | ![](${image}) |`);
  lines.push(`| Captured | ${capturedAt} |`);
  if (transcriptSource) lines.push(`| Transcript source | ${escapeMarkdown(transcriptSource)} |`);
  if (transcriptStatus) lines.push(`| Transcript status | ${escapeMarkdown(transcriptStatus)} |`);
  lines.push("");
  if (crossRef?.youtubeUrl) {
    lines.push("## 🔗 Cross-platform match");
    lines.push("");
    lines.push(
      `Possible YouTube counterpart: [${escapeMarkdown(crossRef.youtubeTitle || crossRef.youtubeUrl)}](${crossRef.youtubeUrl})` +
        (Number.isFinite(crossRef.score) ? ` (match ${(crossRef.score * 100).toFixed(0)}%)` : ""),
    );
    lines.push("");
    lines.push(
      "_Spotify-exclusive episodes are often split or re-uploaded on YouTube with slightly different titles. " +
        "Verify duration + publish date before treating them as the same episode._",
    );
    lines.push("");
  }
  if (description) {
    lines.push("## Description");
    lines.push("");
    lines.push(String(description).trim());
    lines.push("");
  }
  if (notes.length) {
    lines.push("## Notes");
    lines.push("");
    for (const n of notes) {
      const ts = n.timestampMs != null ? ` [${formatSpotifyTimestamp(n.timestampMs)}]` : "";
      lines.push(`- ${String(n.text || "").trim()}${ts}`);
    }
    lines.push("");
  }
  lines.push("## Transcript");
  lines.push("");
  if (!segments.length) {
    lines.push(
      transcriptStatus
        ? `> ${transcriptStatus}`
        : "> No transcript captured. Open the episode's Transcript tab while logged in, then re-run capture.",
    );
    lines.push("");
  } else {
    if (transcriptNotice) {
      lines.push(`> _${transcriptNotice}_`);
      lines.push("");
    }
    if (transcriptSource) {
      lines.push(`_via ${transcriptSource}_`);
      lines.push("");
    }
    lines.push(...renderTranscriptLines(segments));
  }
  if (related.length) {
    lines.push(`## ${relatedLabel} (${related.length} visible)`);
    lines.push("");
    related.forEach((r, i) => {
      const dur = r.duration ? ` · ${r.duration}` : "";
      const date = r.date ? ` · ${r.date}` : "";
      lines.push(`${i + 1}. [${r.title || "Untitled episode"}](${r.url || "#"})${dur}${date}`);
    });
    lines.push("");
  }
  lines.push("---");
  lines.push(`_Source: Spotify • ${url || `https://open.spotify.com/episode/${episodeId}`} • captured ${capturedAt}_`);
  lines.push("");
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Playlist + track (lyrics) surfaces                                   */
/* ------------------------------------------------------------------ */

function getSpotifyPlaylistId(urlString = "") {
  try {
    const url = new URL(urlString, "https://open.spotify.com");
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.lastIndexOf("playlist");
    if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1].split("?")[0]);
    const m = String(urlString).match(/spotify:playlist:([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  } catch {
    const m = String(urlString).match(/playlist\/([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  }
}

function isSpotifyPlaylistRoute(urlString = "") {
  try {
    const url = new URL(urlString, "https://open.spotify.com");
    if (!/(\.|^)spotify\.com$/.test(url.hostname)) return false;
    return Boolean(getSpotifyPlaylistId(url.toString()));
  } catch {
    return false;
  }
}

function getSpotifyTrackId(urlString = "") {
  try {
    const url = new URL(urlString, "https://open.spotify.com");
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.lastIndexOf("track");
    if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1].split("?")[0]);
    const m = String(urlString).match(/spotify:track:([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  } catch {
    const m = String(urlString).match(/track\/([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  }
}

function isSpotifyTrackRoute(urlString = "") {
  try {
    const url = new URL(urlString, "https://open.spotify.com");
    if (!/(\.|^)spotify\.com$/.test(url.hostname)) return false;
    return Boolean(getSpotifyTrackId(url.toString()));
  } catch {
    return false;
  }
}

function currentSpotifyRoute(urlString = "") {
  if (isSpotifyEpisodeRoute(urlString)) return "episode";
  if (isSpotifyPlaylistRoute(urlString)) return "playlist";
  if (isSpotifyTrackRoute(urlString)) return "track";
  return "";
}

/**
 * Parse a playlist tracklist grid WITHOUT hashed classes:
 * grid = [data-testid="playlist-tracklist"], rows = div[role="row"]
 * (rowindex 1 is the header), title = a[data-testid="internal-track-link"],
 * artists = a[href^="/artist/"], album = col-3 a[href^="/album/"],
 * duration = col-5 clock text. DOM-only, jsdom-testable.
 */
function scrapePlaylistRows(grid) {
  if (!grid) return [];
  let rows = [];
  try {
    rows = Array.from(grid.querySelectorAll('div[role="row"]'));
  } catch {
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    try {
      if ((row.getAttribute("aria-rowindex") || "") === "1") continue;
      const titleLink = row.querySelector('a[data-testid="internal-track-link"]');
      const href = titleLink?.getAttribute("href") || "";
      const idMatch = href.match(/\/track\/([A-Za-z0-9]+)/);
      // Liked-songs/search rows can lack track links — keep them only when
      // a title cell exists so position numbers stay truthful.
      const titleCell = row.querySelector('div[role="gridcell"]');
      const title = (titleLink?.textContent || "").replace(/\s+/g, " ").trim();
      if (!title && !titleCell) continue;
      const trackId = idMatch ? idMatch[1] : "";
      const key = trackId ? `id:${trackId}` : `row:${out.length}:${title}`;
      if (trackId && seen.has(key)) continue;
      seen.add(key);
      const artists = Array.from(row.querySelectorAll('a[href^="/artist/"]'))
        .map((a) => (a.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i);
      const albumLink = row.querySelector('a[href^="/album/"]');
      const album = (albumLink?.textContent || "").replace(/\s+/g, " ").trim();
      const durMatch = (row.textContent || "").match(/\b\d{1,3}:\d{2}(?::\d{2})?\b/);
      let explicit = false;
      try {
        explicit = Boolean(row.querySelector('[aria-label="Explicit"]'));
      } catch {
        explicit = false;
      }
      out.push({
        position: out.length + 1,
        title: title || "(untitled)",
        trackId,
        url: trackId ? `https://open.spotify.com/track/${trackId}` : "",
        artists,
        album,
        duration: durMatch ? durMatch[0] : "",
        explicit,
      });
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Normalize the color-lyrics endpoint envelope into timed lines.
 * Accepts {lyrics:{lines:[{startTimeMs,words}]}} where words is a string or
 * [{word}] array, plus flat {lines:[{startTimeMs,text}]} shapes.
 */
function parseColorLyrics(payload) {
  if (!payload || typeof payload !== "object") return [];
  const raw = Array.isArray(payload?.lyrics?.lines)
    ? payload.lyrics.lines
    : Array.isArray(payload?.lines)
      ? payload.lines
      : [];
  const out = [];
  for (const line of raw) {
    if (!line || typeof line !== "object") continue;
    let text = line.text ?? line.lyric ?? "";
    if (!text && Array.isArray(line.words)) {
      text = line.words.map((w) => (typeof w === "string" ? w : w?.word ?? w?.text ?? "")).join(" ");
    } else if (!text && typeof line.words === "string") {
      text = line.words;
    }
    text = String(text).replace(/\s+/g, " ").trim();
    if (!text) continue;
    const ms = Number(line.startTimeMs ?? line.startMs ?? line.start ?? 0);
    out.push({ startMs: Number.isFinite(ms) ? Math.round(ms) : 0, text });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

const LYRICS_UI_LABELS = /^(lyrics|show (more|less)|see more|provided by.*|.*musixmatch.*|advertisement)$/i;

/**
 * Extract lyric lines from a rendered Lyrics section element WITHOUT hashed
 * classes: walks leaf rows, keeps text lines, drops UI labels. DOM-only.
 */
function extractLyricsLines(section) {
  if (!section) return [];
  let candidates = [];
  try {
    candidates = Array.from(section.querySelectorAll("p, div, span, li"));
  } catch {
    return [];
  }
  const lines = [];
  for (const el of candidates) {
    // Leaf-ish only: skip containers that merely wrap other candidates.
    try {
      if (el.querySelector("p, div, li")) continue;
      if (el.querySelector("span") && el.querySelector("span") !== el) {
        const nested = Array.from(el.querySelectorAll("span")).some((s) => s !== el && (s.textContent || "").trim());
        if (nested) continue;
      }
    } catch {
      continue;
    }
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length < 1 || LYRICS_UI_LABELS.test(t)) continue;
    if (/(show more|show less|see more on genius)/i.test(t) && t.length < 40) continue;
    lines.push(t);
  }
  // Dedupe (React double-render) preserving order.
  return lines.filter((l, i) => lines.indexOf(l) === i);
}

function buildPlaylistMarkdown(meta = {}, tracks = [], opts = {}) {
  const {
    playlistId = "",
    url = "",
    title = "Spotify playlist",
    owner = "",
    songCount = "",
    totalDuration = "",
    description = "",
  } = meta;
  const capturedAt = opts.capturedAt || new Date().toISOString();
  const lines = [];
  lines.push(`# ${escapeMarkdown(title)}`);
  lines.push("");
  lines.push("`spotify` `playlist`");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Playlist | ${escapeMarkdown(title)} |`);
  if (owner) lines.push(`| Owner | ${escapeMarkdown(owner)} |`);
  if (songCount) lines.push(`| Songs | ${escapeMarkdown(songCount)} |`);
  else if (tracks.length) lines.push(`| Songs | ${tracks.length} visible |`);
  if (totalDuration) lines.push(`| Total length | ${escapeMarkdown(totalDuration)} |`);
  if (playlistId) lines.push(`| Playlist ID | \`${playlistId}\` |`);
  if (url) lines.push(`| URL | ${url} |`);
  lines.push(`| Captured | ${capturedAt} |`);
  lines.push("");
  if (description) {
    lines.push("## Description");
    lines.push("");
    lines.push(String(description).trim());
    lines.push("");
  }
  lines.push(`## Tracks (${tracks.length} captured)`);
  lines.push("");
  if (!tracks.length) {
    lines.push("> No tracks captured. Scroll the playlist so rows render, then re-run backup.");
    lines.push("");
  } else {
    tracks.forEach((t) => {
      const artists = (t.artists || []).join(", ");
      const dur = t.duration ? ` · ${t.duration}` : "";
      const exp = t.explicit ? " 🅴" : "";
      const head = t.url ? `[${t.title}](${t.url})` : t.title;
      lines.push(`${t.position}. ${head}${artists ? ` — ${artists}` : ""}${t.album ? ` · _${t.album}_` : ""}${dur}${exp}`);
    });
    lines.push("");
  }
  lines.push("---");
  lines.push(`_Source: Spotify • ${url || `https://open.spotify.com/playlist/${playlistId}`} • captured ${capturedAt}_`);
  lines.push("");
  return lines.join("\n");
}

function buildLyricsMarkdown(meta = {}, lyricLines = [], opts = {}) {
  const {
    trackId = "",
    url = "",
    title = "Spotify track",
    artists = [],
    album = "",
    duration = "",
    playCount = "",
    provider = "",
  } = meta;
  const capturedAt = opts.capturedAt || new Date().toISOString();
  const synced = opts.synced === true;
  const source = opts.source || (synced ? "Spotify synced lyrics" : "page lyrics section");
  const lines = [];
  lines.push(`# ${escapeMarkdown(title)}`);
  lines.push("");
  lines.push("`spotify` `lyrics`" + (synced ? " `synced`" : ""));
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Track | ${escapeMarkdown(title)} |`);
  if (artists.length) lines.push(`| Artists | ${escapeMarkdown(artists.join(", "))} |`);
  if (album) lines.push(`| Album | ${escapeMarkdown(album)} |`);
  if (duration) lines.push(`| Duration | ${escapeMarkdown(duration)} |`);
  if (playCount) lines.push(`| Plays | ${escapeMarkdown(playCount)} |`);
  if (trackId) lines.push(`| Track ID | \`${trackId}\` |`);
  if (url) lines.push(`| URL | ${url} |`);
  if (provider) lines.push(`| Provider | ${escapeMarkdown(provider)} |`);
  lines.push(`| Lyrics source | ${escapeMarkdown(source)} |`);
  lines.push(`| Captured | ${capturedAt} |`);
  lines.push("");
  lines.push("## Lyrics");
  lines.push("");
  if (!lyricLines.length) {
    lines.push("> No lyrics captured. Spotify shows lyrics only for tracks that have them (login may be required).");
    lines.push("");
  } else {
    for (const l of lyricLines) {
      if (l && typeof l === "object" && "text" in l) {
        lines.push(l.startMs != null && synced ? `[${formatSpotifyTimestamp(l.startMs)}] ${l.text}` : l.text);
      } else {
        lines.push(String(l));
      }
    }
    lines.push("");
  }
  lines.push("---");
  lines.push(`_Source: Spotify • ${url || `https://open.spotify.com/track/${trackId}`} • captured ${capturedAt}_`);
  lines.push("");
  return lines.join("\n");
}

// Node / Vitest export; browser build attaches to window instead.
if (typeof module !== "undefined" && module.exports) {  module.exports = {
    getSpotifyEpisodeId,
    isSpotifyEpisodeRoute,
    formatSpotifyTimestamp,
    parseDurationToMs,
    parseTranscriptReadAlong,
    getTranscriptApiAction,
    mergeTranscriptSegments,
    normalizeEpisodeTitle,
    episodeMatchScore,
    findBestYouTubeMatch,
    scrapeSpotifyPanel,
    renderTranscriptLines,
    buildSpotifyMarkdown,
    getSpotifyPlaylistId,
    isSpotifyPlaylistRoute,
    getSpotifyTrackId,
    isSpotifyTrackRoute,
    currentSpotifyRoute,
    scrapePlaylistRows,
    parseColorLyrics,
    extractLyricsLines,
    buildPlaylistMarkdown,
    buildLyricsMarkdown,
  };
} else if (typeof window !== "undefined") {
  window.SpotifyHelpers = {
    getSpotifyEpisodeId,
    isSpotifyEpisodeRoute,
    formatSpotifyTimestamp,
    parseDurationToMs,
    parseTranscriptReadAlong,
    getTranscriptApiAction,
    mergeTranscriptSegments,
    normalizeEpisodeTitle,
    episodeMatchScore,
    findBestYouTubeMatch,
    scrapeSpotifyPanel,
    renderTranscriptLines,
    buildSpotifyMarkdown,
    getSpotifyPlaylistId,
    isSpotifyPlaylistRoute,
    getSpotifyTrackId,
    isSpotifyTrackRoute,
    currentSpotifyRoute,
    scrapePlaylistRows,
    parseColorLyrics,
    extractLyricsLines,
    buildPlaylistMarkdown,
    buildLyricsMarkdown,
  };
}
