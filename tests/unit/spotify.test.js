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

  describe('getTranscriptApiAction', () => {
    it('maps HTTP statuses to transcript strategy', () => {
      expect(H.getTranscriptApiAction(404)).toBe('empty');
      expect(H.getTranscriptApiAction(401)).toBe('auth');
      expect(H.getTranscriptApiAction(403)).toBe('skip-api');
      expect(H.getTranscriptApiAction(500)).toBe('retry');
      expect(H.getTranscriptApiAction(429)).toBe('retry');
    });
  });

  describe('playlist + track routes', () => {
    it('resolves route kinds', () => {
      expect(H.currentSpotifyRoute('https://open.spotify.com/playlist/2ldKdMWDZw7D9P9RHawcYF')).toBe('playlist');
      expect(H.currentSpotifyRoute('https://open.spotify.com/track/0yo9qd2ga7euzqnnyssspo')).toBe('track');
      expect(H.currentSpotifyRoute('https://open.spotify.com/episode/7EalRVaDJXlXYHkYxZWKvX')).toBe('episode');
      expect(H.getSpotifyPlaylistId('https://open.spotify.com/playlist/2ldKdMWDZw7D9P9RHawcYF?si=x')).toBe('2ldKdMWDZw7D9P9RHawcYF');
      expect(H.isSpotifyTrackRoute('https://open.spotify.com/album/abc')).toBe(false);
    });

    // Structure mirrors the real playlist-tracklist grid (hashed classes
    // changed on purpose to prove the parser ignores them).
    const GRID_HTML = `<div role="grid" data-testid="playlist-tracklist">
      <div role="row" aria-rowindex="1"><div role="columnheader">#</div></div>
      <div role="row" aria-rowindex="2">
        <div role="gridcell" aria-colindex="1">1</div>
        <div role="gridcell" aria-colindex="2">
          <a data-testid="internal-track-link" href="/track/5MCbGWnNLLjoHpbDO3BOgi"><div>Gehra Hua</div></a>
          <span><a href="/artist/465OXuCU8YZNmVG1leLwQ9">Shashwat Sachdev</a>, <a href="/artist/4YRxDV8wJFPHPTeXepOstw">Arijit Singh</a></span>
          <span aria-label="Explicit">E</span>
        </div>
        <div role="gridcell" aria-colindex="3"><a href="/album/2e7HNQJ0BcMoqwsVDwDhK8">Dhurandhar</a></div>
        <div role="gridcell" aria-colindex="4">2 days ago</div>
        <div role="gridcell" aria-colindex="5"><div>6:02</div></div>
      </div>
      <div role="row" aria-rowindex="3">
        <div role="gridcell" aria-colindex="2">
          <a data-testid="internal-track-link" href="/track/AAAA"><div>Second Song</div></a>
          <span><a href="/artist/BBBB">Solo Artist</a></span>
        </div>
        <div role="gridcell" aria-colindex="5"><div>3:44</div></div>
      </div>
      <div role="row" aria-rowindex="4">
        <div role="gridcell" aria-colindex="2">
          <a data-testid="internal-track-link" href="/track/5MCbGWnNLLjoHpbDO3BOgi"><div>Gehra Hua</div></a>
        </div>
        <div role="gridcell" aria-colindex="5"><div>6:02</div></div>
      </div>
    </div>`;

    it('scrapes playlist rows, skips header, dedupes repeats', () => {
      document.body.innerHTML = GRID_HTML;
      const rows = H.scrapePlaylistRows(document.querySelector('[data-testid="playlist-tracklist"]'));
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        position: 1, title: 'Gehra Hua', trackId: '5MCbGWnNLLjoHpbDO3BOgi',
        url: 'https://open.spotify.com/track/5MCbGWnNLLjoHpbDO3BOgi',
        artists: ['Shashwat Sachdev', 'Arijit Singh'], album: 'Dhurandhar',
        duration: '6:02', explicit: true,
      });
      expect(rows[1].title).toBe('Second Song');
    });

    it('parses color-lyrics envelopes', () => {
      const lines = H.parseColorLyrics({ lyrics: { lines: [
        { startTimeMs: 5000, words: 'second line' },
        { startTimeMs: 1000, words: [{ word: 'first' }, { word: 'line' }] },
        { startTimeMs: 9000, words: '' },
      ] } });
      expect(lines.map((l) => l.text)).toEqual(['first line', 'second line']);
    });

    const LYRICS_HTML = `<section><h2>Lyrics</h2>
      <div><div>I know that the bar closes at 11</div></div>
      <div><div>Ohh</div></div>
      <div><button>Show more</button></div>
    </section>`;

    it('extracts lyric lines, drops UI labels', () => {
      document.body.innerHTML = LYRICS_HTML;
      const lines = H.extractLyricsLines(document.querySelector('section'));
      expect(lines).toContain('I know that the bar closes at 11');
      expect(lines).toContain('Ohh');
      expect(lines.join('|')).not.toMatch(/show more|lyrics/i);
    });

    it('builds playlist + lyrics markdown with receipts', () => {
      const pl = H.buildLyricsMarkdown({ title: 'x' }, [], {});
      expect(pl).toContain('No lyrics captured');
      const md = H.buildPlaylistMarkdown(
        { playlistId: 'PL1', url: 'https://open.spotify.com/playlist/PL1', title: 'Gehra Hua', owner: 'Paranjay', songCount: '136 songs' },
        [{ position: 1, title: 'Gehra Hua', url: 'https://open.spotify.com/track/T', artists: ['Arijit Singh'], album: 'Dhurandhar', duration: '6:02', explicit: true }],
        {},
      );
      expect(md).toContain('# Gehra Hua');
      expect(md).toContain('Arijit Singh');
      expect(md).toContain('open.spotify.com/track/T');
      const ly = H.buildLyricsMarkdown(
        { trackId: 'TR1', title: 'drop dead', artists: ['Olivia Rodrigo'], duration: '3:44' },
        [{ startMs: 1000, text: 'timed line' }, 'plain line'],
        { synced: true, source: 'Spotify synced lyrics' },
      );
      expect(ly).toContain('[0:01] timed line');
      expect(ly).toContain('plain line');
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
