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
    it('renders receipts, never empty claims', () => {      const md = H.buildXMarkdown({
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

  describe('photos + copy formats', () => {
    it('extracts content photo urls, ignores avatars', () => {
      document.body.innerHTML = fixture('x-article.html');
      const article = document.querySelector('article[data-testid="tweet"]');
      const photoBox = article.querySelector('[data-testid="tweetPhoto"]');
      const img = document.createElement('img');
      img.setAttribute('src', 'https://pbs.twimg.com/media/ABC123?format=jpg');
      photoBox.appendChild(img);
      const t = H.scrapeTweetArticle(article);
      expect(t.photos).toEqual(['https://pbs.twimg.com/media/ABC123?format=jpg']);
    });

    it('renders text / links / compact variants', () => {
      const tweets = [
        { author: 'Theo', handle: 'theo', time: 'Sep 10', text: 'hello world', replies: '79', reposts: '47', likes: '897', views: '146469', statusUrl: 'https://x.com/theo/status/1', hasPhoto: false, hasVideo: false, hasQuote: false, photos: [] },
        { author: 'Theo', handle: 'theo', time: '', text: '', replies: '', reposts: '', likes: '', views: '', statusUrl: 'https://x.com/theo/status/2', hasPhoto: true, hasVideo: false, hasQuote: false, photos: ['https://pbs.twimg.com/media/X'] },
      ];
      const route = { kind: 'profile', handle: 'theo', url: 'https://x.com/theo' };
      const text = H.buildXMarkdown({ route, tweets, format: 'text' });
      expect(text).toContain('1. Theo (@theo):\nhello world');
      const links = H.buildXMarkdown({ route, tweets, format: 'links' });
      expect(links).toBe('https://x.com/theo/status/1\nhttps://x.com/theo/status/2');
      const compact = H.buildXMarkdown({ route, tweets, format: 'compact' });
      expect(compact).toContain('@theo: hello world (💬 79 · 🔁 47 · ❤️ 897) https://x.com/theo/status/1');
      const full = H.buildXMarkdown({ route, tweets, format: 'full' });
      expect(full).toContain('![](https://pbs.twimg.com/media/X)');
    });
  });

  describe('extractThread + buildThreadMarkdown', () => {
    const T = (id, handle, text) => ({ author: handle, handle, time: '', text, replies: '', reposts: '', likes: '', views: '', statusUrl: `https://x.com/${handle}/status/${id}`, statusId: id, hasPhoto: false, hasVideo: false, hasQuote: false, photos: [] });
    it('unrolls same-author continuation after the anchor, skipping others', () => {
      const tweets = [T('1', 'theo', 'first'), T('2', 'heckler', 'reply'), T('3', 'theo', 'second'), T('4', 'theo', 'third')];
      const thread = H.extractThread(tweets, { statusId: '1', handle: 'theo' });
      expect(thread.map((t) => t.statusId)).toEqual(['1', '3', '4']);
      expect(H.extractThread([], {})).toEqual([]);
      expect(H.extractThread([T('9', 'solo', 'only')], {}).length).toBe(1);
    });

    it('renders numbered thread export with receipts', () => {
      const thread = [T('1', 'theo', 'first'), T('3', 'theo', 'second')];
      const md = H.buildThreadMarkdown({ route: { kind: 'post', handle: 'theo', statusId: '1', url: 'https://x.com/theo/status/1' }, thread });
      expect(md).toContain('# Thread by @theo');
      expect(md).toContain('`x` `twitter` `thread`');
      expect(md).toContain('## 1.');
      expect(md).toContain('first');
      expect(md).toContain('## 2.');
      expect(md).toContain('second');
      expect(md).toContain('same-author continuation');
      const empty = H.buildThreadMarkdown({ route: {}, thread: [] });
      expect(empty).toContain('No thread posts captured');
    });
  });
});
