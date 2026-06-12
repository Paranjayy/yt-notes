# Project: Social Companion & YT Note-Taker Extension

## Architecture
- **Content Script (`content.js`)**: Runs in the context of YouTube, X (Twitter), and Reddit pages. Handles DOM scraping, UI injection, event handling, screenshot capture, and storage synchronization.
- **Background Script (`background.js`)**: Service worker for background messaging and extension lifecycle.
- **Manifest (`manifest.json`)**: Configures permissions, service workers, content scripts, and host matches.
- **Test Infrastructure (`tests/`)**: Node.js/npm based test runner using Playwright/Puppeteer for E2E browser automation testing and Vitest/Jest for unit testing.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| 1 | Test Infrastructure Setup | Initialize package.json, install Playwright and Vitest, design testing framework. | None | PLANNED |
| 2 | YouTube Transcript Extraction | Implement InitialPlayerResponse parsing, dynamic DOM scraping (old/new selectors), auto-click Show Transcript, and network interception. | M1 | PLANNED |
| 3 | Advanced Note-Taking & Screenshots | Support empty notes, inline editing, toggleable auto-pause/resume, canvas-based screenshot download. | M1 | PLANNED |
| 4 | YouTube Playlist & Queue Metadata | Detect playlist params/title, construct YAML frontmatter, prepend personal notes to exported markdown. | M1 | PLANNED |
| 5 | X & Reddit Scrapers | Scrape posts, stats, and comments; display floating panels with copy/download options. | M1 | PLANNED |
| 6 | E2E Testing & Hardening | Pass 100% of E2E tests, run adversarial testing, perform forensic audit checks. | M2, M3, M4, M5 | PLANNED |

## Interface Contracts
### Page Context ↔ Content Script (Network Interception)
- Intercepted network requests to `youtube.com/api/timedtext` are sent from the page context to the content script using window postMessage.
- Format: `window.postMessage({ type: 'YT_TIMEDTEXT_URL', url: string })`

### Content Script ↔ Storage
- Notes are stored in `chrome.storage.local` with key `sc_notes_<videoId>`.
- Format: Array of `{ id: string, time: number, text: string }`
