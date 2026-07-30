# YT Notes Viewer

A simple, zero-dependency web viewer for YouTube notes and playlist backups exported from the Social Companion browser extension.

**Live:** https://website-sage-zeta-74.vercel.app

## How to Use

1. Open the Social Companion extension on any YouTube video
2. Go to the Export tab and click **Copy Markdown**
3. Visit [website-sage-zeta-74.vercel.app](https://website-sage-zeta-74.vercel.app)
4. Paste the markdown — your notes render instantly

### Playlist backup

1. Open a YouTube playlist in the extension.
2. Use **Playlist Backup** and, if needed, **Load all videos**.
3. Download a JSON or CSV backup.
4. Choose **Import playlist backup** on the viewer and select that file.
5. Use **Download JSON**, **Download CSV**, or **Download Markdown** in the viewer to make a new local copy or switch formats.

The backup uses the playlist page you can already access. It does not require an API key, account, server, or paid service.

For complete public or unlisted playlist metadata, the extension also offers **Fetch with API**. Create and supply your own YouTube Data API key; it stays in browser storage and is never bundled or sent to this project. The API route is optional. YouTube documents `playlistItems.list` and `videos.list` as one quota unit per request, and projects have a default 10,000-unit daily allocation, subject to Google's current policy. See the [quota overview](https://developers.google.com/youtube/v3/getting-started) and [playlist endpoint](https://developers.google.com/youtube/v3/docs/playlistItems/list).

## Features

- **Single or multiple notes** — paste one or many, the viewer handles both
- **Dark mode** — follows your system preference
- **Collapsible sections** — transcript, comments, and recommendations
- **Zero dependencies** — pure HTML/CSS/JS, no build step needed
- **Local playlist imports** — view Social Companion JSON/CSV playlist backups, including unavailable/private entries
- **Playlist re-exports** — download an imported playlist as JSON, CSV, or Markdown directly from the viewer

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
