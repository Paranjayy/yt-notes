# AGENTS.md — Social Companion & YT Notes contributor rules

## Version numbering (strict)

- `manifest.json` `"version"` is the single source of truth. `package.json`
  `"version"` must match it on every release commit.
- SemVer: **patch** = bug fixes only, **minor** = new capture surface /
  feature (e.g. a new platform), **major** = breaking archive-format change.
- Every release commit message ends with the version suffix: `(v1.15.0)`.

## Commit etiquette

- Format: `feat|fix|docs|test|refactor(scope): short imperative summary (vX.Y.Z)`
  - scope is the platform/area: `core`, `youtube`, `spotify`, `twitter`,
    `popup`, `dashboard`, `docs`.
  - One logical change per commit. Never mix a new platform with fixes to
    another. Never commit secrets, tokens, cookies, or user captures.
- Before committing: `git status`, `git diff`, stage only intended files,
  run `npx vitest run` (unit). E2E (`npx playwright test`) for widget/DOM
  changes when a browser is available.
- Push to the current feature branch after each release commit; `main`
  stays green (unit suite passes, modulo known pre-existing failures which
  must be named in the commit message if touched).

## Store readiness (Chrome Web Store skill)

- `CHROMEWEBSTORE.md` is the submission tracker: single purpose,
  per-permission justifications, privacy notes, pre-submit checklist.
- Whenever `manifest.json` permissions/hosts change, update the
  justification table in the same commit. Keep the manifest description's
  surface list current.

## Capture correctness (non-negotiable)

- **Receipts, not claims.** A transcript badge may say "verified" only when
  segments are non-empty AND bound to the current page id
  (`transcriptState.videoId === currentVideoId`, storage keys per id).
  Exports must derive their `Transcript Status` line from the captions
  actually embedded in that export — and self-heal the badge on mismatch.
- **No stale copies.** Any pre-cached markdown served on a user gesture must
  carry its source id + transcript count; regenerate when either differs.
- **No cross-video attribution.** Async fetches capture `expectedVideoId`
  at entry and drop results after navigation. Caption timing is sanity
  checked against media duration where available.
- **Privacy.** Never read/export cookies, OAuth/session tokens, private
  chats, or account data. Page-session tokens (e.g. Spotify web-player
  token) are fetched same-origin and used only for that page's own
  transcript endpoint — never persisted into captures.

## Platform parser rules

- Select on **stable attributes** (`data-testid`, `id`, `role`,
  `span[dir="auto"]`), never hashed CSS classes. Parsers must have a
  jsdom unit test fed with real pasted panel HTML.
- Pure logic lives in `*-helpers.js` (Node/vitest-safe, no DOM/chrome);
  content scripts are thin DOM/chrome shells over them.
- New platform content scripts reuse the YouTube message contract
  (`sc_get_capture_status`, `sc_get_current_markdown`,
  `sc_download_current_markdown`, `sc_download_current_transcript`) so
  popup/background keep working unchanged.
