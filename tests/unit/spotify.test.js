import { describe, it, expect } from 'vitest';
const H = require('../../spotify-helpers.js');

describe('spotify-helpers.js', () => {
  describe('getSpotifyEpisodeId', () => {
    it('parses /episode/<id> urls', () => {
      expect(H.getSpotifyEpisodeId('https://open.spotify.com/episode/7EalRVaDJXlXYHkYxZWKvX')).toBe('7EalRVaDJXlXYHkYxZWKvX');
      expect(H.getSpotifyEpisodeId('https://open.spotify.com/episode/7EalRVaDJXlXYHkYxZWKvX?si=abc')).toBe('7EalRVaDJXlXYHkYxZWKvX');
      expect(H.getSpotifyEpisodeId('https://open.spotify.com/embed/episode/7EalRVaDJXlXYHkYxZWKvX')).toBe('7EalRVaDJXlXYHkYxZWKvX');
    });
    it('parses spotify: uris and rejects non-episodes', () => {
      expect(H.getSpotifyEpisodeId('spotify:episode:abc123XYZ456789012345')).toBe('abc123XYZ456789012345');
      expect(H.getSpotifyEpisodeId('https://open.spotify.com/show/7bnjJ7Va1nM07Um4Od55dW')).toBe('');
      expect(H.getSpotifyEpisodeId('https://www.youtube.com/watch?v=x')).toBe('');
    });
  });

  describe('isSpotifyEpisodeRoute', () => {
    it('gates to episode routes on spotify hosts', () => {
      expect(H.isSpotifyEpisodeRoute('https://open.spotify.com/episode/7EalRVaDJXlXYHkYxZWKvX')).toBe(true);
      expect(H.isSpotifyEpisodeRoute('https://open.spotify.com/show/abc')).toBe(false);
      expect(H.isSpotifyEpisodeRoute('https://www.youtube.com/watch?v=x')).toBe(false);
    });
  });

  describe('formatSpotifyTimestamp', () => {
    it('formats ms as m:ss / h:mm:ss', () => {
      expect(H.formatSpotifyTimestamp(0)).toBe('0:00');
      expect(H.formatSpotifyTimestamp(65000)).toBe('1:05');
      expect(H.formatSpotifyTimestamp(1655000)).toBe('27:35');
      expect(H.formatSpotifyTimestamp(3723000)).toBe('1:02:03');
    });
  });

  describe('parseTranscriptReadAlong', () => {
    it('parses flat segments', () => {
      const segs = H.parseTranscriptReadAlong({ segments: [{ startMs: 1000, text: ' hello ' }, { startMs: 5000, text: 'world' }] });
      expect(segs).toHaveLength(2);
      expect(segs[0]).toMatchObject({ startMs: 1000, text: 'hello' });
    });
    it('groups read-along words into cues', () => {
      const words = Array.from({ length: 6 }, (_, i) => ({ startTimeMs: i * 1000, endTimeMs: i * 1000 + 500, word: `w${i}` }));
      const segs = H.parseTranscriptReadAlong({ alternatives: [{ words }] });
      expect(segs.length).toBeGreaterThan(0);
      expect(segs[0].text).toContain('w0');
    });
    it('returns [] for junk', () => {
      expect(H.parseTranscriptReadAlong(null)).toEqual([]);
      expect(H.parseTranscriptReadAlong({})).toEqual([]);
    });
  });

  describe('normalize + match (split-episode helper)', () => {
    it('strips show suffixes and edition tags', () => {
      expect(H.normalizeEpisodeTitle('Madeline Argy Debrief: Toxic Relationships • Call Her Daddy')).toBe(
        H.normalizeEpisodeTitle('Madeline Argy Debrief - Toxic Relationships (Full Episode)'),
      );
    });
    it('scores near-identical titles high, unrelated low', () => {
      const spotify = { episode: 'Madeline Argy Debrief: Toxic Relationships', show: 'Call Her Daddy', durationMs: 1655000 };
      const good = { title: 'Madeline Argy Debrief: Toxic Relationships (Full Episode) | Call Her Daddy', channel: 'Call Her Daddy', durationMs: 1658000 };
      const bad = { title: 'Grocery haul vlog week 12', channel: 'Someone Else', durationMs: 600000 };
      expect(H.episodeMatchScore(spotify, good)).toBeGreaterThan(0.6);
      expect(H.episodeMatchScore(spotify, bad)).toBeLessThan(0.3);
    });
    it('findBestYouTubeMatch picks the right candidate', () => {
      const spotify = { episode: 'Madeline Argy Debrief: Toxic Relationships', show: 'Call Her Daddy' };
      const best = H.findBestYouTubeMatch(spotify, [
        { title: 'unrelated video', channel: 'x' },
        { title: 'Madeline Argy Debrief Toxic Relationships', channel: 'Call Her Daddy' },
      ]);
      expect(best?.candidate.title).toContain('Madeline Argy');
    });
  });

  describe('scrapeSpotifyPanel (real transcript-panel DOM)', () => {
    // Faithful miniature of a live #transcript-panel: hashed classes intact
    // to prove the parser depends on structure, not class names.
    const PANEL_HTML = `<div id="transcript-panel" aria-labelledby="transcript-tab">
      <div class="FZ1WVmchN_yuA9A_jQBv"><span data-encore-id="text">This transcript was generated automatically. Its accuracy may vary.</span></div>
      <div class="oRkYCk9PZ9lumPJS62vy"><span dir="auto">Hello Daddy gang.</span></div>
      <div class="oRkYCk9PZ9lumPJS62vy"><span dir="auto">Welcome back for another Sunday session.</span></div>
      <div class="oRkYCk9PZ9lumPJS62vy"><div class="KutU2mG1hCobsxFBkGV0"><span data-encore-id="text">Speaker 2</span></div></div>
      <div class="oRkYCk9PZ9lumPJS62vy"><span dir="auto">I didn&#8217;t have any expectations.</span></div>
      <div class="oRkYCk9PZ9lumPJS62vy"><div class="KutU2mG1hCobsxFBkGV0"><span data-encore-id="text">Speaker 1</span></div></div>
      <div class="oRkYCk9PZ9lumPJS62vy"><span dir="auto">What the fuck?</span></div>
    </div>`;

    it('extracts notice, speakers, and untimed lines', () => {
      document.body.innerHTML = PANEL_HTML;
      const panel = document.getElementById('transcript-panel');
      const { notice, segments } = H.scrapeSpotifyPanel(panel);
      expect(notice).toMatch(/generated automatically/i);
      expect(segments.map((s) => s.text)).toEqual([
        'Hello Daddy gang.',
        'Welcome back for another Sunday session.',
        'I didn’t have any expectations.',
        'What the fuck?',
      ]);
      expect(segments[0]).toMatchObject({ speaker: '', startMs: null });
      expect(segments[2]).toMatchObject({ speaker: 'Speaker 2' });
      expect(segments[3]).toMatchObject({ speaker: 'Speaker 1' });
    });

    it('returns empty for missing panels', () => {
      expect(H.scrapeSpotifyPanel(null)).toEqual({ notice: '', segments: [] });
    });
  });

  describe('renderTranscriptLines', () => {
    it('groups untimed speaker segments under headers', () => {
      const lines = H.renderTranscriptLines([
        { startMs: null, speaker: 'Speaker 1', text: 'Hello Daddy gang.' },
        { startMs: null, speaker: 'Speaker 1', text: 'Welcome back.' },
        { startMs: null, speaker: 'Speaker 2', text: 'I never sang.' },
      ]);
      expect(lines).toContain('**Speaker 1**');
      expect(lines).toContain('**Speaker 2**');
      expect(lines).toContain('Hello Daddy gang.');
      expect(lines.join('\n')).not.toContain('null');
    });
    it('keeps timed read-along cues timestamped', () => {
      const lines = H.renderTranscriptLines([{ startMs: 65000, text: 'timed line' }]);
      expect(lines).toEqual(['[1:05] timed line']);
    });
  });

  describe('buildSpotifyMarkdown', () => {
    it('emits metadata + timestamped transcript + cross-ref', () => {
      const md = H.buildSpotifyMarkdown(
        { episodeId: 'EP123', url: 'https://open.spotify.com/episode/EP123', episode: 'Test Ep', show: 'Test Show', date: 'Oct 1, 2023', duration: '27 min 35 sec', explicit: true, description: 'hello', transcriptSource: 'page transcript tab' },
        [{ startMs: 65000, text: 'first line' }],
        { crossRef: { youtubeUrl: 'https://www.youtube.com/watch?v=abc', youtubeTitle: 'Test Ep Full', score: 0.9 }, capturedAt: '2026-09-10T00:00:00.000Z' },
      );
      expect(md).toContain('# Test Ep');
      expect(md).toContain('EP123');
      expect(md).toContain('[1:05] first line');
      expect(md).toContain('Cross-platform match');
      expect(md).toContain('youtube.com/watch?v=abc');
    });
    it('receipts missing transcripts instead of faking them', () => {
      const md = H.buildSpotifyMarkdown({ episode: 'No Transcript Ep', url: 'https://open.spotify.com/episode/X' }, [], {});
      expect(md).toContain('No transcript captured');
    });
    it('renders speaker-grouped untimed panels + notice + related episodes', () => {
      const md = H.buildSpotifyMarkdown(
        { episode: 'Debrief', show: 'Call Her Daddy', url: 'https://open.spotify.com/episode/E', transcriptNotice: 'This transcript was generated automatically. Its accuracy may vary.' },
        [
          { startMs: null, speaker: 'Speaker 1', text: 'Hello Daddy gang.' },
          { startMs: null, speaker: 'Speaker 2', text: 'I never sang.' },
        ],
        { related: [{ title: 'Next episode', url: 'https://open.spotify.com/episode/N', duration: '30:00' }] },
      );
      expect(md).toContain('**Speaker 1**');
      expect(md).toContain('generated automatically');
      expect(md).toContain('More from Call Her Daddy (1 visible)');
      expect(md).toContain('open.spotify.com/episode/N');
    });
  });
});
