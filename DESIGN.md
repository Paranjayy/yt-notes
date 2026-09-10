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
