# Capture, Archive, and Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably activate the YouTube companion, preserve captures locally and as downloads, and make website video/playlist modes distinct.

**Architecture:** Normalize video IDs at the content-script boundary and trigger widget work from SPA events plus bounded DOM readiness retries. Use the background worker as the command router for popup/context actions. Keep all archive data in extension local storage and browser downloads; the static website remains import-only.

**Tech Stack:** Manifest V3, vanilla JavaScript/HTML/CSS, `chrome.storage.local`, `chrome.contextMenus`, static Vercel site.

---

### Task 1: Harden YouTube activation

**Files:**
- Modify: `content.js`
- Modify: `manifest.json`

- [ ] Normalize `watch?v=/live/<id>` and `watch?v=/shorts/<id>` into their 11-character video IDs before normal URL handling.
- [ ] Subscribe to `yt-navigate-finish`, `yt-page-data-updated`, `popstate`, and a bounded mutation/readiness retry so late SPA sidebar mounts render without a manual refresh.
- [ ] Preserve the existing browse-page guard: no video widget on channel or playlist pages without an active player layout.
- [ ] Raise manifest version for the extension update.

### Task 2: Add explicit local capture commands

**Files:**
- Modify: `background.js`
- Modify: `content.js`
- Modify: `manifest.json`
- Create: `popup.html`
- Create: `popup.js`

- [ ] Register YouTube context-menu actions after install: “Save current capture as Markdown” and “Open capture archive”.
- [ ] Add a content-script message that generates and downloads the active video Markdown or returns a factual error when no video capture is available.
- [ ] Make the browser action open a small popup showing active-page status, “Save Markdown”, “Download transcript”, and “Open archive”.
- [ ] Use toasts for save/download outcomes and preserve the dashboard fallback when a page is not reachable.

### Task 3: Make the archive export transcript-first

**Files:**
- Modify: `dashboard.js`
- Modify: `dashboard.html`

- [ ] Add a plain-text transcript generator with video title, canonical URL, capture timestamp and timestamped segments.
- [ ] Add per-video “Download transcript” controls to cards/modals, disabled with a truthful toast if transcript data is absent.
- [ ] Make dashboard copy errors visible rather than silently falling back.

### Task 4: Separate the hosted reader and playlist archive workspaces

**Files:**
- Modify: `website/index.html`

- [ ] Give the landing screen two clearly labelled entry actions: paste video Markdown and import playlist archive.
- [ ] Keep the existing strict JSON/CSV validation; surface success and error toasts for both entry routes and re-exports.
- [ ] Add playlist filters and a transcript-status summary after import, then retain JSON/CSV/Markdown re-download controls in the playlist workspace.
- [ ] Explicitly state that bulk playlist transcript collection happens in the extension, using either its keyless in-page route or the user’s optional API key; the website has no fake “fetch” button.

### Task 5: Package and publish

**Files:**
- Modify: `docs/platform-capture-and-download-ideas.md` only if implementation changes the documented boundary.

- [ ] Inspect diffs to ensure unrelated user files remain untouched.
- [ ] Run the production build only; do not run automated tests because the user explicitly requested no tests.
- [ ] Commit extension and site work in focused commits, push branch, and deploy the static website.
