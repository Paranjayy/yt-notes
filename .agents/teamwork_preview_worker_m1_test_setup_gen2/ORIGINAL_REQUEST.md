## 2026-06-12T01:07:22Z
Implement the resolved test infrastructure remediation fixes (Milestone 1, gen2) based on the Explorer proposals:

1. Create a new file `inject.js` at the root directory to intercept /api/timedtext (transcripts) and playerResponse updates in the page's MAIN world (refer to `.agents/teamwork_preview_explorer_m1_test_setup_3_gen2/proposed_inject.js`).
2. Update `manifest.json` to load `inject.js` as a MAIN-world content script on youtube.com, and add the "downloads" and "activeTab" permissions (refer to `.agents/teamwork_preview_explorer_m1_test_setup_3_gen2/proposed_manifest.json`).
3. Update `background.js` to support CAPTURE_TAB, DOWNLOAD_FILE, and YT_TIMEDTEXT_URL messaging (refer to `.agents/teamwork_preview_explorer_m1_test_setup_3_gen2/proposed_background.js`).
4. Update `helpers.js` to fix the floating-point centiseconds precision calculation in formatTime (refer to `.agents/teamwork_preview_explorer_m1_test_setup_3_gen2/proposed_helpers.js`).
5. Update `tests/unit/helpers.test.js` to assert the corrected time formatting '2:02:02.90' (refer to `.agents/teamwork_preview_explorer_m1_test_setup_3_gen2/proposed_helpers.test.js`).
6. Update `content.js` to:
   - Provide Promise support in the storage wrapper if callback is omitted.
   - Use `await storage.get(...)` instead of direct storage access in `generateMarkdown`.
   - Setup a postMessage listener to handle events (YT_TIMEDTEXT_URL, YT_PLAYER_RESPONSE_DATA) from `inject.js` and dynamically fetch transcripts.
   - Handle screenshots CORS-safely by catching canvas draw errors and falling back to calling `CAPTURE_TAB` message on the background script, then cropping the video viewport on canvas.
   - Implement CSP-safe downloads by sending data to background downloads via DOWNLOAD_FILE message.
7. Run the unit and E2E tests:
   - npm run test:unit
   - npx playwright test --workers=1 (strictly limit concurrency to 1 worker due to 8GB RAM).

Verify that all 5 unit tests and E2E tests compile and pass. Include command output in your handoff report.
