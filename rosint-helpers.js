/**
 * Rosint helpers — pure + DOM-only functions, no chrome APIs.
 * rosint.dev renders public Reddit archive data (Arctic Shift + PullPush)
 * with Tailwind utility classes, so selection uses STABLE hooks only:
 * aria-labels, roles, reddit hrefs, and text patterns — never hashed
 * or utility class names.
 */

function parseRosintRoute(urlString = "") {
  try {
    const url = new URL(urlString, "https://rosint.dev");
    if (url.hostname !== "rosint.dev") return { kind: "", username: "" };
    const user = (url.searchParams.get("u") || "").replace(/^u\//, "").trim();
    if (!user) return { kind: "", username: "" };
    return { kind: "profile", username: user, url: url.toString().split("#")[0] };
  } catch {
    return { kind: "", username: "" };
  }
}

function rosTextOf(el) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function rosAttr(el, name) {
  try {
    return el?.getAttribute?.(name) ?? "";
  } catch {
    return "";
  }
}

/** Profile header: username + optional stats bar + tab counts. */
function scrapeRosintProfile(doc, fallbackUsername = "") {
  if (!doc) return { username: fallbackUsername };
  const q = (sel) => {
    try {
      return doc.querySelector(sel);
    } catch {
      return null;
    }
  };
  let username = fallbackUsername;
  try {
    username = q('input[aria-label="Reddit username"]')?.value?.trim() || username;
  } catch {}
  if (!username) {
    try {
      const m = rosTextOf(q("main") || doc.body).match(/Results for\s+u\/([A-Za-z0-9_-]+)/);
      if (m) username = m[1];
    } catch {}
  }
  const out = { username };
  // Stats bar ("N archived posts · N comments · N karma · active since …").
  try {
    const body = rosTextOf(doc.body || doc).slice(0, 8000);
    const m = body.match(
      /Results for\s+u\/[A-Za-z0-9_-]+\s*(.*?)\s*(Posts|Filter Keywords)/s
    );
    const statsText = m ? m[1] : body.slice(0, 2000);
    const posts = statsText.match(/([\d,]+)\s+archived posts/i);
    const comments = statsText.match(/([\d,]+)\s+comments(?!.*tab)/i) || statsText.match(/([\d,]+)\s+comments/i);
    const karma = statsText.match(/([\d,]+)\s+karma/i);
    const since = statsText.match(/active since\s+([A-Za-z]+\s+\d{4})/i);
    if (posts) out.archivedPosts = posts[1];
    if (comments) out.comments = comments[1];
    if (karma) out.karma = karma[1];
    if (since) out.activeSince = since[1];
  } catch {}
  // Tab counts (Posts N / Comments N).
  try {
    const buttons = Array.from(doc.querySelectorAll("button"));
    for (const b of buttons) {
      const t = rosTextOf(b).slice(0, 60);
      let m = t.match(/^Posts?\s*([\d]+[+]?)/i);
      if (m) out.tabPosts = m[1];
      m = t.match(/^Comments?\s*([\d]+[+]?)/i);
      if (m) out.tabComments = m[1];
    }
  } catch {}
  return out;
}

/**
 * Innermost card container for an "open in reddit" anchor: climb until the
 * parent would contain a second card link, then stop. No class names used.
 */
function rosCardRoot(anchor) {
  let node = anchor;
  let best = anchor?.parentElement || null;
  try {
    for (let depth = 0; depth < 12 && node?.parentElement; depth++) {
      node = node.parentElement;
      const links = node.querySelectorAll('a[href*="reddit.com/r/"]');
      if (links.length === 1) best = node;
      else break;
    }
  } catch {}
  return best;
}

const ROS_SUB_RE = /^r\/[A-Za-z0-9_]+$/;
const ROS_ABS_RE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/;
const ROS_NUM_RE = /^-?\d{1,7}$/;

/** Parse one Rosint result card (post or comment). */
function scrapeRosintCard(card) {
  if (!card) return null;
  const qa = (sel) => {
    try {
      return Array.from(card.querySelectorAll(sel));
    } catch {
      return [];
    }
  };
  const link = qa('a[href*="reddit.com/r/"]').find((a) => /open in reddit/i.test(rosTextOf(a))) || qa('a[href*="reddit.com/r/"]')[0];
  const url = link?.getAttribute("href")?.split("?")[0] || "";
  if (!url) return null;
  const paras = qa("p").map(rosTextOf).filter(Boolean);
  const spans = qa("span").map(rosTextOf).filter(Boolean);
  const subreddit = spans.find((t) => ROS_SUB_RE.test(t)) || "";
  // Relative time merges with its tooltip ("42d agoAug 14, 2026…"), so match
  // by prefix instead of full equality.
  const timeRel = (spans.map((t) => (t.match(/^\d+[smhdwy] ago/i) || [])[0]).find(Boolean) || "");
  const timeAbs = (spans.find((t) => ROS_ABS_RE.test(t)) || "").slice(0, 60);
  const score = spans.find((t) => ROS_NUM_RE.test(t)) || "";
  const badges = spans
    .filter((t) => t && t !== subreddit && t !== timeAbs && t !== score && !/^\d+[smhdwy] ago/i.test(t) && t.length <= 30)
    .filter((t) => !/^Page \d+$/.test(t) && !/^(show|hide)\b/i.test(t) && !/open in reddit/i.test(t) && t !== "·")
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 6);
  let commentsCount = "";
  try {
    const m = rosTextOf(card).match(/show (\d+) comments?/i);
    if (m) commentsCount = m[1];
  } catch {}
  const title = paras[0] || "";
  const body = paras.slice(1).join("\n\n").slice(0, 6000);
  return { subreddit, timeRel, timeAbs, score, badges, commentsCount, title, body, url };
}

