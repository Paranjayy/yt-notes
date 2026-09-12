import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const H = require('../../deepwiki-helpers.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('deepwiki-helpers.js', () => {
  describe('parseDeepwikiRoute', () => {
    it('gates to deepwiki + devin wiki routes only', () => {
      expect(H.parseDeepwikiRoute('https://deepwiki.com/Paranjayy/yt-notes')).toMatchObject({ kind: 'repo', owner: 'Paranjayy', repo: 'yt-notes' });
      expect(H.parseDeepwikiRoute('https://app.devin.ai/org/personal-80-138f3/wiki/Paranjayy/Learning-OSS/page/1.1?branch=main')).toMatchObject({ kind: 'page', host: 'devin', owner: 'Paranjayy', repo: 'Learning-OSS', pageId: '1.1' });
      expect(H.parseDeepwikiRoute('https://app.devin.ai/org/x/wiki/a/b')).toMatchObject({ kind: 'repo' });
      expect(H.parseDeepwikiRoute('https://www.reddit.com/r/macapps/')).toMatchObject({ kind: '' });
      expect(H.parseDeepwikiRoute('https://x.com/theo')).toMatchObject({ kind: '' });
      expect(H.parseDeepwikiRoute('https://app.devin.ai/home')).toMatchObject({ kind: '' });
    });
  });

  describe('scrapeDeepwikiSidebar (real wiki nav HTML)', () => {
    it('discovers pages in order, deduped', () => {
      document.body.innerHTML = fixture('deepwiki-page.html');
      const pages = H.scrapeDeepwikiSidebar(document, 'https://app.devin.ai/org/personal-80-138f3/wiki/Paranjayy/Learning-OSS/page/1?branch=main');
      expect(pages.length).toBe(3);
      expect(pages[0]).toMatchObject({ id: 'repo-note', title: 'Repo Note' });
      expect(pages[2].title).toContain('Getting Started');
      expect(H.scrapeDeepwikiSidebar(null)).toEqual([]);
    });
  });

  describe('extractWikiMarkdown (live wiki-body)', () => {
    it('converts headings, lists, code, tables and strips UI chrome', () => {
      document.body.innerHTML = fixture('deepwiki-page.html');
      const md = H.extractWikiMarkdown(document);
      expect(md).toContain('# Overview');
      expect(md).toContain('## Architecture');
      expect(md).toContain('- App Router pages');
      expect(md).toContain('```ts');
      expect(md).toContain('| Name | Value |');
      expect(md).not.toContain('Ask Devin');
      expect(H.extractWikiMarkdown(document.createElement('div'))).toBe('');
    });
  });

  describe('buildDeepwikiMarkdown', () => {
    it('renders receipts + inventory, never empty claims', () => {
      const md = H.buildDeepwikiMarkdown({
        route: { owner: 'Paranjayy', repo: 'Learning-OSS', pageId: '1', url: 'https://deepwiki.com/Paranjayy/Learning-OSS' },
        pageTitle: 'Overview',
        pageId: '1',
        markdown: '# Overview\n\nHello world, this is a long enough article body for the receipt.',
        pages: [{ id: '1', title: 'Overview', href: 'https://x/page/1' }],
      });
      expect(md).toContain('# Overview');
      expect(md).toContain('`deepwiki`');
      expect(md).toContain('Pages discovered');
      expect(md).toContain('Wiki pages (1 discovered)');
      const empty = H.buildDeepwikiMarkdown({ route: { owner: 'a', repo: 'b' }, pages: [], markdown: '' });
      expect(empty).toContain('not captured');
      const links = H.buildDeepwikiMarkdown({ pages: [{ href: 'https://x/page/1' }], format: 'links' });
      expect(links).toBe('https://x/page/1');
    });
  });
});
