# Social Companion & YT Note-Taker — Agent Guide

> Last updated: 2026-08-20 | Version: 1.10.0

This file documents everything an AI agent needs to know to work on this codebase without regressions.

## Quick Rules for Agents

1. **Bump the version** in `manifest.json` with every meaningful change. Use semver: patch (x.x.X) for bug fixes, minor (x.X.0) for new features.
2. **Test syntax** before every commit: `node -e "const fs=require('fs');['content.js','background.js','popup.js'].forEach(f=>{try{new Function(fs.readFileSync(f,'utf8'));console.log(f+': OK')}catch(e){console.error(f+': ERROR',e.message)}})"` from repo root.
3. **Never regress features.** All features from prior commits must still work after your changes.
4. **Commit often** — after each logical unit of work, `git add <files> && git commit -m 'type(scope): description' && git push`.
5. **dist/ is gitignored.** Only commit root-level files. `cp content.js background.js popup.js popup.html manifest.json dist/` for local testing if needed.
6. **No build step.** Raw JS files are loaded directly. No bundler, no transpiler.

## File Map

| File | Role |
|------|------|
| `manifest.json` | Extension manifest (MV3). Bump `version` here. |
| `content.js` | Main content script injected into YouTube, X, Reddit, Cambridge. ~3400 lines. All YouTube DOM interaction lives here. |
| `background.js` | Service worker. Context menus, keyboard commands, message bus, playlist queue orchestration, auto-capture. |
| `popup.html` | Extension popup UI shell. ~85 lines. |
| `popup.js` | Popup logic: AI providers, batch transcripts, playlist hub, uploads shortcut. |
| `helpers.js` | Tiny utility loaded before content.js. |
| `provider-bridge.js` | Injected into ChatGPT/Gemini/Claude/Grok pages to deliver prompts. |
| `quick-palette.js` | Injected on demand (Alt+Shift+A) for quick command palette on any page. |
| `dashboard.html` / `dashboard.js` | Full capture archive viewer. |
| `dictionary.js` | Cambridge Dictionary word list scraper. |
| `website-bridge.js` | Bridge for Vercel-hosted companion website. |
| `clipboard-vault/` | Local clipboard/vault integration specs. |

## Architecture

### MV3 Isolated World
Content scripts run in an **isolated world** — `window.ytInitialData` is UNDEFINED. Never rely on it. Use DOM selectors, `fetch(location.href)` with `credentials: 'omit'`, or `<script>` tag injection to read YouTube's page data.

### YouTube SPA Navigation
YouTube does NOT reload the page on navigation. It fires:
- `yt-navigate-finish` — navigation committed
- `yt-page-data-updated` — page data refreshed
- `popstate` — back/forward

`initYouTubeWatcher()` in `content.js` listens to all three + polls `location.href` every 1.5s. `onYouTubeUrlChange()` is the main routing function.

### Channel ID Extraction (`getOrExtractChannelId()`)
A 7-strategy async pipeline in `content.js`:
1. Parse `/channel/UC...` from URL
2. RSS feed `<link rel="alternate">` in `<head>`
3. Player response scripts (`videoDetails.channelId`)
4. `<meta itemprop="channelId">`
5. Scanning `<script>` tags for `externalId`/`channelId`/`browseId`
6. `<link rel="canonical">` and `<a href*="/channel/UC">` links
7. **Same-origin `fetch(location.href)`** fallback — guaranteed to find `"externalId":"UC..."` in raw HTML

Results are cached in `_cachedChannelId = { url, id }`.

### Key Storage Keys
| Key Pattern | Content |
|-------------|----------|
| `sc_meta_<videoId>` | Video metadata + transcript text |
| `sc_playlist_backup_<playlistId>` | Saved playlist backup JSON |
| `sc_prompt_recipes` | User's saved prompt recipes |
| `sc_auto_capture_mode` | `off` / `yolo` / `whitelist` |
| `sc_auto_capture_channels` | Comma-separated channel names for whitelist |
| `sc_provider_last_status` | Last AI provider interaction receipt |

### Message Types (content.js → background.js or popup.js → content.js)
| Message Type | Direction | Purpose |
|---|---|---|
| `sc_get_capture_status` | popup → content | Get current video ID + transcript status |
| `sc_get_current_markdown` | popup → content | Get full markdown export of current video |
| `sc_get_channel_id` | popup/bg → content | Get UC channel ID for current page |
| `sc_get_playlist_videos` | popup → content | Scrape visible playlist/queue videos |
| `sc_collect_transcript` | bg → content | Collect transcript from a background tab |
| `sc_download_current_markdown` | popup → content | Trigger markdown download |
| `sc_download_visible_playlist_backup` | popup → content | Download playlist JSON |
| `sc_collect_visible_playlist_transcripts` | popup → content | Start batch transcript collection |
| `sc_auto_capture_verified` | content → bg | Auto-capture a verified video |
| `sc_list_playlist_backups` | popup → bg | List all saved playlist backups |

## YouTube DOM Selectors (as of 2026)

| Element | Selector |
|---------|----------|
| Channel header action bar | `yt-flexible-actions-view-model` |
| Page header | `#page-header > yt-page-header-renderer > yt-page-header-view-model` |
| Video title (watch page) | `h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string` |
| Channel name (watch page) | `ytd-video-owner-renderer #channel-name a, #owner #channel-name a` |
| Playlist rows | `ytd-playlist-video-renderer` |
| Watch page queue/playlist panel | `ytd-playlist-panel-video-renderer` |
| Modern video cards | `yt-lockup-view-model` |
| Subscribe button container | `yt-flexible-actions-view-model` |
| Sidebar (recommendations) | `#secondary-inner, #secondary, #related` |

## Feature Catalog

| Feature | Status | Key Files |
|---------|--------|-----------|
| YouTube transcript capture | ✅ Stable | content.js |
| Notes widget (timestamped) | ✅ Stable | content.js |
| Auto-capture vault | ✅ Stable | content.js, background.js |
| AI provider bridge (ChatGPT/Gemini/Claude/Grok) | ✅ Stable | provider-bridge.js, background.js |
| Quick palette (Alt+Shift+A) | ✅ Stable | quick-palette.js |
| X/Twitter social capture | ✅ Stable | content.js |
| Cambridge word list export | ✅ Stable | dictionary.js |
| Dashboard/archive viewer | ✅ Stable | dashboard.html, dashboard.js |
| Channel uploads playlist button | 🔧 In Progress | content.js |
| Right-click context menu | 🔧 In Progress | background.js |
| Playlist/queue tracker | 🔧 In Progress | content.js, popup.js |
| Batch transcript extraction | 🔧 In Progress | popup.js, background.js |
| Playlist hub (saved backups) | 🔧 In Progress | popup.js, background.js |

## Git Commit Format
```
type(scope): short description

Longer explanation if needed.
```
Types: `feat`, `fix`, `refactor`, `chore`, `docs`
Scopes: `content`, `background`, `popup`, `manifest`, `agents`, `core`

Example: `feat(popup): add per-video transcript progress indicator for batch extraction`
