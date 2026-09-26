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

    it('reads PDP image-post bodies from shreddit-post-text-body', () => {
      document.body.innerHTML = `<shreddit-post id="t3_1wiagzg"><h1 id="post-title-t3_1wiagzg">I AM DONEE</h1><shreddit-post-text-body><div id="t3_1wiagzg-post-rtjson-content"><p>FAAAK body with photo post.</p><p>Second para here.</p></div></shreddit-post-text-body></shreddit-post>`;
      expect(H.extractPostBody(document.querySelector('shreddit-post'))).toContain('FAAAK body');
    });
  });

  describe('scrapePostDetail (PDP image/media posts)', () => {
    it('parses title/author/body without card attributes', () => {
      document.body.innerHTML = `<shreddit-title title="I AM DONEE.... : r/rajkot"></shreddit-title>
        <shreddit-post id="t3_1wiagzg"><h1 id="post-title-t3_1wiagzg">I AM DONEE.... I CANTTT.....</h1>
        <a href="/user/real_pinak/" aria-label="Author: real_pinak">real_pinak</a>
        <shreddit-post-text-body><div id="t3_1wiagzg-post-rtjson-content"><p>FAAAK....... FAAAKKKKK..... JUST END ME</p></div></shreddit-post-text-body></shreddit-post>`;
      const pdp = H.scrapePostDetail(document, { kind: 'post', subreddit: 'rajkot', postId: '1wiagzg', url: 'https://www.reddit.com/r/rajkot/comments/1wiagzg/x/' });
      expect(pdp.postId).toBe('1wiagzg');
      expect(pdp.title).toContain('I AM DONEE');
      expect(pdp.author).toBe('real_pinak');
      expect(pdp.body).toContain('FAAAK');
    });

    it('returns null without a post id, minimal fact from route otherwise', () => {
      document.body.innerHTML = `<div>no post here</div>`;
      expect(H.scrapePostDetail(document, { kind: 'post', subreddit: 'x' })).toBeNull();
    });
  });

  describe('collectRedditMedia', () => {
    it('collects image/player/video urls, normalizes preview hosts', () => {
      document.body.innerHTML = `<shreddit-post>
        <img src="https://preview.redd.it/abc123?width=640&auto=webp&s=zzz">
        <img src="https://www.redditstatic.com/avatar.png">
        <shreddit-player src="https://v.redd.it/def456/DASH_720.mp4?source=fallback"></shreddit-player>
        <video><source src="https://v.redd.it/ghi789/video.mp4"></video>
        <a href="/gallery/jkl012">gallery</a>
      </shreddit-post>`;
      const urls = H.collectRedditMedia(document.querySelector('shreddit-post'));
      expect(urls).toContain('https://i.redd.it/abc123');
      expect(urls).toContain('https://v.redd.it/def456/DASH_720.mp4');
      expect(urls).toContain('https://v.redd.it/ghi789/video.mp4');
      expect(urls).toContain('https://www.reddit.com/gallery/jkl012');
      expect(urls.join('|')).not.toContain('redditstatic');
      expect(H.collectRedditMedia(null)).toEqual([]);
    });

    it('collects PDP external-preview images', () => {
      document.body.innerHTML = `<shreddit-post id="t3_1wiagzg"><img src="https://external-preview.redd.it/abc.png?width=640&auto=webp&s=zzz"></shreddit-post>`;
      expect(H.collectRedditMedia(document.querySelector('shreddit-post'))).toContain('https://external-preview.redd.it/abc.png');
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

    it('renders a media section for posts with media', () => {
      const md = H.buildRedditMarkdown({
        route: { kind: 'post', subreddit: 'teenindia', postId: '1', url: 'https://www.reddit.com/r/teenindia/comments/1/' },
        post: { title: 'T', media: ['https://i.redd.it/frog.jpg', 'https://v.redd.it/abc/DASH.mp4'] },
        comments: [],
      });
      expect(md).toContain('## Media');
      expect(md).toContain('![](https://i.redd.it/frog.jpg)');
      expect(md).toContain('https://v.redd.it/abc/DASH.mp4');
    });
  });
});
