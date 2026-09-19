/**
 * DeepWiki helpers — pure + DOM-only functions, no chrome APIs.
 * Covers public deepwiki.com repo/page routes and Devin's authenticated
 * app.devin.ai wiki routes (client-rendered React; fetch() returns the app
 * shell, so extraction must run against the live DOM, never fetched HTML).
 *
 * Stable anchors only (never hashed classes):
 * - sidebar pages: a[href*="/wiki/"][href*="/page/"]
 * - article: [data-scroll-restoration-id="wiki-body"], main#main-content, main, article
 */

function parseDeepwikiRoute(urlString = "") {
  try {
    const url = new URL(urlString, "https://deepwiki.com");
    const host = url.hostname;
    const parts = url.pathname.split("/").filter(Boolean);

    // Public DeepWiki: deepwiki.com/<owner>/<repo>[/<page-slug>]
    if (/(^|\.)deepwiki\.com$/.test(host)) {
      if (parts.length < 2) return { kind: "", host: "deepwiki", owner: "", repo: "", pageId: "" };
      const [owner, repo, ...rest] = parts;
      const pageId = rest.join("/");
      return { kind: pageId ? "page" : "repo", host: "deepwiki", owner, repo, pageId, url: url.toString().split("?")[0] };
    }

    // Devin wiki: app.devin.ai/org/<org>/wiki/<owner>/<repo>[/page/<id>]
    if (/(^|\.)app\.devin\.ai$/.test(host)) {
      const wikiIdx = parts.indexOf("wiki");
      if (wikiIdx < 0 || parts.length < wikiIdx + 3) return { kind: "", host: "devin", owner: "", repo: "", pageId: "" };
      const owner = parts[wikiIdx + 1];
      const repo = parts[wikiIdx + 2];
      const pageIdx = parts.indexOf("page", wikiIdx + 3);
      const pageId = pageIdx >= 0 && parts[pageIdx + 1] ? parts[pageIdx + 1] : "";
      const branch = url.searchParams.get("branch") || "";
      const base = { host: "devin", owner, repo, pageId, branch, url: url.toString().split("?")[0] };
      return pageId ? { ...base, kind: "page" } : { ...base, kind: "repo" };
    }

    return { kind: "", host: "", owner: "", repo: "", pageId: "" };
  } catch {
    return { kind: "", host: "", owner: "", repo: "", pageId: "" };
  }
}

