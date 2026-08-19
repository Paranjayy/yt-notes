# Social Companion & YT Notes

[![Open DeepWiki](https://img.shields.io/badge/DeepWiki-Open-111827?logo=readthedocs)](https://deepwiki.com/Paranjayy/yt-notes)

Local-first browser companion for YouTube capture, notes, transcripts, playlist backups, and a web collector/library.

**Web collector:** [yt-notes-paranjayy-paranjay245s-projects.vercel.app](https://yt-notes-paranjayy-paranjay245s-projects.vercel.app/#collector)

## What it does

- Captures a video’s available page metadata, transcript, notes, comments, and recommendations into readable Markdown.
- Backs up visible playlist items and saves local JSON/CSV/Markdown captures.
- Collects selected public playlist or video transcripts from the website, with optional YouTube Data API enrichment and ZIP bundles.
- Provides local-first receipts for transcript state, mismatches, unavailable captions, and export outcomes.
- Converts Safari/clipboard link lists into clean Markdown locally, and provides opt-in guides for Reddit, X, and CRX workflows.

## Signed-in AI handoff

The extension can send deliberately captured page context to one or more of ChatGPT, Gemini, Claude, and Grok using the browser sessions you are already signed into. It is designed as a cross-browser popup workflow rather than a Chrome-only side panel.

- Choose one or many providers, then insert a draft or send it in the current/new provider chat.
- Press `Control + Shift + A` on macOS (or `Alt + Shift + A` elsewhere) for the explicit active-page mini palette; the shortcut is editable in the browser's extension-shortcuts settings.
- The provider’s own model picker and chat history remain the source of truth.
- Use the page-selection right-click menu for a fast single-provider handoff.
- Save local prompt recipes, re-run recent local prompts, and compare/copy/save the newest visible replies from every provider target as Markdown.
- On a synced YouTube watch/live/Shorts page, choose **Use saved YouTube capture** to send the structured local Markdown—metadata, notes, transcript, and visible comments—rather than a generic page excerpt. Prompt size is explicit: 4k, 12k, 30k, or full saved capture.

This is a visible-composer bridge, not account automation: it does **not** inspect or export cookies, OAuth/session tokens, private chats, account data, or network traffic. Provider web UIs can change, so a missing composer is reported in the popup instead of silently treated as success. The website intentionally offers copy-and-open handoff only; direct signed-in composer insertion requires the extension.

On the supported YT Notes Vercel site, Prompt Pack also has **Send with extension**. It can hand the same built prompt to the primary provider and optional extra providers in parallel; the extension replies only with success/failure, never with provider session or account data. Copy & open remains the single-provider fallback.

See [the product backlog](docs/youtube-product-backlog.md) for deliberately planned YouTube workflow features and their guardrails.

See [the provider bridge guide](docs/provider-bridge.md) for its exact scope and troubleshooting.
