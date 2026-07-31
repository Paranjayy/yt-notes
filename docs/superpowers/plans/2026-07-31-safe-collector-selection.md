# Safe Collector Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fast, local selection primitives to the website collector without changing YouTube pages or mutating playlists.

**Architecture:** `website/index.html` already owns collector state in `selectedVideoIds`. Add a selection anchor for range selection and a small selection-tools row that derives choices from the in-memory items. Keep selection effects local and persist only the existing archive data.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Vercel static deployment.

---

### Task 1: Add local selection helpers

**Files:**
- Modify: `website/index.html`

- [ ] Range selection remains future work; it needs a deliberate interaction design rather than a fragile checkbox override.
- [x] Add functions to select by channel and an inclusive duration range using `collectedPlaylist.items`.
- [x] Preserve unavailable videos as unselected.

### Task 2: Add collector controls

**Files:**
- Modify: `website/index.html`

- [x] Add a compact selection-tools row with channel and duration choices.
- [ ] Shift-click range selection remains in the documented follow-up scope.
- [x] Retain existing List/Cards, filtering, exports, and transcript collection.

### Task 3: Document boundaries

**Files:**
- Modify: `docs/youtube-product-backlog.md`

- [x] Record that the implemented selection features are local-only and do not edit a YouTube playlist, queue, history, or subscriptions.
- [x] Retain Reddit/X extractors, CRX inspection, and Safari conversion as research tracks requiring per-platform review.

### Task 4: Verify and publish

**Files:**
- Modify: `website/index.html`

- [x] Run `git diff --check` and deploy the website with `npx vercel --yes --prod --scope paranjay245s-projects`.
- [x] Do not perform a live YouTube/API test because the user asked not to test on their machine.
- [x] Commit only task files and push `codex/youtube-resilience`.
