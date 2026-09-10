# Madeline Argy Debrief: Toxic Relationships

`spotify` `podcast-episode` `explicit` `no-transcript`

| Field | Value |
| --- | --- |
| Episode | Madeline Argy Debrief: Toxic Relationships |
| Show | Call Her Daddy |
| Published | Oct 1, 2023 |
| Duration | 27 min 35 sec |
| Episode ID | `7EalRVaDJXlXYHkYxZWKvX` |
| URL | https://open.spotify.com/episode/7EalRVaDJXlXYHkYxZWKvX |
| Show link | https://open.spotify.com/show/7bnjJ7Va1nM07Um4Od55dW |
| Captured | 2026-09-10T16:30:06.754Z |
| Transcript status | Available via Transcript tab — untimed, speaker-grouped (Speaker 1/2), auto-generated disclaimer; timed cues via transcript-read-along API |

## Description

Come join Father Cooper for a debrief of the Madeline Argy episode. She discusses the behind the scenes process of creating this episode with Madeline and reveals this was actually *not* their first time podcasting together. Alex shares footage from their original sit-down interview that includes a cheating story from one of Madeline's toxic exes, a boundary crossing ex best friend and a more serious chat about anxiety. Alex also expands on one of the most discussed moments from last week's episode with Madeline - toxic relationships and knowing when it's time to leave. Come hangout and spend even more time with Madeline and Alex.

Hosted by Simplecast, an AdsWizz company. See pcm.adswizz.com for information about our collection and use of personal data for advertising.

## Transcript

> Panel verified present: `#transcript-panel` with `Speaker 1`/`Speaker 2` rows and an auto-generated disclaimer (`This transcript was generated automatically. Its accuracy may vary.`). To capture: open the episode while logged in → Transcript tab → 🎙️ widget → Sync transcript (timed API first, speaker-grouped tab fallback).

## 🔗 Cross-platform match (split / scattered episodes)

Spotify-exclusive episodes often get split or re-uploaded on YouTube with slightly different titles ("Debrief", "Full Episode", "Part 1/2"). Before treating them as the same episode, verify:

1. Normalized title overlap (the extension's `normalizeEpisodeTitle` strips `• Show`, `(Full Episode)`, `| Show` suffixes).
2. Duration proximity — this episode is **27:35**; a YouTube match should be within ~1 min unless it's an explicit Part 1/Part 2 split.
3. Publish date — Spotify says **Oct 1, 2023**; the YouTube counterpart should be same-week, not months apart.

To link a YouTube counterpart to this episode, open this episode page and run in the console (or use the widget once linked):

```js
chrome.storage.local.set({
  sc_spotify_match_7EalRVaDJXlXYHkYxZWKvX: {
    youtubeUrl: "https://www.youtube.com/watch?v=PASTE_ID",
    youtubeTitle: "PASTE_YOUTUBE_TITLE",
    score: 0.9
  }
});
```

The next Spotify Markdown export will include a `🔗 Cross-platform match` section automatically.

---

## Fix notes (what was wrong with the previous version of this file)

1. **Duplicated snapshots** — the file contained two `AI SNAPSHOT CONTEXT` blocks for the same URL/timestamp (16:28 and 16:30), doubling ~540 KB of DOM with no new information. Replaced with one structured note.
2. **Truncated lines** — each `clean_dom` was a single 2000-char-truncated line, so all selectors past the nav bar were lost. Metadata above was re-extracted from the surviving fragments (`episodeTitle`, `showTitle`, `description-panel`, `progressbar aria-valuemax="1655196"`).
3. **Transcript tab never loaded** — `transcript-tab` had `aria-selected="false"` and no `transcript-panel` existed in the dump, so no transcript text was present. The extractor now clicks the tab and scrapes `#transcript-panel` (see `spotify.js` → `ensureTranscriptTabLoaded` / `scrapeDomTranscript`).
4. **No usable metadata** — title/show/date/duration/description were buried in hashed CSS classes. Stable anchors are now `data-testid="episodeTitle"`, `data-testid="showTitle"`, `#description-panel p`, and `[data-testid="action-bar"] [role="progressbar"]` (see `spotify.js` → `extractSpotifyMetadata`).

---
_Source: Spotify • https://open.spotify.com/episode/7EalRVaDJXlXYHkYxZWKvX • cleaned 2026-09-10_
