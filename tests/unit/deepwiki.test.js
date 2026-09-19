import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const H = require('../../deepwiki-helpers.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('deepwiki-helpers.js', () => {
  describe('parseDeepwikiRoute', () => {
    it('gates to deepwiki + devin wiki routes only', () => {
      expect(H.parseDeepwikiRoute('https://deepwiki.com/Paranjayy/yt-notes')).toMatchObject({ kind: 'repo', owner: 'Paranjayy', repo: 'yt-notes' });
      expect(H.parseDeepwikiRoute('https://deepwiki.com/ParrrotVR/ultrapoolwebport/1-overview')).toMatchObject({ kind: 'page', owner: 'ParrrotVR', repo: 'ultrapoolwebport', pageId: '1-overview' });
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

    it('discovers public DeepWiki slug routes, not just Devin /page routes', () => {
      document.body.innerHTML = '<nav><a href="/ParrrotVR/ultrapoolwebport/1-overview">Overview</a><a href="/ParrrotVR/ultrapoolwebport/2-runtime">Runtime</a><a href="/other/repo/1-nope">Other</a></nav>';
      const pages = H.scrapeDeepwikiSidebar(document, 'https://deepwiki.com/ParrrotVR/ultrapoolwebport/1-overview');
      expect(pages).toEqual([
        { id: '1-overview', title: 'Overview', href: 'https://deepwiki.com/ParrrotVR/ultrapoolwebport/1-overview' },
        { id: '2-runtime', title: 'Runtime', href: 'https://deepwiki.com/ParrrotVR/ultrapoolwebport/2-runtime' },
      ]);
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

    it('extracts public DeepWiki prose containers without a main or article wrapper', () => {
      document.body.innerHTML = '<div class="prose prose-invert"><h1>Public page</h1><p>This public DeepWiki article is rendered inside the stable prose container.</p></div>';
      const md = H.extractWikiMarkdown(document);
      expect(md).toContain('# Public page');
      expect(md).toContain('This public DeepWiki article');
    });

    it('preserves rendered Mermaid SVG diagrams as fenced svg blocks', () => {
      document.body.innerHTML = '<main><div><h1>Diagram page</h1><pre><svg class="flowchart" role="graphics-document" viewBox="0 0 100 50"><path d="M0 0 L100 50"></path></svg></pre></div></main>';
      const md = H.extractWikiMarkdown(document);
      expect(md).toContain('```svg');
      expect(md).toContain('M0 0 L100 50');
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
      const multi = H.buildDeepwikiMarkdown({
        route: { owner: 'a', repo: 'b' },
        pages: [{ id: '1', title: 'One', href: 'https://x/page/1' }, { id: '2', title: 'Two', href: 'https://x/page/2' }],
        articles: [{ id: '1', title: 'One', url: 'https://x/page/1', markdown: '# One\n\nA captured page with enough content to satisfy the rendered-article receipt threshold.' }, { id: '2', title: 'Two', url: 'https://x/page/2', markdown: '# Two\n\nAnother captured page with enough content to satisfy the rendered-article receipt threshold.' }],
      });
      expect(multi).toContain('Articles (2 captured)');
      expect(multi).toContain('# Two');
      const empty = H.buildDeepwikiMarkdown({ route: { owner: 'a', repo: 'b' }, pages: [], markdown: '' });
      expect(empty).toContain('not captured');
      const links = H.buildDeepwikiMarkdown({ pages: [{ href: 'https://x/page/1' }], format: 'links' });
      expect(links).toBe('https://x/page/1');
    });
  });
});
