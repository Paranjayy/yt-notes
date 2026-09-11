# DESIGN.md — capture UX design

## Widget pattern (YouTube established, Spotify follows)

- One embedded widget per capture surface, dark glass, three concerns:
  **Transcript** (sync / search / copy / download), **Details** (metadata
  table + description), **Related** (visible sibling content).
- Popup (`popup.html`) stays platform-agnostic: it only speaks the shared
  message contract and maps `videoId` to whatever the platform's id is
  (YouTube videoId, Spotify episodeId).

## Transcript status states (shared vocabulary)

| state | meaning |
| --- | --- |
| `idle` | route detected, nothing attempted yet |
| `waiting` | checking / user must press Sync |
| `ready` | non-empty segments bound to current id ("verified") |
| `mismatch` | data belonged to a different video — discarded, never shown |
| `unavailable` | platform exposes no transcript (or login required) |
| `error` | fetch/parse failed, retryable |

Badge copy mirrors these exactly; export frontmatter receipts the same
status plus source and check timestamp.

## Spotify specifics

- Capture is **automatic, like YouTube**: on episode route the Transcript
  tab is auto-clicked, its scroll container is step-scrolled once so lazy
  rows render, and a `MutationObserver` captures rows the instant they
  appear. Manual Sync re-runs the same pipeline on demand.
- The widget is a **floating panel** (fixed, draggable by header,
  collapsible, hideable, geometry persisted) — it never obstructs page
  content, mirroring the X/Reddit companion pattern.
- The transcript/token API is **best-effort**: a 403/blocked token
  endpoint sets a per-episode `skip-api` flag and falls through to the
  page tab with the source labeled accordingly — never a dead error.
  Exports say which path produced them.

- Web transcript panels are **untimed and speaker-grouped** with an
  auto-generated disclaimer row. Timed cues come only from the
  `transcript-read-along` API. Exports render whichever shape was
  captured and label the source (`Spotify transcript API (timed)` vs
  `page transcript tab (untimed, speaker-grouped)`).
- Text selection is unlocked inside transcript/description/episode-list
  containers only — never on player controls. A widget "Select text"
  button selects the whole panel for partial manual copy.
- Cross-platform matching (split Spotify-exclusive / YouTube re-uploads)
  is a stored hint (`sc_spotify_match_<episodeId>`), rendered as a
  `🔗 Cross-platform match` section with a verify-duration-and-date
  warning — never asserted as fact.

## Roadmap etiquette

- One platform at a time, robust over broad: Spotify is the reference
  second surface. Twitter/Instagram/Reddit come after, each with its own
  helpers + parser tests + status states before any widget chrome.
- X is now the third surface (post + profile routes only — no home,
  explore, search, DMs, or settings capture, ever).
- Reddit is the fourth surface (subreddit feed + comment thread only —
  no user pages, inbox, or settings, ever). Its shreddit-* components
  expose facts as attributes, so parsing is attribute-first.

## DOM Lab (future — do not build yet)

- The Low/High snapshot modes are the seed: Low = faithful, High =
  parser-anchored density (measured 70%+ byte reduction on X by dropping
  hashed classes/generated ids).
- Later GUI: any-website snapshot panel with mode toggle, before/after
  byte receipts, and versioned DOM history (hash + timestamp per
  snapshot, diff view) for extension-building iteration.
