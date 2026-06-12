# Original User Request

## Initial Request — 2026-06-12T06:11:38+05:30

We are creating a robust browser extension for YouTube, X (Twitter), and Reddit that allows taking high-precision timestamped notes with screenshots, scraping transcripts reliably, and exporting metadata-rich summaries.

Working directory: `/Users/paranjay/Developer/yt notes`
Integrity mode: development

## Requirements

### R1. Robust Transcript Extraction (99.999% Success Rate)
Extract YouTube transcripts reliably under all circumstances by combining multiple strategies:
1. **Static Data Extraction**: Parse `ytInitialPlayerResponse` directly from the page scripts.
2. **Dynamic DOM Scraping**: Extract transcript text from the native sidebar, adapting to both old selectors (`ytd-transcript-segment-renderer`) and new selectors (`transcript-segment-view-model`).
3. **Auto-Trigger**: Programmatically find and click the "Show transcript" button in the description section if the transcript is not open.
4. **Network Interception**: Intercept outgoing requests to `youtube.com/api/timedtext` to capture the official captions XML track URL.

### R2. Advanced Note Taking & Screenshots
- Support creating empty notes (marker-only timestamp).
- Support inline note text editing.
- Toggleable auto-pausing: automatically pause playback while typing notes, and resume on save.
- Capturing screenshots from the `<video>` element on canvas, and immediately saving/downloading the JPEG to the default Downloads folder.

### R3. Playlist & Queue Metadata
- Detect playlist URL parameters (`list`, `index`).
- Extract the playlist title from the DOM and include the playlist URL, name, and current index in the Markdown frontmatter metadata.
- Prepend personal notes as the primary heading `# Personal Notes & Markers` at the very top of copied/exported Markdown.

### R4. X (Twitter) & Reddit Scrapers
Floating action panel on X and Reddit to scrape post details, text, comments, author stats, and download/copy them as formatted Markdown.

## Acceptance Criteria

### Transcript Verification
- [ ] Grabs the transcript reliably even if the panel is closed initially.
- [ ] Handles new `.ytwTranscriptSegmentViewModelTimestamp` / `.ytAttributedStringHost` transcript segments.

### Notes & Screenshots Verification
- [ ] Users can edit existing notes inline and changes persist in local storage.
- [ ] Pressing "Screenshot" triggers a browser download of the image.

### Playlist Metadata Verification
- [ ] Copied Markdown includes the current playlist name, URL, and item index in the YAML frontmatter.
