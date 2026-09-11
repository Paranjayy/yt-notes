/**
 * Twitter/X helpers — pure + DOM-only functions, no chrome APIs.
 * Shared by the X content script and unit tests.
 */

const X_RESERVED_PATHS = new Set([
  "home", "explore", "notifications", "messages", "i", "search",
  "settings", "compose", "login", "logout", "signup", "password_reset",
  "download", "jobs", "tos", "privacy",
]);

function parseXRoute(urlString = "") {
  try {
    const url = new URL(urlString, "https://x.com");
    if (!/(^|\.)(x|twitter)\.com$/.test(url.hostname)) return { kind: "", handle: "", statusId: "" };
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length || X_RESERVED_PATHS.has(parts[0].toLowerCase())) return { kind: "", handle: "", statusId: "" };
    const handle = parts[0];
    if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return { kind: "", handle: "", statusId: "" };
    if (parts[1] === "status" && parts[2]) {
      const id = parts[2].split("?")[0];
      if (!/^\d+$/.test(id)) return { kind: "", handle: "", statusId: "" };
      return { kind: "post", handle, statusId: id };
    }
    if (parts.length === 1) return { kind: "profile", handle, statusId: "" };
    return { kind: "", handle: "", statusId: "" };
  } catch {
    return { kind: "", handle: "", statusId: "" };
  }
}

function parseCompactCount(raw = "") {
  const t = String(raw).replace(/,/g, "").trim();
  const m = t.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1;
  return Math.round(Number(m[1]) * mult);
}

function metricText(el) {
  if (!el) return "";
  // Counts render inside app-text-transition-container spans; icon-only
  // buttons carry them in aria-labels ("79 Replies. Reply").
  const aria = el.getAttribute ? el.getAttribute("aria-label") || "" : "";
  const ariaNum = aria.match(/^([\d,.]+[KMB]?)\b/);
  if (ariaNum) return ariaNum[1];
  const inner = el.querySelector
    ? el.querySelector('[data-testid="app-text-transition-container"]')
    : null;
  const t = ((inner?.textContent ?? el.textContent) || "").replace(/\s+/g, " ").trim();
  return t;
}

function groupMetrics(article) {
  // Whole-action-bar label: "79 replies, 47 reposts, 897 likes, 478 bookmarks, 146469 views".
  const out = {};
  let group = null;
  try {
    group = article.querySelector('div[role="group"][aria-label*="views"], div[role="group"][aria-label*="likes"]');
  } catch {
    group = null;
  }
  const label = group?.getAttribute("aria-label") || "";
  for (const [key, re] of [
    ["replies", /([\d,.]+[KMB]?)\s+replies?/i],
    ["reposts", /([\d,.]+[KMB]?)\s+reposts?/i],
    ["likes", /([\d,.]+[KMB]?)\s+likes?/i],
    ["bookmarks", /([\d,.]+[KMB]?)\s+bookmarks?/i],
    ["views", /([\d,.]+[KMB]?)\s+views?/i],
  ]) {
    const m = label.match(re);
    if (m) out[key] = m[1];
  }
  return out;
}

/**
 * Parse one article[data-testid="tweet"] WITHOUT hashed classes.
 * Returns {author, handle, time, statusUrl, text, replies, reposts, likes,
 * views, hasPhoto, hasVideo, hasQuote}.
 */
function scrapeTweetArticle(article) {
  if (!article) return null;
  const q = (sel) => {
    try {
      return article.querySelector(sel);
    } catch {
      return null;
    }
  };
  const qa = (sel) => {
    try {
      return Array.from(article.querySelectorAll(sel));
    } catch {
      return [];
    }
  };
  const textOf = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

  const textEl = q('[data-testid="tweetText"]');
  const text = textOf(textEl);

  const nameBlock = q('[data-testid="User-Name"]');
  const nameText = textOf(nameBlock);
  const handleMatch = nameText.match(/@([A-Za-z0-9_]{1,15})/);
  const handle = handleMatch ? handleMatch[1] : "";
  const author = nameText.split("@")[0].trim() || handle || "Unknown";

  const timeLink = qa('a[href*="/status/"]').find((a) => a.querySelector("time") || /^\/(.*)\/status\/\d+/.test(a.getAttribute("href") || ""));
  const statusHref = timeLink?.getAttribute("href") || qa('a[href*="/status/"]')[0]?.getAttribute("href") || "";
  const statusIdMatch = statusHref.match(/\/status\/(\d+)/);
  const statusUrl = statusHref ? `https://x.com${statusHref.split("?")[0]}` : "";
  const time = textOf(timeLink?.querySelector("time") || timeLink);

  const replies = metricText(q('[data-testid="reply"]'));
  const reposts = metricText(q('[data-testid="retweet"]'));
  const likes = metricText(q('[data-testid="like"]'));
  // Icon-only buttons may expose no count text — backfill from the
  // action-bar group label.
  const gm = groupMetrics(article);
  const views = (() => {
    if (gm.views) return gm.views;
    const v = qa("a, span").find((el) => /^\d[\d,.]*[KMB]?\s+views?$/i.test(textOf(el)));
    return v ? textOf(v).replace(/\s+views?$/i, "") : "";
  })();

  const hasPhoto = Boolean(q('[data-testid="tweetPhoto"]'));
  const hasVideo = Boolean(q('[data-testid="videoPlayer"]'));
  const hasQuote = Boolean(
    textEl && qa('[data-testid="tweetText"]').length > 1,
  );
  // Content photo URLs only (avatar lives outside tweetPhoto). Video
  // posters Thumbnails surface as pbs.twimg.com imgs too — keep them.
  const photos = qa('[data-testid="tweetPhoto"] img[src*="pbs.twimg.com"]')
    .map((img) => img.getAttribute("src") || "")
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 4);

  if (!text && !statusUrl) return null;
  return {
    author, handle, time, statusUrl,
    statusId: statusIdMatch ? statusIdMatch[1] : "",
    text,
    replies: replies || gm.replies || "",
    reposts: reposts || gm.reposts || "",
    likes: likes || gm.likes || "",
    views,
    hasPhoto, hasVideo, hasQuote, photos,
  };
}

