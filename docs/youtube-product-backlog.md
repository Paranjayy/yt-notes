# YouTube Product Backlog

An intentionally separate backlog for ideas beyond capture/export. It records requests without turning every idea into an always-on page injection.

## Collector and archive

- API parity with extension exports: title, channel, description, publish time, thumbnails, duration, views, likes, comment count, transcript receipt, and optional top comments.
- Keep recommendations explicitly extension/page-context only; the official API has no equivalent personalised recommendation feed.
- Selected-only collection, thumbnail cards, filters, local persistence, Markdown/JSON/CSV/ZIP exports, and clear availability receipts.
- Add safe selection primitives inspired by Multiselect for YouTube: range select, select by channel/duration/watched state, duplicate detection, and export selected IDs. Do not copy its code or make broad page injection the default.

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
