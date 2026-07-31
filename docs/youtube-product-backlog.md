# YouTube Product Backlog

An intentionally separate backlog for ideas beyond capture/export. It records requests without turning every idea into an always-on page injection.

## Collector and archive

- API parity with extension exports: title, channel, description, publish time, thumbnails, duration, views, likes, comment count, transcript receipt, and optional top comments.
- Keep recommendations explicitly extension/page-context only; the official API has no equivalent personalised recommendation feed.
- Selected-only collection, thumbnail cards, filters, local persistence, Markdown/JSON/CSV/ZIP exports, and clear availability receipts.
- Implemented locally in the collector: select by channel and inclusive duration range, on top of selected-only collection, filters, and card/list views. These controls never edit a YouTube playlist, queue, history, or subscriptions.
- Future safe selection primitives inspired by Multiselect for YouTube: range select, watched-state selection, duplicate detection, and export selected IDs. Do not copy its code or make broad page injection the default.

## Better YouTube workflow surfaces

- Optional sidebar: saved subscriptions/custom feeds, with user-selected channel groups and local filters.
- Notification inbox: dedupe, priority/rules, “watch later” routing, and exportable read state.
- History tools: search, duration/channel/topic filters, revisit queue, and local archive/diff reports.
- Home/feed controls: user-defined feeds and transparent sorting; never imply access to YouTube's private ranking model.
- Playlist/queue workspace: select visible items, collect a chosen subset, show progress and failure receipts. Account-only queues require the signed-in page or future OAuth; a public API key is insufficient.

## Guardrails

- Preserve the current route gate: widgets only on explicit watch, live, and Shorts video routes.
- Keep API keys ephemeral in the website and never write them into an archive.
- Prefer official API/OAuth for account-scoped data; mark unavailable/private/restricted content rather than pretending it was collected.

## Cross-platform research tracks

- Reddit posts/subreddit archives and X thread capture: first identify public/free official or documented access paths, then build a platform-specific collector with local exports and explicit rate-limit receipts.
- CRX inspection: unpack an extension only for compatibility/security research; never execute or ship third-party code without its licence and a deliberate rewrite.
- Safari conversion: assess each extension as a WebExtension first. A native Safari wrapper may need Apple tooling/signing; third-party bridge products such as Viaduct can inform the workflow but are not a replacement for review, permissions mapping, or a maintainable source build.
