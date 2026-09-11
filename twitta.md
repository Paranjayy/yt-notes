# Theo - t3.gg (@theo)

`x` `twitter` `profile`

| Field | Value |
| --- | --- |
| Handle | @theo |
| Name | Theo - t3.gg |
| Bio | Full time CEO @t3dotcodes & @t3dotchat. Part time YouTuber, investor, and developer |
| Location | San Francisco, CA |
| URL | t3.gg |
| Joined | October 2016 |
| Following | 4,230 |
| Followers | 387.8K |
| Posts | 66.6K |
| URL | https://x.com/theo |
| Captured | 2026-09-11 |

## Posts

> Posts were not snapshotted into this note — run the Social Companion X capture (𝕏 widget → Capture posts) on the live post/profile page. It reads visible `article[data-testid="tweet"]` nodes with per-post attribution and metrics.

Sample post seen in the DOM (proves the parser anchors):

`Theo - t3.gg (@theo) · Sep 10 — "We need to talk about Jacob's resignation." · 💬 79 · 🔁 47 · ❤️ 897 · 👁️ 146469` → https://x.com/theo/status/2097778026113318960

## 🔗 Cross-platform note

X posts are the discovery layer for the same catalog scattered across Spotify/YouTube (episode announcements, clips). A status URL + `normalizeEpisodeTitle` match against episode/track titles is the intended bridge — stored as capture hints, never asserted.

---

## Fix notes (what was wrong with the previous version of this file)

1. **Raw 912 KB snapshot** — replaced with one structured note. Measured: **70% of the raw bytes were `class` attributes** (X's `r-xxx` tokens), 7% inline SVG — which is exactly what the new High-Density cleaner mode strips.
2. **Metrics live in labels, not text** — counts render in `div[role="group"][aria-label="79 replies, 47 reposts, 897 likes, … 146469 views"]` and per-button `aria-label="79 Replies. Reply"`, not in button text. The parser reads labels first (`twitter-helpers.js` → `metricText` / `groupMetrics`).
3. **Stable anchors** (never hashed classes): `article[data-testid="tweet"]`, `[data-testid="tweetText"]`, `[data-testid="User-Name"]`, `a[href*="/status/"]` + inner `time`, `[data-testid="reply|retweet|like"]`, `[data-testid="tweetPhoto"]`, `[data-testid="videoPlayer"]`, profile `[data-testid="UserName|UserDescription|UserLocation|UserUrl|UserJoinDate"]`, `a[href$="/following"]`, `a[href*="followers"]`. Verified by jsdom tests fed with real pasted article/profile HTML (`tests/unit/fixtures/x-article.html`).
4. **Route gate** — only `/:handle` and `/:handle/status/:id` are capture surfaces; home/explore/search/messages/settings are excluded by `parseXRoute`.

---
_Source: X • https://x.com/theo • cleaned 2026-09-11_
