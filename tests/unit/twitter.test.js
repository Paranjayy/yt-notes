import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const H = require('../../twitter-helpers.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('twitter-helpers.js', () => {
  describe('parseXRoute', () => {
    it('gates to post + profile routes only', () => {
      expect(H.parseXRoute('https://x.com/theo/status/2097778026113318960')).toMatchObject({ kind: 'post', handle: 'theo', statusId: '2097778026113318960' });
      expect(H.parseXRoute('https://x.com/theo')).toMatchObject({ kind: 'profile', handle: 'theo' });
      expect(H.parseXRoute('https://x.com/home')).toMatchObject({ kind: '' });
      expect(H.parseXRoute('https://x.com/messages')).toMatchObject({ kind: '' });
      expect(H.parseXRoute('https://x.com/i/trending/1')).toMatchObject({ kind: '' });
      expect(H.parseXRoute('https://x.com/search?q=x')).toMatchObject({ kind: '' });
      expect(H.parseXRoute('https://www.youtube.com/watch?v=x')).toMatchObject({ kind: '' });
    });
  });

  describe('scrapeTweetArticle (real X article HTML)', () => {
    it('extracts author, text, status url, and group-label metrics', () => {
      document.body.innerHTML = fixture('x-article.html');
      const article = document.querySelector('article[data-testid="tweet"]');
      const t = H.scrapeTweetArticle(article);
      expect(t.handle).toBe('theo');
      expect(t.text).toContain("Jacob's resignation");
      expect(t.statusUrl).toBe('https://x.com/theo/status/2097778026113318960');
      expect(t.statusId).toBe('2097778026113318960');
      expect(t.time).toBe('Sep 10');
      expect(t.replies).toBe('79');
      expect(t.reposts).toBe('47');
      expect(t.likes).toBe('897');
      expect(t.views).toBe('146469');
    });
  });

  describe('scrapeProfileHeader (real X profile HTML)', () => {
    it('extracts name, bio bits, and follower counts', () => {
      document.body.innerHTML = `<div>${fixture('x-profile.html')}</div>`;
      const header = H.scrapeProfileHeader(document);
      expect(header.displayName).toBe('Theo - t3.gg');
      expect(header.followers).toBe('387.8K');
      expect(header.following).toBe('4,230');
    });
  });

  describe('buildXMarkdown', () => {
    it('renders receipts, never empty claims', () => {
      const md = H.buildXMarkdown({
        route: { kind: 'post', handle: 'theo', statusId: '1', url: 'https://x.com/theo/status/1' },
        profile: null,
        tweets: [{ author: 'Theo', handle: 'theo', time: 'Sep 10', text: 'hello', replies: '1', reposts: '2', likes: '3', views: '', statusUrl: 'https://x.com/theo/status/1', hasPhoto: false, hasVideo: true, hasQuote: false }],
      });
      expect(md).toContain('Post by @theo');
      expect(md).toContain('hello');
      expect(md).toContain('🎬 video');
      const empty = H.buildXMarkdown({ route: { kind: 'profile', handle: 'theo', url: 'https://x.com/theo' }, tweets: [] });
      expect(empty).toContain('No posts captured');
    });
  });
});
