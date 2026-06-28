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