/** All tweet articles currently rendered under a root element. */
function scrapeVisibleTweets(root) {
  if (!root) return [];
  let articles = [];
  try {
    articles = Array.from(root.querySelectorAll('article[data-testid="tweet"]'));
  } catch {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const a of articles) {
    const t = scrapeTweetArticle(a);
    if (!t) continue;
    const key = t.statusUrl || `${t.handle}|${t.text.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Profile header block (UserName / UserDescription / location / url / join). */
function scrapeProfileHeader(doc) {
  if (!doc) return null;
  const q = (sel) => {
    try {
      return doc.querySelector(sel);
    } catch {
      return null;
    }
  };
  const textOf = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const nameBlock = q('[data-testid="UserName"]');
  if (!nameBlock) return null;
  const displayName = (textOf(nameBlock).split("@")[0] || "").trim();
  // Counts sit in dedicated anchors: a[href$="/following"],
  // a[href*="followers"] — read those, never whole-document regex.
  const countFrom = (sel) => {
    let a = null;
    try {
      a = doc.querySelector(sel);
    } catch {
      a = null;
    }
    const m = textOf(a).match(/^([\d,.]+[KMB]?)/);
    return m ? m[1] : "";
  };
  return {
    displayName,
    bio: textOf(q('[data-testid="UserDescription"]')),
    location: textOf(q('[data-testid="UserLocation"]')),
    url: textOf(q('[data-testid="UserUrl"]')),
    joinDate: textOf(q('[data-testid="UserJoinDate"]')),
    following: countFrom('a[href$="/following"]'),
    followers: countFrom('a[href*="followers"]'),
  };
}

function buildXMarkdown({ route = {}, profile = null, tweets = [], capturedAt = "", format = "full" }) {
  const at = capturedAt || new Date().toISOString();
  if (format === "text") {
    return tweets
      .map((t, i) => `${i + 1}. ${t.author} (@${t.handle}):\n${t.text || "_(media-only)_"}`)
      .join("\n\n");
  }
  if (format === "links") {
    return tweets.map((t) => t.statusUrl).filter(Boolean).join("\n");
  }
  if (format === "compact") {
    return tweets
      .map((t) => {
        const snippet = (t.text || "_(media-only)_").replace(/\s+/g, " ").slice(0, 140);
        return `@${t.handle}: ${snippet} (💬 ${t.replies || 0} · 🔁 ${t.reposts || 0} · ❤️ ${t.likes || 0})${t.statusUrl ? ` ${t.statusUrl}` : ""}`;
      })
      .join("\n");
  }
  const lines = [];
  const isPost = route.kind === "post";
  const head = isPost
    ? `Post by @${route.handle}`
    : `Posts by @${route.handle}`;
  lines.push(`# ${head}`);
  lines.push("");
  lines.push("`x` `twitter`" + (isPost ? " `post`" : " `profile`"));
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Handle | @${route.handle || "?"} |`);
  if (route.statusId) lines.push(`| Status ID | \`${route.statusId}\` |`);
  lines.push(`| URL | ${route.url || ""} |`);
  if (profile?.displayName) lines.push(`| Name | ${profile.displayName} |`);
  if (profile?.bio) lines.push(`| Bio | ${profile.bio.slice(0, 300)} |`);
  if (profile?.followers) lines.push(`| Followers | ${profile.followers} |`);
  if (profile?.following) lines.push(`| Following | ${profile.following} |`);
  lines.push(`| Posts captured | ${tweets.length} visible |`);
  lines.push(`| Captured | ${at} |`);
  lines.push("");
  if (!tweets.length) {
    lines.push("> No posts captured. Scroll the timeline so posts render, then re-run capture.");
    lines.push("");
  } else {
    tweets.forEach((t, i) => {
      const media = [t.hasPhoto && "📷 photo", t.hasVideo && "🎬 video", t.hasQuote && "💬 quote"].filter(Boolean).join(" ");
      lines.push(`## ${i + 1}. ${t.author} (@${t.handle})${t.time ? ` · ${t.time}` : ""}`);
      lines.push("");
      if (t.text) lines.push(t.text);
      else lines.push("_(no text — media-only post)_");
      lines.push("");
      const stats = [`💬 ${t.replies || "0"}`, `🔁 ${t.reposts || "0"}`, `❤️ ${t.likes || "0"}`];
      if (t.views) stats.push(`👁️ ${t.views}`);
      if (media) stats.push(media);
      lines.push(stats.join(" · "));
      if (t.statusUrl) lines.push(t.statusUrl);
      if (Array.isArray(t.photos) && t.photos.length) {
        t.photos.forEach((src) => lines.push(`![](${src})`));
      }
      lines.push("");
    });
  }
  lines.push("---");
  lines.push(`_Source: X • ${route.url || ""} • captured ${at}_`);
  lines.push("");
  return lines.join("\n");
}

// Node / Vitest export; browser build attaches to window instead.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseXRoute,
    parseCompactCount,
    scrapeTweetArticle,
    scrapeVisibleTweets,
    scrapeProfileHeader,
    buildXMarkdown,
  };
} else if (typeof window !== "undefined") {
  window.TwitterHelpers = {
    parseXRoute,
    parseCompactCount,
    scrapeTweetArticle,
    scrapeVisibleTweets,
    scrapeProfileHeader,
    buildXMarkdown,
  };
}
