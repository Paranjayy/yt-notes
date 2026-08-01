# Platform Capture & Download Ideas

This is an idea backlog, not a promise to bypass platform rules, paid access, DRM, or creator controls. Build only around content the user is allowed to access and download, with clear platform-specific limits.

## Near-term: capture, archive, and export

### Twitch chat downloader

- Paste a Twitch VOD or clip URL, select a time range and export chat as JSON, CSV, and readable Markdown.
- Include chat replay availability, viewer timestamp, emotes/badges as optional fields, and clear “chat unavailable” results.
- Keep the interaction simple: URL → format/range → download, inspired by Twitch Chat Downloader’s single-purpose flow.

### Cross-platform conversation export

- YouTube: transcripts, comments, playlist metadata, live chat where the page exposes it.
- Twitch: VOD/clip chat export and stream metadata.
- X and Reddit: extend the existing post/thread capture into richer exports with media links, reply trees, and author/date filters.
- Instagram: only user-visible/public page metadata and captions that the platform allows the extension to read; clearly label unavailable/private content.

### Unified archive format

- Define a versioned `social-companion-archive` JSON format: source, canonical URL, capture time, permissions/availability, media metadata, text/captions/chat, and export provenance.
- Use it for dashboard import, website viewing, diffing, and long-term backups.
- Add content hashes and a change report for playlist/thread backups: added, removed, changed, unavailable.

## Media download exploration — constrained by permissions

### Source-aware download handoff

- Detect only direct, browser-exposed downloadable assets (for example a creator-provided MP4 or an allowed HLS manifest).
- Present a “Download options” sheet with format, resolution, audio/video, estimated size, and a platform-rights warning.
- Never represent DRM-protected, paid, private, or access-controlled media as downloadable.

### Local M3U8 inspection/player

- Build an offline inspector/player for an M3U8 URL or local manifest the user already has permission to use.
- Show master variants, codecs, segment count, duration, captions/audio tracks, and playback health.
- Export an inspection report; use a native companion only for permitted local remux/download workflows.

### Optional native companion

- Keep the browser extension focused on capture/orchestration.
- A local desktop helper could handle large permitted downloads, muxing, resumable files, and Safari/macOS integration without shipping risky browser-side download logic.
- Evaluate a Chrome-extension-to-Safari conversion path after the web-extension APIs used by the queue and native helper are mapped.

### Safari conversion assistant (future)

- Input: an extracted Chromium extension folder, source ZIP, or source repository — never a promise that a CRX installs in Safari.
- Output: a local compatibility report and guided invocation of `safari-web-extension-converter`, with the original manifest, host permissions, service worker, content scripts, commands, and Chrome-only APIs surfaced first.
- Keep signing, provisioning, Xcode project review, and installation explicit user steps. A future tool can generate an auditable checklist but must not silently convert, sign, or install third-party code.
- Treat Viaduct-like convenience as product inspiration only: Safari produces an app-extension project, so conversion can require manual API rewrites and Apple review constraints.

## Product references and lessons

- Twitch Chat Downloader: deliberately narrow flow, no-registration language, desktop-first UX. Reuse the “one URL, one clear export” interaction rather than its implementation.
- Twitch VOD Downloader: shows how quickly media availability becomes complex (clips, highlights, expiry, missing segments, account/auth state). Treat availability and failure states as first-class product data.
- cobalt: strong “paste link → choose output → save” interaction. Borrow the low-friction UI principle, not service-specific extraction or policy assumptions.

## Research before implementation

- Per-platform terms, API eligibility, authentication scope, content-owner rights, retention/expiry behavior, and rate limits.
- Browser Web Store and Safari review requirements for media/download features.
- Whether a platform gives the signed-in user an official export/download route; prefer it over scraping.
- Privacy: keep captures local by default, disclose any API key or account token use, and never store credentials in exports.

## Suggested delivery order

1. Twitch chat archive and unified archive schema.
2. Backup diffing and availability/change receipts in the dashboard/website.
3. Allowed-asset inspector and local M3U8 report.
4. Native companion feasibility spike and Safari conversion map.
