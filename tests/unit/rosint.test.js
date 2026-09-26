import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const H = require('../../rosint-helpers.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('rosint-helpers.js', () => {
  describe('parseRosintRoute', () => {
    it('gates to ?u= profile pages only', () => {
      expect(H.parseRosintRoute('https://rosint.dev/?u=Ok-Computer-010')).toMatchObject({ kind: 'profile', username: 'Ok-Computer-010' });
      expect(H.parseRosintRoute('https://rosint.dev/?u=u/Slight_Meaning5907')).toMatchObject({ kind: 'profile', username: 'Slight_Meaning5907' });
      expect(H.parseRosintRoute('https://rosint.dev/')).toMatchObject({ kind: '' });
      expect(H.parseRosintRoute('https://rosint.dev/changelog.html')).toMatchObject({ kind: '' });
      expect(H.parseRosintRoute('https://www.reddit.com/r/rajkot/')).toMatchObject({ kind: '' });
    });
  });

  describe('scrapeRosintProfile (real Rosint header HTML)', () => {
    it('reads username + tab counts from the header', () => {
      document.body.innerHTML = fixture('rosint-profile.html');
      const p = H.scrapeRosintProfile(document, 'Ok-Computer-010');
      expect(p.username).toBe('Ok-Computer-010');
      expect(p.tabPosts).toBe('55');
      expect(p.tabComments).toBe('104+');
    });
  });

  describe('scrapeRosintCards (real Rosint card HTML)', () => {
    it('parses collapsed + expanded cards without class selectors', () => {
      document.body.innerHTML = fixture('rosint-profile.html');
      const cards = H.scrapeRosintCards(document);
      expect(cards.length).toBe(2);
      const collapsed = cards[0];
      expect(collapsed.subreddit).toBe('r/Bitsatards');
      expect(collapsed.timeRel).toBe('42d ago');
      expect(collapsed.score).toBe('27');
      expect(collapsed.title).toContain('Bits goa');
      expect(collapsed.body).toBe('');
      expect(collapsed.badges).toContain('Removed');
      expect(collapsed.url).toBe('https://www.reddit.com/r/Bitsatards/comments/1vo6y5f/bits_goa_for_you_guys/');
      const expanded = cards[1];
      expect(expanded.subreddit).toBe('r/ImmigrationCanada');
      expect(expanded.body).toContain('April 30, 2025');
      expect(expanded.url).toContain('/comments/1fl7yab/');
    });

    it('dedupes by URL', () => {
      document.body.innerHTML = fixture('rosint-profile.html') + fixture('rosint-profile.html');
      // Duplicated fixture doubles anchors; dedupe keeps 2.
      expect(H.scrapeRosintCards(document).length).toBe(2);
      expect(H.scrapeRosintCards(null)).toEqual([]);
    });
  });

  describe('pagination helpers', () => {
    it('reads page label + next-page availability', () => {
      document.body.innerHTML = fixture('rosint-profile.html');
      expect(H.getRosintPage(document)).toBe(1);
      expect(H.hasRosintNextPage(document)).toBe(true);
      expect(H.findRosintTab(document, 'Posts')?.textContent).toMatch(/Posts/);
      expect(H.findRosintTab(document, 'Comments')?.textContent).toMatch(/Comments/);
    });
  });

  describe('buildRosintMarkdown', () => {
    it('renders profile + posts with receipts, receipted empty bodies', () => {
      document.body.innerHTML = fixture('rosint-profile.html');
      const route = H.parseRosintRoute('https://rosint.dev/?u=Ok-Computer-010');
      const md = H.buildRosintMarkdown({
        route,
        profile: H.scrapeRosintProfile(document, 'Ok-Computer-010'),
        posts: H.scrapeRosintCards(document),
        comments: [],
        pagesCrawled: { posts: 1, comments: 0 },
      });
      expect(md).toContain('# u/Ok-Computer-010');
      expect(md).toContain('`rosint`');
      expect(md).toContain('Bits goa');
      expect(md).toContain('body not expanded');
      expect(md).toContain('April 30, 2025');
      expect(md).toContain('Arctic Shift + PullPush');
      const links = H.buildRosintMarkdown({ route, posts: H.scrapeRosintCards(document), comments: [], format: 'links' });
      expect(links).toContain('https://www.reddit.com/r/Bitsatards/comments/1vo6y5f/bits_goa_for_you_guys/');
    });
  });
});
