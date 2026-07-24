# Social Companion — Roadmap & Future Ideas

## Architecture (next refactor)
> Right now everything is one big `content.js` IIFE. As features grow, split into decoupled modules:

```
content.js          ← thin entry point, bootstraps + routes
modules/
  notes.js          ← note CRUD, search, timeline markers
  transcript.js     ← fetch, scrape, filter, render
  screenshots.js    ← capture, save, render
  export.js         ← generateMarkdown, copy, download
  metadata.js       ← extractYouTubeMetadata, persistence
  ui.js             ← widget HTML template, tabs, toast
  storage.js        ← storage abstraction (already mostly isolated)
dashboard/
  dashboard.html
  dashboard.js
```
Benefits: each file is small → less context needed per edit, easier to test, faster to find bugs.

---

## Nifty near-term ideas

### Docs / Help page
- Add a `?` button in the widget header → opens a `help.html` page (like dashboard)
- Shows keyboard shortcuts, feature list, tips
- Link it from the dashboard header too

### Dashboard improvements
- Link to dashboard from the widget header (small grid icon button)
- "Open in Dashboard" button per-video at the bottom of the Export tab
- Better empty state with a gif/screenshot showing how to use

### Transcript quality
- Language selector (currently picks English or first available)
- Search-highlight in transcript box
- Click transcript line → seek video to that timestamp

### Notes
- Quote mode: select transcript text → auto-creates a timestamped quote note
- "Ask about this moment" → sends current timestamp + surrounding transcript to LLM
- Auto-chapter: group transcript lines into sections by silence gaps

### Export
- Export screenshots as a ZIP (need background script + offscreen doc)
- Notion / Obsidian clipboard format (already close, just tweak heading levels)
- Share note as a public gist link

### Settings / Persistence
- Per-video settings remembered (auto-pause state is done)
- Global settings page (options.html) for default LLM, max screenshots kept, etc.

### Dashboard
- Filter by date range, by channel
- Bulk export all videos as a single big markdown file
- Optional cloud sync (Firebase / Supabase, user-opt-in only)

---

---

## Lexicon — Vocabulary Intelligence System
> Separate project. Full PRD: `docs/PRD-lexicon.md`

### Status: Planning
- [x] PRD drafted
- [x] Word database format designed
- [x] Cambridge CSV import working (manual)
- [x] Vocab trainer prototype (`vocab-trainer.html`)
- [x] Extended word database with 7 domains (`vocab-extended.csv`)
- [ ] Next.js app scaffold
- [ ] Free API integration (Datamuse, Free Dictionary)
- [ ] Vocabulary DNA engine
- [ ] People graph
- [ ] Browser extension

---

## Website (YT Notes Viewer)
> Zero-dependency static site in `website/` — deploy to Vercel with no build step.

- [x] Single HTML file with embedded CSS/JS
- [x] Parses YAML frontmatter + markdown sections from Social Companion export
- [x] Single and multiple notes with sidebar navigation
- [x] Dark mode, collapsible sections, editorial design
- [x] Deploy via `vercel.json` — no npm install needed
- [x] Live at https://website-sage-zeta-74.vercel.app

---

## Video Stats & Analytics
> Extract and display interesting stats from the videos you watch.

### Near-term
- [ ] **Watch time tracker** — how many hours of video have you taken notes on?
- [ ] **Channel breakdown** — which channels appear most in your notes?
- [ ] **Topic clustering** — group notes by hashtag/topic chips for pattern recognition
- [ ] **Comment sentiment** — simple positive/negative split on top comments
- [ ] **Word cloud** from transcripts — most used words per video or across all videos

### Longer-term
- [ ] **Cross-video insights** — "3 videos mention NEET leaks", "2 videos discuss rent prices in London"
- [ ] **Engagement heatmap** — which timestamps get the most notes/comments
- [ ] **Channel loyalty score** — how often does a channel appear in your notes vs recommendations
- [ ] **Export stats as CSV/JSON** for personal analysis

---

## Robustness & Quality
- [ ] **Retry failed transcript fetches** — exponential backoff, UI indicator
- [ ] **Storage quota handling** — warn before Chrome storage limit, offer cleanup
- [ ] **Error boundaries** — catch and display errors gracefully in widget
- [ ] **Offline support** — cached transcripts and notes work without network
- [ ] **Safari parity** — test and fix Safari-specific DOM differences
- [ ] **Unit tests for metadata extraction** — mock DOM, test each field
- [ ] **E2E tests for full export flow** — paste → parse → render

---

## Completed (this session)
- [x] Dashboard page with video cards, screenshots, notes modal
- [x] Import / Export JSON
- [x] Frame URL saved with every screenshot (?t=42s)
- [x] Copy button fixed (sync cache, no user-gesture race)
- [x] Transcript ghost entries filtered out
- [x] Timestamps clean (no more 1:48.11)
- [x] Metadata + transcript persisted to storage for dashboard
- [x] Dark mode / glassmorphism throughout
- [x] Toast notifications replacing all alert() calls
- [x] Full description in markdown export (removed 500-char truncation)
- [x] Video like count in metadata extraction + frontmatter
- [x] YT Notes viewer website — Vercel-ready, zero-dependency
