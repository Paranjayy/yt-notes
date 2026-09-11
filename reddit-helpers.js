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
  };
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
    scrapeSubredditHeader,
    scrapeComment,
    scrapeComments,
    buildRedditMarkdown,
  };
} else if (typeof window !== "undefined") {
  window.RedditHelpers = {
    parseRedditRoute,
    scrapeFeedPost,
    scrapeFeedPosts,
    scrapeSubredditHeader,
    scrapeComment,
    scrapeComments,
    buildRedditMarkdown,
  };
}
