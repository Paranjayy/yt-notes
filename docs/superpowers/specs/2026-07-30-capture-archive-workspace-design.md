# Capture, Archive, and Workspace Design

## Goal

Make YouTube capture reliable across YouTube's evolving watch URLs, retain captures beyond the clipboard, and give individual-video and playlist work distinct places to live.

## Decisions

- Keep capture local-first. The extension uses `chrome.storage.local` as its working archive and browser downloads for portable files. There is no paid or remote backend.
- Treat all recognised YouTube video routes as one canonical video identity. In particular, unwrap experimental `watch?v=/live/<id>` and `watch?v=/shorts/<id>` values before storage or widget work begins.
- React to YouTube SPA navigation events and DOM readiness, not just URL polling. A bounded readiness retry ensures late sidebars do not require refresh.
- Add extension context-menu commands for the active YouTube page: save a Markdown snapshot and open the archive dashboard. Both report a clear outcome through the existing toast UI when a content page is present.
- Make the toolbar action open an extension popup. The popup provides the active-page state, a save/download action, and a direct archive-dashboard button.
- Keep the dashboard as the durable local archive: it already reads notes, metadata and transcripts from extension storage. Add an explicit “download transcript” action per captured video, alongside existing Markdown export.
- Split the public website landing screen into two clearly named workspaces: “Video reader” for pasted Markdown and “Playlist archive” for exported playlist JSON/CSV. The website can import, browse, and re-export a playlist; it cannot scrape YouTube or create transcripts because a static hosted page has neither the extension page context nor an authorised API route.
- Every local save, download, missing transcript, malformed import, and unavailable capability gets a toast with the actual outcome. No success toast is emitted before the relevant browser operation is requested.

## Boundaries

This release does not download source video/audio, bypass site controls, send data to a backend, or add a remote transcript API. Those require separate platform/legal/product decisions. “Download” means the user’s own notes, metadata, transcript, screenshots metadata, and playlist archive.

## Data Flow

1. YouTube navigation normalises a video ID, waits for a valid watch/Shorts mount, and renders the widget.
2. Existing capture functions persist notes/transcripts/metadata locally. Explicit download commands generate Markdown or plain-text transcript files through the browser download manager.
3. Context menu/popup requests are relayed through the content script so the active page can generate an accurate current snapshot.
4. The dashboard reads the same local store; the public website only reads user-imported files/text in its own browser.

## Failure Handling

- Widget mount retries are bounded and only run while the original video ID is still current.
- Missing content scripts, unavailable transcripts, invalid URL shapes, unavailable playlist rows, and import parsing failures surface concise error toasts.
- A context-menu request that cannot reach the active tab opens the dashboard and explains why a page snapshot was not created.
