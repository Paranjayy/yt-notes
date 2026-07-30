# YouTube Video Resilience and Backup Design

## Goal

Make Social Companion work reliably for any practical YouTube video URL, reduce the effort required to copy captured information, and establish a no-key playlist backup path with optional API enrichment.

## Extension video identity

The extension will resolve a video ID in priority order: standard `v` query parameter; known video paths (`watch`, `live`, `shorts`, `embed`, and `v`); the `youtu.be/<id>` path; then YouTube's loaded player payload and canonical URL.  Only a resolved ID activates the video widget.  All saved metadata, timestamp links, exports, and dashboard links will use the canonical `https://www.youtube.com/watch?v=<id>` form.

`youtu.be` will be included in the manifest and handled with the same content script. This does not distinguish livestreams, premieres, shorts, or regular uploads; they all resolve to a single video ID.

## Effortless capture UI

Notes remains the default tab. A compact quick-copy row supplies one-click copies for: notes, transcript, description, and metadata/stats. The existing Notes, Transcript, and Export tabs and their buttons remain available. The embedded widget changes from the current high-saturation purple/pink gradients to neutral dark surfaces with a single restrained violet accent.

## Playlist backup

The first playlist feature runs on a YouTube playlist page: it collects currently rendered playlist rows, deduplicates by video ID, offers an assisted scroll-to-load-all action, and exports CSV, JSON, and Markdown. It is keyless and works with pages that the signed-in user can open.

An optional API-key mode may later enrich public/unlisted playlists through YouTube Data API v3. A user supplies their own key; the key is stored locally and never bundled, transmitted to a project server, or required for the keyless path. API mode is an enhancement for completeness, not a dependency.

## Website importer

The website will accept Social Companion Markdown plus playlist JSON/CSV backups, provide a local viewer and download/export utility, and stay static: no backend, account, or paid service.

## Compatibility and failure behavior

Existing `watch?v=` notes retain their storage keys and rendering. URL parsing failures do not alter stored data; the widget simply remains absent until the player payload or canonical URL provides a valid ID. Playlist rows that lack a recoverable video ID are exported as unavailable records rather than discarded.