/** All result cards currently rendered under root, deduped by URL. */
function scrapeRosintCards(root) {
  if (!root) return [];
  let anchors = [];
  try {
    anchors = Array.from(root.querySelectorAll('a[href*="reddit.com/r/"]')).filter((a) =>
      /open in reddit/i.test(rosTextOf(a))
    );
  } catch {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const a of anchors) {
    const card = rosCardRoot(a);
    if (!card) continue;
    const c = scrapeRosintCard(card);
    if (!c || !c.url) continue;
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
  }
  return out;
}

/** Current results page number ("Page N"), default 1. */
function getRosintPage(doc) {
  if (!doc) return 1;
  try {
    const m = rosTextOf(doc.body || doc).match(/Page (\d+)/);
    if (m) return Number(m[1]);
  } catch {}
  return 1;
}

/** True when the Next-page button exists and is not disabled. */
function hasRosintNextPage(doc) {
  if (!doc) return false;
  try {
    const btn = doc.querySelector('button[aria-label="Next page"]');
    if (!btn) return false;
    return !btn.disabled && !btn.hasAttribute("disabled") && rosAttr(btn, "aria-disabled") !== "true";
  } catch {
    return false;
  }
}

/** Tab switcher button for "Posts" or "Comments" (or null). */
function findRosintTab(doc, name) {
  if (!doc) return null;
  try {
    const want = String(name).toLowerCase();
    return (
      Array.from(doc.querySelectorAll("button")).find((b) =>
        rosTextOf(b).toLowerCase().startsWith(want)
      ) || null
    );
  } catch {
    return null;
  }
}

function buildRosintMarkdown({
  route = {},
  profile = null,
  posts = [],
  comments = [],
  pagesCrawled = {},
  capturedAt = "",
  format = "full",
}) {
  const at = capturedAt || new Date().toISOString();
  const user = route.username || profile?.username || "unknown";
  if (format === "links") {
    return [...posts, ...comments].map((c) => c.url).filter(Boolean).join("\n");
  }
  if (format === "compact") {
    return [...posts, ...comments]
      .map((c) => `${c.subreddit || ""} ${c.title.slice(0, 120)} (⬆️ ${c.score || 0})${c.url ? ` ${c.url}` : ""}`)
      .join("\n");
  }
  const lines = [];
  lines.push(`# u/${user} — Rosint archive`);
  lines.push("");
  lines.push("`rosint` `reddit-archive` `profile`");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Username | u/${user} |`);
  if (profile?.archivedPosts) lines.push(`| Archived posts | ${profile.archivedPosts} |`);
  if (profile?.tabPosts) lines.push(`| Posts tab | ${profile.tabPosts} |`);
  if (profile?.tabComments) lines.push(`| Comments tab | ${profile.tabComments} |`);
  if (profile?.comments) lines.push(`| Comments | ${profile.comments} |`);
  if (profile?.karma) lines.push(`| Karma | ${profile.karma} |`);
  if (profile?.activeSince) lines.push(`| Active since | ${profile.activeSince} |`);
  lines.push(`| URL | ${route.url || ""} |`);
  lines.push(`| Sources | Arctic Shift + PullPush (via Rosint) |`);
  if (pagesCrawled.posts || pagesCrawled.comments) {
    lines.push(`| Pages crawled | posts: ${pagesCrawled.posts || 0}, comments: ${pagesCrawled.comments || 0} |`);
  }
  lines.push(`| Captured | ${at} |`);
  lines.push("");
  const section = (title, items) => {
    lines.push(`## ${title} (${items.length} captured)`);
    lines.push("");
    if (!items.length) {
      lines.push("> Nothing captured on this tab. Switch to it so results render, then re-run capture.");
      lines.push("");
      return;
    }
    items.forEach((c, i) => {
      const meta = [c.subreddit, c.timeRel || c.timeAbs, c.score ? `⬆️ ${c.score}` : ""]
        .filter(Boolean)
        .join(" · ");
      lines.push(`### ${i + 1}. ${c.title || "(no title)"}${meta ? ` — ${meta}` : ""}`);
      lines.push("");
      if (c.badges?.length) lines.push(`_${c.badges.join(" · ")}_`);
      if (c.badges?.length) lines.push("");
      if (c.body) {
        c.body.split("\n").forEach((para) => {
          if (para.trim()) lines.push(para.trim());
        });
        lines.push("");
      } else {
        lines.push("_(body not expanded — expand the card on Rosint, then re-run)_");
        lines.push("");
      }
      if (c.commentsCount) lines.push(`💬 ${c.commentsCount} comments`);
      if (c.url) lines.push(c.url);
      lines.push("");
    });
  };
  section("Posts", posts);
  section("Comments", comments);
  lines.push("---");
  lines.push(`_Source: Rosint • ${route.url || ""} • captured ${at}_`);
  lines.push("");
  return lines.join("\n");
}

// Node / Vitest export; browser build attaches to window instead.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseRosintRoute,
    scrapeRosintProfile,
    scrapeRosintCard,
    scrapeRosintCards,
    getRosintPage,
    hasRosintNextPage,
    findRosintTab,
    buildRosintMarkdown,
  };
} else if (typeof window !== "undefined") {
  window.RosintHelpers = {
    parseRosintRoute,
    scrapeRosintProfile,
    scrapeRosintCard,
    scrapeRosintCards,
    getRosintPage,
    hasRosintNextPage,
    findRosintTab,
    buildRosintMarkdown,
  };
}