function linkTitle(link) {
  try {
    return (link.getAttribute("aria-label") || link.textContent || "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

/**
 * Discover sidebar wiki pages in sidebar order, deduped by absolute href.
 * Returns [{ id, title, href }]. Page discovery is the reliable part;
 * extraction is what fails when the article hasn't rendered yet.
 */
function scrapeDeepwikiSidebar(root, baseUrl = "") {
  if (!root || !root.querySelectorAll) return [];
  let links = [];
  try {
    const baseRoute = parseDeepwikiRoute(baseUrl);
    if (baseRoute.host === "deepwiki") {
      links = Array.from(root.querySelectorAll("a[href]"));
    } else {
      links = Array.from(root.querySelectorAll('a[href*="/wiki/"][href*="/page/"]'));
    }
  } catch {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const link of links) {
    let href = "";
    try {
      const rawHref = link.getAttribute("href") || link.href || "";
      href = rawHref && baseUrl ? new URL(rawHref, baseUrl).toString() : rawHref;
    } catch {
      continue;
    }
    if (!href || seen.has(href)) continue;
    const linkedRoute = parseDeepwikiRoute(href);
    const baseRoute = parseDeepwikiRoute(baseUrl);
    let id = "";
    if (baseRoute.host === "deepwiki") {
      if (linkedRoute.host !== "deepwiki" || linkedRoute.owner !== baseRoute.owner || linkedRoute.repo !== baseRoute.repo || linkedRoute.kind !== "page") continue;
      id = linkedRoute.pageId;
    } else {
      const match = href.match(/\/page\/([^/?#]+)/);
      if (!match) continue;
      id = match[1];
    }
    const title = linkTitle(link);
    if (!title) continue;
    seen.add(href);
    out.push({ id, title, href: href.split("#")[0] });
  }
  return out;
}

/** Live article element (rendered React), or null when not yet rendered. */
function findWikiBody(root) {
  if (!root || !root.querySelector) return null;
  try {
    return (
      root.querySelector('[data-scroll-restoration-id="wiki-body"]') ||
      root.querySelector("main#main-content") ||
      root.querySelector("main") ||
      root.querySelector("article") ||
      null
    );
  } catch {
    return null;
  }
}

const DEEPWIKI_JUNK_SELECTORS = [
  "button",
  "form",
  "input",
  "textarea",
  "select",
  "nav",
  "header",
  "footer",
  "script",
  "style",
  "noscript",
  "iframe",
  "template",
  '[role="navigation"]',
  '[role="toolbar"]',
  "[data-devin-input-box]",
  '[aria-label="Prompt"]',
  '[data-testid*="source"]',
  '[data-testid*="citation"]',
];

/** Strip UI chrome from a detached clone. Mutates + returns the node. */
function cleanWikiNode(root) {
  if (!root || !root.querySelectorAll) return root;
  for (const selector of DEEPWIKI_JUNK_SELECTORS) {
    try {
      root.querySelectorAll(selector).forEach((el) => el.remove());
    } catch {}
  }
  try {
    root.querySelectorAll("svg").forEach((svg) => {
      svg.innerHTML = "<!-- [SVG CONTENT STRIPPED] -->";
    });
  } catch {}
  return root;
}

function cleanText(text) {
  return String(text || "")
    .replace(/ /g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inlineMarkdown(node) {
  if (!node) return "";
  if (node.nodeType === 3) {
    return (node.nodeValue || "").replace(/ /g, " ").replace(/\s+/g, " ");
  }
  if (node.nodeType !== 1) return "";
  const tag = (node.tagName || "").toLowerCase();
  if (node.matches) {
    try {
      if (node.matches('[data-testid*="source"], [data-testid*="citation"], [aria-hidden="true"]')) return "";
    } catch {}
  }
  const children = Array.from(node.childNodes || []).map(inlineMarkdown).join("");
  switch (tag) {
    case "strong":
    case "b":
      return `**${children.trim()}**`;
    case "em":
    case "i":
      return `*${children.trim()}*`;
    case "del":
    case "s":
      return `~~${children.trim()}~~`;
    case "code":
      if (node.parentElement && (node.parentElement.tagName || "").toLowerCase() === "pre") return children;
      return `\`${children.trim()}\``;
    case "a": {
      const href = node.getAttribute ? node.getAttribute("href") : "";
      const text = children.trim();
      if (!text) return "";
      if (!href) return text;
      return `[${text}](${href})`;
    }
    case "br":
      return "\n";
    case "img": {
      const src = node.getAttribute ? node.getAttribute("src") : "";
      const alt = node.getAttribute ? node.getAttribute("alt") || "" : "";
      if (!src) return alt;
      return `![${alt}](${src})`;
    }
    default:
      return children;
  }
}

function blockMarkdown(node, depth = 0) {
  if (!node || node.nodeType !== 1) return "";
  const tag = (node.tagName || "").toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const text = cleanText(inlineMarkdown(node));
    return text ? `${"#".repeat(Number(tag[1]))} ${text}\n\n` : "";
  }
  if (tag === "p") {
    const text = cleanText(inlineMarkdown(node));
    return text ? `${text}\n\n` : "";
  }
  if (tag === "pre") {
    const code = (node.innerText || node.textContent || "").replace(/\r/g, "").replace(/\n+$/, "");
    let language = "";
    try {
      const codeEl = node.querySelector("code");
      const match = codeEl ? Array.from(codeEl.classList || []).map((c) => (c.match(/^language-(.+)$/) || [])[1]).find(Boolean) : "";
      if (match) language = match;
    } catch {}
    return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  }
  if (tag === "blockquote") {
    const text = cleanText(inlineMarkdown(node));
    if (!text) return "";
    return `${text.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  }
  if (tag === "ul" || tag === "ol") {
    const ordered = tag === "ol";
    const items = Array.from(node.children || []).filter((c) => (c.tagName || "").toLowerCase() === "li");
    let output = "";
    items.forEach((li, index) => {
      const clone = li.cloneNode(true);
      Array.from(clone.querySelectorAll ? clone.querySelectorAll(":scope > ul, :scope > ol") : []).forEach((n) => n.remove());
      const text = cleanText(inlineMarkdown(clone));
      output += `${"  ".repeat(depth)}${ordered ? `${index + 1}. ` : "- "}${text}\n`;
      Array.from(li.children || [])
        .filter((c) => ["ul", "ol"].includes((c.tagName || "").toLowerCase()))
        .forEach((nested) => {
          output += blockMarkdown(nested, depth + 1);
        });
    });
    return `${output}\n`;
  }
  if (tag === "table") {
    const rows = Array.from(node.querySelectorAll ? node.querySelectorAll("tr") : []);
    if (!rows.length) return "";
    const matrix = rows.map((row) =>
      Array.from(row.children || []).map((cell) => cleanText(inlineMarkdown(cell)).replace(/\|/g, "\\|"))
    );
    const width = Math.max(...matrix.map((r) => r.length));
    matrix.forEach((r) => {
      while (r.length < width) r.push("");
    });
    let output = `| ${matrix[0].join(" | ")} |\n| ${matrix[0].map(() => "---").join(" | ")} |\n`;
    for (const row of matrix.slice(1)) output += `| ${row.join(" | ")} |\n`;
    return `${output}\n`;
  }
  if (tag === "hr") return "\n---\n\n";
  if (tag === "img") {
    const src = node.getAttribute ? node.getAttribute("src") : "";
    const alt = node.getAttribute ? node.getAttribute("alt") || "" : "";
    if (!src) return "";
    return `![${alt}](${src})\n\n`;
  }
  if (["div", "section", "article", "main", "aside", "figure", "figcaption"].includes(tag)) {
    return Array.from(node.childNodes || [])
      .map((child) => {
        if (child.nodeType === 3) {
          const text = cleanText(child.nodeValue);
          return text ? `${text}\n\n` : "";
        }
        return blockMarkdown(child, depth);
      })
      .join("");
  }
  return inlineMarkdown(node);
}

function wikiNodeToMarkdown(root) {
  if (!root || !root.childNodes) return "";
  return cleanText(
    Array.from(root.childNodes)
      .map((node) => (node.nodeType === 1 ? blockMarkdown(node) : ""))
      .join("")
  ).replace(/\n{3,}/g, "\n\n");
}

/**
 * Extract the currently rendered article as Markdown.
 * Returns "" when the SPA hasn't rendered the article yet — the caller must
 * receipt that as "not rendered", never as an empty page.
 */
function extractWikiMarkdown(doc) {
  const body = findWikiBody(doc);
  if (!body) return "";
  const clone = body.cloneNode(true);
  cleanWikiNode(clone);
  return wikiNodeToMarkdown(clone);
}

function slugifyTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function buildDeepwikiMarkdown({ route = {}, pageTitle = "", pageId = "", markdown = "", pages = [], articles = [], capturedAt = "", url = "", format = "full" } = {}) {
  const at = capturedAt || new Date().toISOString();
  const repo = route.owner && route.repo ? `${route.owner}/${route.repo}` : "unknown repo";
  if (format === "links") return (pages || []).map((p) => p.href).filter(Boolean).join("\n");
  if (format === "compact") {
    return (pages || []).map((p) => `${p.id} — ${p.title}`).join("\n");
  }
  const lines = [];
  lines.push(`# ${pageTitle || `${repo} — DeepWiki`}`);
  lines.push("");
  lines.push("`deepwiki` `wiki-page`");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Repository | ${repo} |`);
  if (pageId) lines.push(`| Page | \`${pageId}\` |`);
  if (route.branch) lines.push(`| Branch | \`${route.branch}\` |`);
  lines.push(`| URL | ${url || route.url || ""} |`);
  lines.push(`| Pages discovered | ${(pages || []).length} |`);
  lines.push(`| Captured | ${at} |`);
  lines.push("");
  const capturedArticles = (articles || []).filter((article) => article?.markdown && article.markdown.trim().length >= 50);
  if (capturedArticles.length > 0) {
    lines.push(`## Articles (${capturedArticles.length} captured)`);
    lines.push("");
    for (const article of capturedArticles) {
      lines.push(`### ${article.title || article.id || "Wiki page"}`);
      lines.push("");
      lines.push(`Source: ${article.url || ""}`);
      lines.push("");
      lines.push(article.markdown.trim());
      lines.push("");
    }
  } else if (markdown && markdown.trim().length >= 50) {
    lines.push("## Article");
    lines.push("");
    lines.push(markdown.trim());
    lines.push("");
  } else {
    lines.push("> Wiki article not captured (page not rendered — wait for it to load, then re-run).");
    lines.push("");
  }
  lines.push(`## Wiki pages (${(pages || []).length} discovered)`);
  lines.push("");
  if (!(pages || []).length) {
    lines.push("> No sidebar pages discovered. Open the wiki so the sidebar renders, then re-run.");
    lines.push("");
  } else {
    for (const p of pages) {
      lines.push(`- [${p.title}](#${slugifyTitle(p.title)}) — \`${p.id}\` ${p.href}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push(`_Source: DeepWiki • ${url || route.url || ""} • captured ${at}_`);
  lines.push("");
  return lines.join("\n");
}

// Node / Vitest export; browser build attaches to window instead.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseDeepwikiRoute,
    scrapeDeepwikiSidebar,
    findWikiBody,
    cleanWikiNode,
    wikiNodeToMarkdown,
    extractWikiMarkdown,
    buildDeepwikiMarkdown,
    slugifyTitle,
  };
} else if (typeof window !== "undefined") {
  window.DeepwikiHelpers = {
    parseDeepwikiRoute,
    scrapeDeepwikiSidebar,
    findWikiBody,
    cleanWikiNode,
    wikiNodeToMarkdown,
    extractWikiMarkdown,
    buildDeepwikiMarkdown,
    slugifyTitle,
  };
}
