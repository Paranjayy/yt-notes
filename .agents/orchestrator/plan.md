# Orchestration Plan: Social Companion & YT Note-Taker

This plan outlines the steps to build and verify the browser extension features.

## Iteration Status
Current iteration: 1 / 32

## Plan Details

### Step 1: Initial Exploration
- Spawn Explorer to check node/npm availability and explore the current code files in depth.
- Establish the exact requirements for E2E testing.

### Step 2: Milestone 1 - Test Infrastructure Setup
- Spawn Worker to initialize `package.json`, install Playwright/Puppeteer and Vitest/Jest, and build basic test runners.
- Spawn Reviewer and Challenger to verify testing infrastructure works.

### Step 3: Dual-Track Execution
- **E2E Testing Track**: Build E2E tests covering Tiers 1-4 for all features. Note: Playwright E2E tests must be run with `--workers=1` to limit concurrency and avoid 8GB RAM overload.
  - YT Transcripts (with closed sidebar, new/old selectors, network interception).
  - Notes & Screenshots (inline editing, canvas screenshot downloads).
  - Playlist frontmatter.
  - X & Reddit scrapers (posts, comments, stats).
- **Implementation Track**: Implement the requested features:
  - Milestone 2: Transcript extraction enhancements.
  - Milestone 3: Advanced notes, auto-pause, screenshot download.
  - Milestone 4: Playlist frontmatter & personal notes.
  - Milestone 5: X & Reddit scraper panels & comment scraping.

### Step 4: Final Integration & Hardening
- Phase 1: Pass 100% of E2E tests (run locally with single worker/concurrency).
- Phase 2: Challenger-driven adversarial coverage hardening (Tier 5) relying mostly on unit tests and static code verification where possible.
- Phase 3: Integrity verification by Forensic Auditor.

