# CHROMEWEBSTORE.md — store submission tracker

Maintained per the Chrome Extensions skill guidance. Update this file on
every manifest permission/host change before submitting.

## Single purpose

Local-first capture companion: notes, transcripts, playlists, threads, and
lyrics from pages the user already has open, exported as local
Markdown/JSON/CSV. No account, no server, no data collection.

## Permission justifications (for the Developer Dashboard)

| Permission | Why it is needed |
| --- | --- |
| `storage` | Local notes, captures, widget positions, recipes — all on-device. |
| `activeTab` | Read the open page's visible content for capture + AI handoff. |
| `clipboardWrite` / `clipboardRead` | Copy captures to clipboard; read clipboard for vault import flows. |
| `tabs` | Identify the active tab for popup capture + provider-tab routing. |
| `scripting` | Fallback DOM snapshot/annotator on pages without a content script; palette injection on keyboard command. |
| `contextMenus` | Right-click: save capture, playlist backup, AI snapshot (Low/High), element annotator, ask-selection. |
| `downloads` | Save Markdown/JSON/CSV/ZIP captures to the user's Downloads folder. |

Host permissions map 1:1 to capture surfaces: YouTube, Spotify (+ `scdn.co`
artwork), X/Twitter, Reddit, DeepWiki (`deepwiki.com` + Devin `app.devin.ai`
wiki pages, same visible-page capture model), Cambridge Dictionary wordlists, the four AI
provider composers (user-invoked handoff only), Google APIs (YouTube Data
enrichment with a user-supplied key), and the companion website bridge.

## Privacy

- No cookies, OAuth/session tokens, private messages, or account data are
  read or exported — enforced by AGENTS.md capture rules and receipted in
  every export (`Transcript Status` lines derive from embedded content).
- Page-session tokens (e.g. Spotify web-player token) are fetched
  same-origin and used only for that page's own transcript endpoint.
- No remote code, no analytics, no network calls except the page's own
  endpoints and user-configured API enrichment.

## Pre-submit checklist

- [ ] `manifest.json` description lists all current surfaces.
- [ ] Version bumped in `manifest.json` + `package.json` (must match).
- [ ] Screenshots show the floating widgets on YouTube + one more surface.
- [ ] Privacy policy URL points at the repo privacy section.
- [ ] This file's permission table matches `manifest.json` exactly.
