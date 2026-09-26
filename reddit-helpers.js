/**
 * Reddit helpers — pure + DOM-only functions, no chrome APIs.
 * New Reddit renders <shreddit-post> with facts as element ATTRIBUTES,
 * so the parser reads attributes first and DOM text second.
 */

function parseRedditRoute(urlString = "") {
  try {
    const url = new URL(urlString, "https://www.reddit.com");
    if (!/(^|\.)reddit\.com$/.test(url.hostname)) return { kind: "", subreddit: "", postId: "" };
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "r" && parts[1]) {
      const sub = parts[1];
      if (parts[2] === "comments" && parts[3]) {
        return { kind: "post", subreddit: sub, postId: parts[3], url: url.toString().split("?")[0] };
      }
      if (parts.length === 2) {
        return { kind: "subreddit", subreddit: sub, postId: "", url: url.toString().split("?")[0] };
      }
      return { kind: "", subreddit: "", postId: "" };
    }
    return { kind: "", subreddit: "", postId: "" };
  } catch {
    return { kind: "", subreddit: "", postId: "" };
  }
}

function attr(el, name) {
  try {
    return el?.getAttribute?.(name) ?? "";
  } catch {
    return "";
  }
}

function textOf(el) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * Parse one <shreddit-post> element. Facts live in attributes:
 * permalink, post-title, author, score, comment-count, created-timestamp,
 * post-type, domain, upvote-ratio, subreddit-prefixed-name. Flair/body from DOM.
 */
function scrapeFeedPost(el) {
  if (!el) return null;
  const q = (sel) => {
    try {
      return el.querySelector(sel);
    } catch {
      return null;
    }
  };
  const permalink = attr(el, "permalink");
  const idMatch = (attr(el, "id") || permalink).match(/t3_([a-z0-9]+)/);
  const postId = idMatch ? idMatch[1] : "";
  const title = attr(el, "post-title") || textOf(q('a[slot="full-post-link"], a[slot="title"]')) || "(untitled)";
  const url = permalink ? `https://www.reddit.com${permalink.split("?")[0]}` : "";
  const flair = textOf(q("shreddit-post-flair")).slice(0, 60);
  // Direct media link when the card exposes one (video/gallery/link posts).
  const contentHref = attr(el, "content-href");
  return {
    postId,
    title,
    url,
    author: attr(el, "author"),
    score: attr(el, "score"),
    comments: attr(el, "comment-count"),
    created: attr(el, "created-timestamp"),
    type: attr(el, "post-type"),
    domain: attr(el, "domain"),
    upvoteRatio: attr(el, "upvote-ratio"),
    subreddit: attr(el, "subreddit-prefixed-name"),
    flair,
    stickied: el.hasAttribute("stickied"),
    contentHref,
  };
}

/**
 * Extract a post's text body from its <shreddit-post> element, layered:
 * 1) known body slots, 2) PDP <shreddit-post-text-body> (image/media posts
 * render the text there, not in a slot), 3) legacy rtjson containers,
 * 4) paragraph-join fallback (excludes flair/buttons/meta).
 * Never returns UI chrome.
 */
function extractPostBody(postEl) {
  if (!postEl) return "";
  const textOf = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  try {
    const slot = postEl.querySelector('[slot="text-body"], [slot="post-body"]');
    const slotText = textOf(slot);
    if (slotText.length > 0) return slotText.slice(0, 6000);
  } catch {}
  try {
    // Post-detail pages (especially image/media posts) render the body in
    // <shreddit-post-text-body><div id="t3_<id>-post-rtjson-content"><p>…
    // which the slot selector above misses.
    const pdp = postEl.querySelector("shreddit-post-text-body");
    // postEl itself may BE the text-body element in some shells.
    const pdpText = textOf(pdp) || (postEl.tagName === "SHREDDIT-POST-TEXT-BODY" ? textOf(postEl) : "");
    if (pdpText.length > 0) return pdpText.slice(0, 6000);
  } catch {}
  try {
    const legacy = postEl.querySelector('div[id*="-post-rtjson-content"], div[id*="post-rtjson"]');
    const legacyText = textOf(legacy);
    if (legacyText.length > 0) return legacyText.slice(0, 6000);
  } catch {}
  try {
    const paras = Array.from(postEl.querySelectorAll("p")).filter((p) => {
      try {
        if (p.closest("shreddit-post-flair, button, a")) return false;
      } catch {}
      return textOf(p).length > 0;
    });
    // Drop the title paragraph if it duplicates post-title.
    const titleAttr = (postEl.getAttribute && postEl.getAttribute("post-title")) || "";
    const body = paras
      .map(textOf)
      .filter((t) => t && t !== titleAttr.trim())
      .join("\n\n");
    if (body.length >= 20) return body.slice(0, 6000);
  } catch {}
  return "";
}

