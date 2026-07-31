# CRX Pattern Audit: ChatGPT and HARPA AI

Inspection was performed on temporary, unpacked CRX copies only. No third-party code is imported into this repository.

## ChatGPT for Chrome

- Chrome Web Store ID: `hehggadaopoacecdllhhajmbjkdcmajg`.
- Uses a native `sidePanel`, a keyboard command, a service worker, and a narrow content script for `chatgpt.com`.
- Its capability set includes active tabs, tab groups, history, bookmarks, downloads, notifications, native messaging, and browser debugging.
- Pattern worth adopting: an explicitly opened workspace that acts on deliberately selected context; no always-visible in-page assistant.
- Pattern not adopting: blanket browser-control permissions or debugger/native messaging without a concrete, reviewable use case.

## HARPA AI

- Chrome Web Store ID: `eanggfilgoajaocelnaflolkadkeghjp`.
- Uses document-start scripts and host access on every URL, plus an automation/recipe system, side panel, offscreen work, cookies, browsing-data, notifications, and declarative network request permissions.
- Pattern worth adopting: saved command recipes with clear input/output and local execution state.
- Pattern not adopting: universal page injection, page automation, or a broad data/permission surface as a default.

## Social Companion direction

1. Keep capture widgets route-gated and opt-in.
2. Add a future command palette/side panel only around explicit user-selected captures: copy context, open a chosen AI destination, save an archive, and run local filters.
3. Do not claim an embedded AI model without a user-supplied provider or a documented paid backend.
4. Treat browser history, open tabs, local files, and account actions as separate opt-in permissions—not default access.

## Implemented: active-tab handoff

- The toolbar popup can copy a user’s current selection, or a short readable page context, only after an explicit click.
- It can then open `chatgpt.com` in the user's normal browser session. It does not inspect, copy, or use ChatGPT cookies, OAuth tokens, session data, or private endpoints.
- This keeps the useful cross-browser popup pattern without depending on a Chrome-only side panel or broad site-wide injection.

## Implemented: explicit provider bridge

- The popup can target ChatGPT, Gemini, Claude, or Grok, and write a prompt into the selected provider's visible signed-in composer. The user can choose to insert a draft or send it after pressing the extension action.
- The provider owns the resulting conversation and account history. The bridge does not read or export cookies, OAuth credentials, account metadata, prior chats, or network traffic.
- Provider DOMs are inherently changeable, so a failed composer lookup is surfaced as a receipt rather than being silently treated as a sent prompt.
