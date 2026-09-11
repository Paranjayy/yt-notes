# Gehra Hua

`spotify` `playlist`

| Field | Value |
| --- | --- |
| Playlist | Gehra Hua |
| Owner | Paranjay |
| Songs | 136 songs |
| Total length | 8 hr 30 min |
| Playlist ID | `2ldKdMWDZw7D9P9RHawcYF` |
| URL | https://open.spotify.com/playlist/2ldKdMWDZw7D9P9RHawcYF |
| Captured | 2026-09-11 |

## Tracks

> Track rows were not snapshotted into this note — run the Social Companion playlist backup (🎵 widget → Backup tracks) on the live page. It auto-scrolls the grid until the row count stabilizes, then exports Markdown + CSV.

Sample row seen in the DOM (proves the parser anchors):

`Gehra Hua — Shashwat Sachdev, Arijit Singh, Irshad Kamil, Armaan Khan · Dhurandhar · 6:02`

## 🔗 Cross-platform note

Same split-catalog problem as episodes: playlist-only tracks vs YouTube uploads with different titles. The playlist CSV (`Position,Title,Artists,Album,Duration,URL`) plus `normalizeEpisodeTitle` matching is the bridge — match on title + artists + duration proximity.

---

## Fix notes (what was wrong with the previous version of this file)

1. **Raw 666 KB snapshot** — replaced with one structured note (same treatment as the episode dump).
2. **Mixed grids** — the dump contained both search-result rows (`spotify:playlist:…` list rows) and real track rows. The parser only accepts rows with `a[data-testid="internal-track-link"]` so search rows can never pollute a backup.
3. **Stable anchors** (see `spotify.js` → playlist route): grid `[data-testid="playlist-tracklist"]`, rows `div[role="row"]` (skip `aria-rowindex="1"` header), title `a[data-testid="internal-track-link"]`, artists `a[href^="/artist/"]`, album col-3 `a[href^="/album/"]`, duration col-5 clock text, explicit `[aria-label="Explicit"]`. Owner `a[data-testid="creator-link"]`, counts from header `N songs` / `about …` text. No hashed classes.

---
_Source: Spotify • https://open.spotify.com/playlist/2ldKdMWDZw7D9P9RHawcYF • cleaned 2026-09-11_
