# Podcast Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Spotify episode metadata finder with official embed and YouTube transcript-routing handoff.

**Architecture:** A small Vercel endpoint validates a Spotify episode URL and reduces Spotify oEmbed data to a safe metadata receipt. The existing static page adds a standalone Podcast Finder workspace that invokes this endpoint at low concurrency and renders constructed official embeds instead of accepting provider HTML.

**Tech Stack:** Static HTML/CSS/JavaScript, Vercel serverless function, Spotify oEmbed API.

---

## File structure

- Create: `website/api/spotify.js` — URL validation and reduced Spotify oEmbed response.
- Modify: `website/index.html: workspace CSS, markup, and inline controller` — Podcast Finder UI and route.
- Modify: `website/README.md` — documented limits and workflow.

### Task 1: Add the narrow Spotify metadata endpoint

**Files:**
- Create: `website/api/spotify.js`

- [ ] **Step 1: Validate only an exact Spotify episode URL**

```js
function episodeUrl(raw) {
  const url = new URL(String(raw || '').trim());
  if (url.hostname !== 'open.spotify.com') return null;
  const id = url.pathname.match(/^\/episode\/([A-Za-z0-9]{22})$/)?.[1];
  return id ? `https://open.spotify.com/episode/${id}` : null;
}
```

- [ ] **Step 2: Fetch oEmbed and return only title, image, canonical URL, and ID**

```js
const upstream = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
const payload = await upstream.json();
response.status(200).json({ id, url, title: payload.title || 'Spotify episode', thumbnail: payload.thumbnail_url || '' });
```

- [ ] **Step 3: Use clear 400/404/502 receipts**

```js
if (!canonical) return error(response, 400, 'Paste an open.spotify.com/episode/... URL.');
if (upstream.status === 404) return error(response, 404, 'Spotify could not find that public episode.');
if (!upstream.ok) return error(response, 502, 'Spotify metadata is temporarily unavailable.');
```

- [ ] **Step 4: Commit the endpoint**

```bash
git add website/api/spotify.js
git commit -m "feat: add Spotify episode metadata endpoint"
```

### Task 2: Build the standalone Podcast Finder workspace

**Files:**
- Modify: `website/index.html`

- [ ] **Step 1: Add `Podcast Finder` navigation and hide/show route CSS**

```html
<button type="button" data-workspace="podcasts">Podcast Finder</button>
```

- [ ] **Step 2: Add a URL-list input and empty result container**

```html
<section class="podcast-workspace">
  <textarea id="podcastUrls" placeholder="https://open.spotify.com/episode/…"></textarea>
  <button id="findPodcastsBtn" class="btn" type="button">Find episodes</button>
  <div id="podcastResults" hidden></div>
</section>
```

- [ ] **Step 3: Parse unique Spotify URLs and call the endpoint two at a time**

```js
async function findPodcasts() {
  const urls = spotifyEpisodeUrls(document.getElementById('podcastUrls').value);
  if (!urls.length) return showToast('Paste one or more Spotify episode links.', 'error');
  const results = await Promise.all(urls.map(url => fetch('/api/spotify?url=' + encodeURIComponent(url)).then(readJson)));
  renderPodcastResults(results);
}
```

- [ ] **Step 4: Render a constructed official embed and explicit handoffs**

```js
var embed = 'https://open.spotify.com/embed/episode/' + encodeURIComponent(item.id);
var youtube = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(item.title + ' podcast');
```

- [ ] **Step 5: Extend workspace routing**

```js
var workspace=['collector','library','tools','crx','podcasts'].includes(name)?name:'collector';
```

- [ ] **Step 6: Commit the workspace**

```bash
git add website/index.html
git commit -m "feat: add podcast finder workspace"
```

### Task 3: Document boundaries

**Files:**
- Modify: `website/README.md`

- [ ] **Step 1: Add the source-boundary statement**

```markdown
Podcast Finder reads public Spotify oEmbed metadata and opens official discovery links. It does not download Spotify audio or listener transcripts. Creator-provided VTT/SRT/RSS transcripts and matched YouTube videos can be brought into the local archive separately.
```

- [ ] **Step 2: Run static syntax checks only**

Run: `node --check website/api/spotify.js` and parse the inline script with `new Function`.

Expected: both complete without a syntax error. Do not run a browser, Spotify API, or live deployment test because the user explicitly excluded that environment.

- [ ] **Step 3: Commit docs**

```bash
git add website/README.md
git commit -m "docs: define podcast finder boundaries"
```

## Self-review

- The plan covers public metadata, explicit source routing, no-audio/no-listener-transcript boundary, failure receipts, and static-only validation.
- It intentionally omits Spotify Web API credentials and full metadata because OAuth/client-secret handling would be a separate product decision.
