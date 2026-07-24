# YT Notes Viewer

A simple, zero-dependency web viewer for YouTube video notes exported from the Social Companion browser extension.

**Live:** https://website-sage-zeta-74.vercel.app

## How to Use

1. Open the Social Companion extension on any YouTube video
2. Go to the Export tab and click **Copy Markdown**
3. Visit [website-sage-zeta-74.vercel.app](https://website-sage-zeta-74.vercel.app)
4. Paste the markdown — your notes render instantly

## Features

- **Single or multiple notes** — paste one or many, the viewer handles both
- **Dark mode** — follows your system preference
- **Collapsible sections** — transcript, comments, and recommendations
- **Zero dependencies** — pure HTML/CSS/JS, no build step needed

## Deploy to Vercel

```bash
npx vercel --prod
```

Or connect this folder to a GitHub repo and deploy via the Vercel dashboard.

## Supported Markdown Format

The viewer parses the YAML frontmatter and `#` sections from the Social Companion export:

```yaml
---
Title: Video Title
Channel: Channel Name
Subscribers: 100k subscribers
Views: 1,234,567 views
Likes: 5,678
Comments: 123 Comments
URL: https://www.youtube.com/watch?v=...
Thumbnail: https://img.youtube.com/vi/.../maxresdefault.jpg
Tags: tag1, tag2

Description:
Full video description here...
---

# Personal Notes & Markers
- [1:23] Some personal note

# Transcript
[0:00] First line of transcript...

# Comments
1. **@user** (👍 5): Great video!

# Recommendations
1. **Related Video** [10:00] — Channel Name (views)
   https://youtube.com/watch?v=...
```
