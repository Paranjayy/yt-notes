# Rosint full and quick capture implementation plan

**Goal:** Let Rosint downloads collect complete posts and comments with separate Full and Quick choices.

**Architecture:** Keep parsing helpers in `rosint-helpers.js`. The widget in `rosint.js` owns capture mode, tab traversal, pagination waits, and export reuse.

**Tech stack:** MV3 content script, DOM APIs, Vitest, jsdom.

## Tasks

- [x] Add failing tests for labelled body toggles and page progression.
- [x] Add failing widget tests for independent Full/Quick modes and Download output.
- [x] Implement labelled expansion, page waits, mode selectors, and capture reuse.
- [x] Run Rosint tests and the full unit suite. Browser preview automation was unavailable; two unrelated dictionary parser tests still fail.
- [x] Bump the minor version and commit the focused change.
