# DeepWiki capture

`deepwiki` `wiki-page` — same widget workflow as Reddit/X: **Capture → Copy /
Links / Download .md / 📸 DOM / 📸 High**, plus the shared popup contract
(`sc_get_capture_status`, `sc_get_current_markdown`, … with
`platform: "deepwiki"`).

## Surfaces

- Public: `https://deepwiki.com/<owner>/<repo>` (+ `/page/<id>` variants).
- Devin (signed-in): `https://app.devin.ai/org/<org>/wiki/<owner>/<repo>/page/<id>`.

Only wiki repo/page routes are capture surfaces (`parseDeepwikiRoute`); Devin
home/chat/settings are excluded. Public wiki content only — no cookies,
tokens, or private chats are read or exported.

## Stable anchors (never hashed classes)

- Sidebar inventory: `a[href*="/wiki/"][href*="/page/"]` in sidebar order,
  deduped by absolute href (`scrapeDeepwikiSidebar`).
- Article: `[data-scroll-restoration-id="wiki-body"]`, fallback
  `main#main-content` → `main` → `article` (`findWikiBody`).
- Junk stripped from a detached clone: `button/form/input/textarea/nav/header/
  footer`, Devin prompt UI (`[data-devin-input-box]`, `[aria-label="Prompt"]`),
  source/citation controls, toolbars. Verified by jsdom tests fed with real
  pasted wiki HTML (`tests/unit/fixtures/deepwiki-page.html`).

## Why live-DOM only (no fetch walk)

Devin's wiki is client-rendered React: `fetch(page.href)` returns the app
shell, and the wiki API (`/api/wiki/get_full_multi_language_wiki`) 404s from
outside the session — every fetched page extracts as "Could not find wiki
article". The exporter that worked navigated the live SPA and scraped the
rendered `wiki-body` (43/43 pages). The extension does the same thing for the
visible page: wait ~600ms after SPA navigation, read the rendered article,
receipt an empty result as "not rendered yet" instead of an empty page.

Console noise that is NOT a capture signal: `MediaSession`
`enterpictureinpicture`, Monaco `Unexpected usage`, Linear 404, mermaid
`Failed to render`, `aria-hidden` focus warnings.

## Scope note

v1 captures the rendered page + sidebar inventory. A full multi-page
auto-walk (click each sidebar link, wait, scrape, next) is intentionally out
of scope — it would navigate the user away from their page. Use the console
exporter from the linked chat for one-shot 43-page dumps; use this widget for
per-page captures.
