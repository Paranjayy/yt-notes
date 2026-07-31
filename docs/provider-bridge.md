# Signed-in AI Provider Bridge

The extension’s AI handoff is a deliberate browser workflow for turning selected text or a compact page capture into a prompt in a provider tab you are already signed into.

## What it does

- Targets ChatGPT, Gemini, Claude, and Grok separately, so the same captured context can be compared across providers.
- Reuses the visible provider chat by default, or opens a new chat when **New chat** is checked.
- Inserts a draft or attempts to send it when **Send in my chat** is checked.
- Leaves model choice, conversation history, billing, and rate limits with the selected provider account.
- Keeps prompt recipes and a short prompt history in extension-local storage.
- Can read the newest *visible* provider response into the popup for copying or a local Markdown download.
- Adds a right-click **Ask selected text with** menu for quick one-provider handoff from any page.
- Opens an on-demand active-page mini palette with `Control + Shift + A` on macOS or `Alt + Shift + A` elsewhere. It is injected only after that shortcut, uses selection or a 12k-character readable-page excerpt, and closes with Escape or a click outside.

## What it deliberately does not do

- Read, export, or reuse cookies, OAuth/session tokens, credentials, private conversations, browser history, or provider network traffic.
- Pretend that a provider's own usage limits or subscription rules are our API capacity.
- Run as a universal, always-on in-page widget.
- Directly control a signed-in provider from the website: browser cross-origin boundaries make the extension the correct explicit surface for that capability.

## Reliable use

1. Stay signed into the provider in the same browser profile.
2. Open the extension popup on the page you want to analyze, write an instruction, choose the providers, and run it.
3. Leave **New chat** off to keep the current provider conversation, or enable it for a fresh thread.
4. Let the provider generate normally. **Live reply** reads the most recent visible reply while the popup remains open; use **Read newest reply** if you prefer a manual refresh.
5. If a provider reports that its composer is unavailable, open that provider once, complete any sign-in/consent prompt, reload the extension, and try again. Provider pages can change their DOM, so this failure is intentionally surfaced rather than hidden.

## Why this differs from HARPA-style broad automation

The useful interaction is the active-tab prompt handoff, not wide access to the browser or an account. This implementation keeps its permissions and activity scoped to an explicit popup click or right-click action, then uses the provider's normal visible interface. That makes the model selection and synced history behave as they do when the user types directly in that service, without handling account secrets ourselves.