/**
 * Collect image/video URLs under a root (post element or document).
 * Mirrors the proven console recipe: redd.it image hosts, gallery/video
 * links, shreddit-player src, and raw video sources. Preview hosts are
 * normalized to canonical i.redd.it, query strings stripped.
 * DOM-only, jsdom-testable.
 */
function collectRedditMedia(root) {
  if (!root) return [];
  const urls = new Set();
  const add = (u) => {
    if (!u || typeof u !== "string") return;
    // Normalize plain preview hosts to canonical i.redd.it, but leave
    // external-preview.redd.it untouched (it only contains "preview" as a
    // substring — naive replace corrupts it to external-i.redd.it).
    const clean = u.replace(/(?<!external-)preview\.redd\.it/g, "i.redd.it").split("?")[0].trim();
    if (/^https?:\/\//.test(clean)) urls.add(clean);
  };
  try {
    root.querySelectorAll('img[src*="preview.redd.it"], img[src*="i.redd.it"], img[src*="external-preview.redd.it"]').forEach((img) => {
      add(img.currentSrc || img.getAttribute("src"));
    });
    root.querySelectorAll('a[href*="i.redd.it"], a[href*="v.redd.it"], a[href*="preview.redd.it"], a[href*="external-preview.redd.it"], a[href^="/gallery/"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      add(href.startsWith("/") ? `https://www.reddit.com${href}` : href);
    });
    root.querySelectorAll("shreddit-player").forEach((p) => {
      add(p.getAttribute("src"));
    });
    root.querySelectorAll("video > source[src], video[src]").forEach((v) => {
      add(v.getAttribute("src"));
    });
  } catch {}
  return [...urls];
}

/** All feed posts currently rendered under root, deduped by post id. */
function scrapeFeedPosts(root) {
  if (!root) return [];
  let els = [];
  try {
    els = Array.from(root.querySelectorAll("shreddit-post:not([slot])"));
  } catch {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const el of els) {
    // Skip nested quote/crosspost renders — top-level feed cards only.
    try {
      if (el.closest("shreddit-comment")) continue;
    } catch {}
    const p = scrapeFeedPost(el);
    if (!p || (!p.postId && !p.title)) continue;
    const key = p.postId || p.url || p.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...p, position: out.length + 1 });
  }
  return out;
}

/**
 * Parse a post-detail (PDP) page from the whole document.
 * Feed cards carry facts as <shreddit-post> ATTRIBUTES, but the PDP
 * <shreddit-post id="t3_<id>"> carries almost none — title lives in
 * <h1 id="post-title-t3_*"> / <shreddit-title title>, author in the
 * credit-bar link, body in <shreddit-post-text-body>. Without this,
 * image/media posts capture as "(untitled)" with no body.
 * Returns null when no post id can be established.
 */
