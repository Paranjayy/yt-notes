# Verification Plan for Milestone 1 Test Setup

This plan details the steps taken to empirically verify the correctness and reliability of the Milestone 1 test setup.

## Steps

1. **Initial Repository Scan**
   - Check the file layout and confirm configuration files exist (`package.json`, `vitest.config.js`, `playwright.config.js`).
   - Confirm test files are present in `tests/unit/` and `tests/e2e/`.

2. **Baseline Unit Testing**
   - Run `npm run test:unit` to ensure unit tests pass initially.
   - Command: `npm run test:unit`

3. **Baseline Integration Testing**
   - Run Playwright E2E tests to ensure they pass initially.
   - Command: `npx playwright test --workers=1`

4. **Mutation Testing (helpers.js)**
   - Mutate `formatTime` in `helpers.js` (e.g. modify the hour calculation math).
   - Run unit tests to confirm they catch the failure.
   - Revert change and re-verify.

5. **Mutation Testing (content.js - Reddit Scraper)**
   - Mutate `scrapeRedditPost` in `content.js` to return incorrect metadata.
   - Run Playwright Reddit E2E test to confirm it catches the failure.
   - Revert change and re-verify.

6. **Mutation Testing (content.js - YouTube Scraper)**
   - Mutate `generateMarkdown` in `content.js` to output incorrect title.
   - Run Playwright YouTube E2E test to confirm it catches the failure.
   - Revert change and re-verify.

7. **Documentation**
   - Record all test commands, output logs, and observed behavior in BRIEFING.md, progress.md, and handoff.md.
