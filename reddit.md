# r/macapps

`reddit` `subreddit`

| Field | Value |
| --- | --- |
| Subreddit | r/macapps |
| URL | https://www.reddit.com/r/macapps/ |
| Captured | 2026-09-11 |

## Posts

> Posts were not snapshotted into this note — run the Social Companion Reddit capture (🤖 widget → Capture) on the live subreddit/post page. It reads rendered `shreddit-post` cards (facts as attributes) and `shreddit-comment` threads, with auto-scroll until counts stabilize.

Sample post seen in the DOM (proves the parser anchors):

`[OS] FlowPeek: a Mermaid viewer for the diagram that is already on your screen — u/Selene_hyun (⬆️ 6 · 💬 5 · video)` → https://www.reddit.com/r/macapps/comments/1wd6uyc/os_flowpeek_a_mermaid_viewer_for_the_diagram_that/

---

## Fix notes (what was wrong with the previous version of this file)

1. **Raw 791 KB snapshot** — replaced with one structured note.
2. **Attribute-first parsing** — new Reddit renders facts as `shreddit-post` attributes (`permalink`, `post-title`, `author`, `score`, `comment-count`, `created-timestamp`, `post-type`, `domain`, `upvote-ratio`) plus flair/body slots. No hashed classes involved at all.
3. **Stable anchors** (`reddit-helpers.js`): `shreddit-post:not([slot])` top-level cards, `shreddit-comment` (`author`/`depth`/`score`/`permalink` attrs, `[slot="comment"]` body), header facts from `shreddit-subreddit-header-buttons` + sidebar `N members` / `N online` text. Verified by jsdom tests fed with the real pasted post card (`tests/unit/fixtures/reddit-post.html`).
4. **Route gate** — only `/r/<sub>` and `/r/<sub>/comments/<id>` are capture surfaces; user pages, inbox, and settings are excluded by `parseRedditRoute`. Public content only, always.

---
_Source: Reddit • https://www.reddit.com/r/macapps/ • cleaned 2026-09-11_