function scrapePostDetail(doc, route = {}) {
  if (!doc) return null;
  const q = (sel) => {
    try {
      return doc.querySelector(sel);
    } catch {
      return null;
    }
  };
  let main = null;
  try {
    const els = Array.from(doc.querySelectorAll("shreddit-post:not([slot])"));
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
  let postId = route.postId || "";
  if (!postId && main) {
    const m = (attr(main, "id") || "").match(/t3_([a-z0-9]+)/);
    if (m) postId = m[1];
  }
  if (!postId) {
    try {
      const h1 = doc.querySelector('h1[id^="post-title-t3_"]');
      const m = (h1?.getAttribute("id") || "").match(/post-title-t3_([a-z0-9]+)/);
      if (m) postId = m[1];
    } catch {}
  }
  if (!postId) return null;
  // Title: feed attr → PDP h1 → shreddit-title → document title.
  let title = "";
  try {
    title = attr(main, "post-title") || "";
  } catch {}
  if (!title) {
    try {
      const h1 = q(`h1#post-title-t3_${postId}`) || q('h1[id^="post-title-t3_"]');
      title = textOf(h1);
    } catch {}
  }
  if (!title) {
    try {
      title = q("shreddit-title")?.getAttribute("title") || "";
      title = String(title).split(" : r/")[0].split(" : ")[0].trim();
    } catch {}
  }
  if (!title) {
    try {
      title = String(doc.title || "").split(" : r/")[0].trim();
    } catch {}
  }
  // Author: feed attr → PDP credit-bar link.
  let author = "";
  try {
    author = attr(main, "author") || "";
  } catch {}
  if (!author) {
    try {
      const scope = main || doc;
      const link = scope.querySelector('a[href*="/user/"]');
      const aria = link?.getAttribute("aria-label") || "";
      const m = aria.match(/Author:\s*(.+)/);
      author = (m ? m[1] : link?.textContent || "").replace(/^u\//, "").trim().replace(/\s+/g, " ");
    } catch {}
  }
  // Body: post element first, then document-wide PDP container fallback
  // (covers shells where the text-body renders outside <shreddit-post>).
  let body = "";
  try {
    body = extractPostBody(main);
  } catch {}
  if (!body) {
    try {
      body = textOf(q("shreddit-post-text-body")) || textOf(q('div[id*="-post-rtjson-content"]'));
      body = body.slice(0, 6000);
    } catch {}
  }
  let media = [];
  try {
    media = collectRedditMedia(main);
  } catch {}
  try {
    const docMedia = collectRedditMedia(doc);
    for (const u of docMedia) if (!media.includes(u)) media.push(u);
  } catch {}
  // Canonical link when the card exposes one.
  try {
    const href = attr(main, "content-href");
    if (href && !media.includes(href.split("?")[0])) media.unshift(href.split("?")[0]);
  } catch {}
  const feed = main ? scrapeFeedPost(main) : null;
  return {
    postId,
    title: title || feed?.title || "(untitled)",
    url: feed?.url || route.url || "",
    author: author || feed?.author || "",
    score: feed?.score || "",
    comments: feed?.comments || "",
    created: feed?.created || "",
    type: feed?.type || "",
    domain: feed?.domain || "",
    upvoteRatio: feed?.upvoteRatio || "",
    subreddit: feed?.subreddit || (route.subreddit ? `r/${route.subreddit}` : ""),
    flair: feed?.flair || "",
    stickied: Boolean(feed?.stickied),
    contentHref: feed?.contentHref || "",
    body: body || "",
    media,
  };
}

/** Subreddit header facts from visible sidebar text (receipted, best-effort). */
function scrapeSubredditHeader(doc, fallbackSub = "") {
  if (!doc) return { name: fallbackSub };
  const body = textOf(doc.body || doc).slice(0, 20000);
  const members = body.match(/([\d,]+)\s+members/i);
  const online = body.match(/([\d,]+)\s+online/i);
  let name = fallbackSub;
  try {
    const header = doc.querySelector("shreddit-subreddit-header-buttons");
    const prefixed = header?.getAttribute("prefixed-name") || header?.getAttribute("name") || "";
    if (prefixed) name = prefixed.replace(/^r\//, "");
  } catch {}
  return {
    name,
    members: members ? members[1] : "",
    online: online ? online[1] : "",
  };
}

/**
 * Parse one <shreddit-comment> defensively: attributes first
 * (author/depth/score/permalink/created-timestamp), body from
 * [slot="comment"] text. Returns null when nothing usable exists.
 */
function scrapeComment(el) {
  if (!el) return null;
  const q = (sel) => {
    try {
      return el.querySelector(sel);
    } catch {
      return null;
    }
  };
  const author = attr(el, "author");
  const body = textOf(q('[slot="comment"], div[id$="-comment-rtjson-content"]')) || "";
  const permalink = attr(el, "permalink");
  if (!author && !body && !permalink) return null;
  return {
    author: author || "[deleted]",
    depth: Number(attr(el, "depth") || 0),
    score: attr(el, "score"),
    created: attr(el, "created-timestamp"),
    permalink,
    url: permalink ? `https://www.reddit.com${permalink.split("?")[0]}` : "",
    body: body.slice(0, 4000),
  };
}

function scrapeComments(root, limit = 200) {
  if (!root) return [];
  let els = [];
  try {
    els = Array.from(root.querySelectorAll("shreddit-comment"));
  } catch {
    return [];
  }
  const out = [];
  for (const el of els) {
    const c = scrapeComment(el);
    if (c) out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

function buildRedditMarkdown({ route = {}, header = null, posts = [], comments = [], post = null, capturedAt = "", format = "full" }) {
  const at = capturedAt || new Date().toISOString();
  if (format === "links") {
    const urls = (posts.length ? posts.map((p) => p.url) : comments.map((c) => c.url)).filter(Boolean);
    return urls.join("\n");
  }
  if (format === "compact") {
    return posts
      .map((p) => `r/${route.subreddit}: ${p.title.slice(0, 120)} (⬆️ ${p.score || 0} · 💬 ${p.comments || 0})${p.url ? ` ${p.url}` : ""}`)
      .join("\n");
  }
  const lines = [];
  if (route.kind === "post" && post) {
    lines.push(`# ${post.title}`);
    lines.push("");
    lines.push("`reddit` `post`");
  } else {
    lines.push(`# r/${route.subreddit || header?.name || "unknown"}`);
    lines.push("");
    lines.push("`reddit` `subreddit`");
  }
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  if (header?.name) lines.push(`| Subreddit | r/${header.name} |`);
  if (header?.members) lines.push(`| Members | ${header.members} |`);
  if (header?.online) lines.push(`| Online | ${header.online} |`);
  if (route.postId) lines.push(`| Post ID | \`${route.postId}\` |`);
  if (post?.author) lines.push(`| Author | u/${post.author} |`);
  if (post?.score) lines.push(`| Score | ${post.score} |`);
  lines.push(`| URL | ${route.url || ""} |`);
  lines.push(`| Captured | ${at} |`);
  lines.push("");
  if (route.kind === "post") {
    if (post?.body) {
      lines.push("## Post");
      lines.push("");
      lines.push(post.body);
      lines.push("");
    } else {
      lines.push("> Post text not captured (media/link post, or body not rendered — scroll up to the post, then re-run).");
      lines.push("");
    }
    const media = Array.isArray(post?.media) ? post.media : [];
    if (media.length) {
      lines.push("## Media");
      lines.push("");
      media.forEach((src) => {
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(src)) lines.push(`![](${src})`);
        else lines.push(src);
      });
      lines.push("");
    }
    lines.push(`## Comments (${comments.length} captured)`);
    lines.push("");
    if (!comments.length) {
      lines.push("> No comments captured. Scroll the thread so comments render, then re-run capture.");
      lines.push("");
    } else {
      for (const c of comments) {
        lines.push(`${"  ".repeat(Math.min(c.depth, 6))}- **u/${c.author}** (⬆️ ${c.score || "?"})${c.url ? ` — ${c.url}` : ""}`);
        if (c.body) {
          c.body.split("\n").forEach((para) => {
            if (para.trim()) lines.push(`${"  ".repeat(Math.min(c.depth, 6))}  ${para.trim()}`);
          });
        }
      }
      lines.push("");
    }
  } else {
    lines.push(`## Posts (${posts.length} captured)`);
    lines.push("");
    if (!posts.length) {
      lines.push("> No posts captured. Scroll the feed so posts render, then re-run capture.");
      lines.push("");
    } else {
      posts.forEach((p) => {
        const meta = [`⬆️ ${p.score || 0}`, `💬 ${p.comments || 0}`, p.type || ""].filter(Boolean).join(" · ");
        lines.push(`${p.position}. [${p.title}](${p.url}) — u/${p.author || "?"} (${meta})`);
        if (p.contentHref) lines.push(`   ${p.contentHref}`);
      });
      lines.push("");
    }
  }
  lines.push("---");
  lines.push(`_Source: Reddit • ${route.url || ""} • captured ${at}_`);
  lines.push("");
  return lines.join("\n");
}

// Node / Vitest export; browser build attaches to window instead.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseRedditRoute,
    scrapeFeedPost,
    scrapeFeedPosts,
    scrapePostDetail,
    scrapeSubredditHeader,
    scrapeComment,
    scrapeComments,
    extractPostBody,
    collectRedditMedia,
    buildRedditMarkdown,
  };
} else if (typeof window !== "undefined") {
  window.RedditHelpers = {
    parseRedditRoute,
    scrapeFeedPost,
    scrapeFeedPosts,
    scrapePostDetail,
    scrapeSubredditHeader,
    scrapeComment,
    scrapeComments,
    extractPostBody,
    collectRedditMedia,
    buildRedditMarkdown,
  };
}
