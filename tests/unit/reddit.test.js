import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const H = require('../../reddit-helpers.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('reddit-helpers.js', () => {
  describe('parseRedditRoute', () => {
    it('gates to subreddit + post routes only', () => {
      expect(H.parseRedditRoute('https://www.reddit.com/r/macapps/')).toMatchObject({ kind: 'subreddit', subreddit: 'macapps' });
      expect(H.parseRedditRoute('https://www.reddit.com/r/macapps/comments/1wd6uyc/slug/')).toMatchObject({ kind: 'post', subreddit: 'macapps', postId: '1wd6uyc' });
      expect(H.parseRedditRoute('https://www.reddit.com/r/macapps')).toMatchObject({ kind: 'subreddit' });
      expect(H.parseRedditRoute('https://www.reddit.com/user/spez/')).toMatchObject({ kind: '' });
      expect(H.parseRedditRoute('https://www.reddit.com/message/inbox/')).toMatchObject({ kind: '' });
      expect(H.parseRedditRoute('https://www.reddit.com/settings/')).toMatchObject({ kind: '' });
      expect(H.parseRedditRoute('https://x.com/theo')).toMatchObject({ kind: '' });
    });
  });

  describe('scrapeFeedPost (real shreddit-post HTML)', () => {
    it('reads facts from attributes, flair from DOM', () => {
      document.body.innerHTML = fixture('reddit-post.html');
      const el = document.querySelector('shreddit-post');
      const p = H.scrapeFeedPost(el);
      expect(p.postId).toBe('1wd6uyc');
      expect(p.title).toContain('FlowPeek');
      expect(p.author).toBe('Selene_hyun');
      expect(p.score).toBe('6');
      expect(p.comments).toBe('5');
      expect(p.type).toBe('video');
      expect(p.url).toBe('https://www.reddit.com/r/macapps/comments/1wd6uyc/os_flowpeek_a_mermaid_viewer_for_the_diagram_that/');
      expect(p.flair).toContain('Free');
      expect(p.subreddit).toBe('r/macapps');
    });
  });

  describe('scrapeSubredditHeader (real sidebar HTML)', () => {
    it('reads member counts from visible sidebar text', () => {
      document.body.innerHTML = fixture('reddit-sidebar.html');
      const h = H.scrapeSubredditHeader(document, 'macapps');
      expect(h.name).toBe('macapps');
      expect(h.members).toBe('6,433,488');
    });
  });

  describe('extractPostBody (layered fallbacks)', () => {
    it('prefers body slots, then legacy containers, then paragraphs', () => {
      document.body.innerHTML = `<shreddit-post post-title="T"><div slot="text-body"><p>Slot body here, long enough.</p></div><p>Ignored dup</p></shreddit-post>`;
      expect(H.extractPostBody(document.querySelector('shreddit-post'))).toContain('Slot body here');
      document.body.innerHTML = `<shreddit-post post-title="T"><div id="x-post-rtjson-content"><p>Legacy body text long enough.</p></div></shreddit-post>`;
      expect(H.extractPostBody(document.querySelector('shreddit-post'))).toContain('Legacy body');
      document.body.innerHTML = `<shreddit-post post-title="T"><div><p>First para of a real post body.</p><p>Second para continues here.</p></div><shreddit-post-flair><p>Flairish</p></shreddit-post-flair></shreddit-post>`;
      const joined = H.extractPostBody(document.querySelector('shreddit-post'));
      expect(joined).toContain('First para');
      expect(joined).not.toContain('Flairish');
      expect(H.extractPostBody(null)).toBe('');
    });
  });

  describe('buildRedditMarkdown', () => {    it('renders feed backup with receipts', () => {
      const md = H.buildRedditMarkdown({
        route: { kind: 'subreddit', subreddit: 'macapps', url: 'https://www.reddit.com/r/macapps/' },
        header: { name: 'macapps', members: '100,000', online: '50' },
        posts: [{ position: 1, title: 'Test post', url: 'https://www.reddit.com/r/macapps/comments/abc/', author: 'someone', score: '6', comments: '5', type: 'video' }],
      });
      expect(md).toContain('# r/macapps');
      expect(md).toContain('Test post');
      expect(md).toContain('100,000');
      const links = H.buildRedditMarkdown({
        route: { kind: 'subreddit', subreddit: 'macapps' },
        posts: [{ position: 1, title: 'T', url: 'https://www.reddit.com/r/x/comments/1/' }],
        format: 'links',
      });
      expect(links).toBe('https://www.reddit.com/r/x/comments/1/');
      const empty = H.buildRedditMarkdown({ route: { kind: 'post', subreddit: 'macapps', postId: 'x', url: 'https://www.reddit.com/r/macapps/comments/x/' }, post: { title: 'T' }, comments: [] });
      expect(empty).toContain('No comments captured');
    });
  });
});
