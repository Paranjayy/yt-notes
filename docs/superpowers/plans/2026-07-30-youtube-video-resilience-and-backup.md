# YouTube Video Resilience and Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every practical YouTube video URL, add low-friction copying, and build a keyless playlist backup foundation.

**Architecture:** `content.js` owns URL resolution, capture actions, and playlist-page collection. The manifest grants the content script access to short URLs. The static website parses exported backup files locally. Canonical watch URLs are the storage/export contract.

**Tech Stack:** Manifest V3, vanilla JavaScript, Chrome storage, static HTML/CSS/JS.

---

### Task 1: Video identity and canonical links

**Files:**
- Modify: `manifest.json`
- Modify: `content.js`
- Modify: `tests/e2e/helpers/mock-pages.js`
- Modify: `tests/e2e/youtube.spec.js`

- [ ] Add `https://youtu.be/*` to both manifest host permissions and content-script matches.
- [ ] Replace query-only detection with a resolver that accepts `watch?v=`, `/live/`, `/shorts/`, `/embed/`, `/v/`, and `youtu.be`; fall back to `ytInitialPlayerResponse.videoDetails.videoId`, player response data, and the canonical `<link>` URL.
- [ ] Add one `canonicalYouTubeUrl(videoId, timestamp)` helper and use it for metadata, screenshots, note timestamps, and Markdown exports.
- [ ] Add browser coverage for `/live/<id>`, `/shorts/<id>`, and `youtu.be/<id>`.

### Task 2: One-tap capture and visual cleanup

**Files:**
- Modify: `content.js`

- [ ] Add a default Notes-tab quick-copy row for notes, transcript, description, and metadata/stats.
- [ ] Preserve every current tab and export control.
- [ ] Replace the embedded widget's multi-colour gradients with neutral surfaces and a single violet accent.

### Task 3: Keyless playlist backup

**Files:**
- Modify: `content.js`
- Modify: `dashboard.html`
- Modify: `dashboard.js`

- [ ] Detect playlist pages and collect visible playlist item rows into stable records containing position, video ID, title, channel, duration, URL, thumbnail, and unavailable state.
- [ ] Provide an assisted load-all loop that scrolls until no new rows arrive, with a user-visible stop state.
- [ ] Export records as CSV, JSON, and Markdown through dashboard actions; preserve unavailable entries.

### Task 4: Static backup import

**Files:**
- Modify: `website/index.html`
- Modify: `website/README.md`

- [ ] Add local file import for Social Companion playlist JSON and CSV backups alongside Markdown paste.
- [ ] Render imported playlist records with search, availability state, and download actions; do not use an API or backend.
- [ ] Document the keyless workflow and the optional future user-supplied API key design.

### Task 5: Delivery

**Files:**
- Modify: `manifest.json`, `content.js`, `dashboard.html`, `dashboard.js`, `website/index.html`, `website/README.md`, and associated tests/docs.

- [ ] Build the extension package.
- [ ] Commit each coherent feature checkpoint and push the branch.
- [ ] Do not run automated tests: the user explicitly requested manual testing later.
