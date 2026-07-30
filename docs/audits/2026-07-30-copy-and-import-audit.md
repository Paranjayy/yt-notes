# Copy and Import Flow Audit

## Anti-patterns verdict

Mixed. The embedded extension remains visually dense and uses legacy glassmorphism/gradient conventions, while the website is calmer and editorial. Both interfaces expose important states through small controls or silent fallbacks, which makes them feel less deliberate than the data features themselves.

## Executive summary

Eight actionable issues: one critical content-safety problem, three high-impact feedback/reliability problems, and four medium usability/accessibility problems. The first pass should make operation outcomes truthful and visible before adding bulk collection.

## Critical

### Website comment rendering permits unescaped HTML

- **Location:** `website/index.html`, `renderNote()` comments section.
- **Category:** Content safety.
- **Impact:** Imported Markdown comment content is injected after only a bold-markdown replacement, so crafted HTML can run in the viewer.
- **Recommendation:** Escape the full comment first, then transform only the escaped `**…**` markers, or render comments with DOM text nodes.

## High

### Copy feedback is optimistic even when the clipboard write fails

- **Location:** `content.js`, `scCopyText()` and quick-copy actions.
- **Category:** Reliability and accessibility.
- **Impact:** A Clipboard API rejection falls back asynchronously, but the caller immediately shows “copied”. A failed fallback is not surfaced at all.
- **Recommendation:** Make copy operations return a success/failure promise; show a positive toast only after successful clipboard or fallback copy, and an actionable failure toast otherwise.

### Empty or mismatched transcripts are reported as successful copies

- **Location:** `content.js`, `copyTranscript()`.
- **Category:** Data integrity.
- **Impact:** “Transcript not loaded yet” is copied and then labelled as a successful transcript copy. The user cannot distinguish absent captions, a stale transcript, or an unavailable transcript.
- **Recommendation:** Track transcript state (`ready`, `empty`, `unavailable`, `mismatched`, `loading`), surface it in the active Transcript tab, and prevent a success toast for non-content.

### Website import errors are blocking, vague alerts

- **Location:** `website/index.html`, `importBackup()`.
- **Category:** UX and accessibility.
- **Impact:** The user loses context and does not learn whether the format, fields, or file contents caused the failure.
- **Recommendation:** Add a persistent status region/toast with an error code, affected filename, and recovery action. Validate schema and show import counts/warnings.

## Medium

### No import integrity report

- **Location:** `website/index.html` backup parser.
- **Category:** Data integrity.
- **Impact:** Invalid rows, missing IDs, duplicate records, and unavailable videos are silently mixed into the result.
- **Recommendation:** Display a concise import receipt: loaded, unavailable, duplicate-skipped, malformed, and transcript-present counts.

### Controls are under-sized for touch and have no visible focus treatment

- **Location:** `content.js` quick actions and `website/index.html` buttons.
- **Category:** Accessibility and responsive design.
- **Impact:** Several 11–13px buttons are below a 44px touch target and keyboard users have limited focus feedback.
- **Recommendation:** Set a 36–44px minimum interactive height where space allows, and define `:focus-visible` outlines using the accent token.

### Playlist loading does not expose partial/failure state distinctly

- **Location:** `content.js`, keyless/API playlist functions.
- **Category:** Reliability.
- **Impact:** A completed scroll collection can still be incomplete due to virtualized rows; API errors are shown only in a small status string.
- **Recommendation:** Add a status model with item counts, source, warnings, retry, and an explicit “partial backup” label.

### Styling system is fragmented

- **Location:** `content.js`, `dashboard.html`, `website/index.html`.
- **Category:** Theming.
- **Impact:** Three interfaces use different palettes, type systems, and feedback patterns; copying logic and toasts are inconsistent.
- **Recommendation:** Introduce a small shared semantic vocabulary (success, warning, error, info, focus) and use it consistently without forcing identical layouts.

## Positive findings

- Markdown parsing and playlist backup storage are local-first.
- The API key is optional and scoped to browser storage.
- Canonical video links reduce future YouTube URL churn.

## Priority

1. Escape imported comments and make clipboard status truthful.
2. Add transcript/import state receipts and recovery actions.
3. Build a bulk workflow around extension-collected transcripts, because the public YouTube Data API does not offer unauthenticated arbitrary-video caption downloads.
