# DeepWiki capture

`deepwiki` `wiki-page` — same widget workflow as Reddit/X: **Capture → Copy /
Links / Download .md / 📸 DOM / 📸 High / 📋 Debug log**, plus the shared popup contract
(`sc_get_capture_status`, `sc_get_current_markdown`, … with
`platform: "deepwiki"`).

## Surfaces

- Public: `https://deepwiki.com/<owner>/<repo>` plus slug pages such as
  `/1-overview`.
- Devin (signed-in): `https://app.devin.ai/org/<org>/wiki/<owner>/<repo>/page/<id>`.

Only wiki repo/page routes are capture surfaces (`parseDeepwikiRoute`); Devin
home/chat/settings are excluded. Public wiki content only — no cookies,
tokens, or private chats are read or exported.

## Stable anchors (never hashed classes)

- Sidebar inventory: Devin `/wiki/.../page/...` links and public
  `/<owner>/<repo>/<page-slug>` links in sidebar order, deduped by absolute
  href (`scrapeDeepwikiSidebar`).
- Article: `[data-scroll-restoration-id="wiki-body"]`, fallback
  `main#main-content` → `main` → `article` (`findWikiBody`).
- Junk stripped from a detached clone: `button/form/input/textarea/nav/header/
  footer`, Devin prompt UI (`[data-devin-input-box]`, `[aria-label="Prompt"]`),
  source/citation controls, toolbars. Verified by jsdom tests fed with real
  pasted wiki HTML (`tests/unit/fixtures/deepwiki-page.html`).
- Rendered Mermaid diagrams (`svg.flowchart`, graphics-document SVGs) are
  preserved as fenced `svg` blocks; ordinary UI SVG icons remain stripped.

## Why live-DOM only (no fetch walk)

Devin's wiki is client-rendered React: `fetch(page.href)` returns the app
shell, and the wiki API (`/api/wiki/get_full_multi_language_wiki`) 404s from
outside the session — every fetched page extracts as "Could not find wiki
article". The exporter that worked navigated the live SPA and scraped the
  rendered `wiki-body` (43/43 pages). The extension does the same thing for the
  visible page: use a cheap heading/body stability check after SPA navigation,
  then clone and read the rendered article once, with an empty result receipted
  as "not rendered yet" instead of an empty page.

Console noise that is NOT a capture signal: `MediaSession`
`enterpictureinpicture`, Monaco `Unexpected usage`, Linear 404, mermaid
`Failed to render`, `aria-hidden` focus warnings.

## Diagnostics

The widget's **📋 Debug log** button copies a bounded, privacy-safe JSON report.
It includes route transitions, discovered/visited page counts, render waits,
skips, restore failures, timings, and output sizes. It deliberately omits
article text, cookies, tokens, and account data. Detailed console output can be
enabled by the shared `sc_debug_verbose` setting; errors and warnings are
always logged with the `[Social Companion:DeepWiki]` prefix.

## Multi-page capture

Capture, Copy, Download, the popup, and the right-click Save current capture
action walk every discovered sidebar page through the live SPA. Each page is
waited on until its rendered article passes the non-empty receipt threshold;
unrendered pages are skipped and reported rather than exported as empty
claims. After the walk, the original page is restored. No cookies, tokens, or
private chat content are read.
