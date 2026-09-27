import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Blob as NodeBlob } from 'node:buffer';
const H = require('../../rosint-helpers.js');

const source = fs.readFileSync(path.join(__dirname, '../../rosint.js'), 'utf8');

describe('Rosint widget capture', () => {
  it('uses independent Full/Quick modes for posts and comments in downloads', async () => {
    const pages = {
      Posts: [['post-a', 'post-b'], ['post-c', 'post-d']],
      Comments: [['comment-a', 'comment-b'], ['comment-c', 'comment-d']],
    };
    let tab = 'Comments';
    let page = 0;
    let downloaded;
    document.body.innerHTML = `
      <main>
        <button id="posts-tab">Posts 4</button><button id="comments-tab">Comments 4</button>
        <span id="page-label">Page 1</span><button aria-label="Next page">Next</button>
        <div id="cards"></div>
      </main>`;
    const render = () => {
      document.querySelector('#page-label').textContent = `Page ${page + 1}`;
      document.querySelector('[aria-label="Next page"]').disabled = page === 1;
      document.querySelector('#cards').innerHTML = pages[tab][page].map((id) => tab === 'Posts' ? `
        <article>
          <p>${id}</p>
          <button aria-label="Show post body">show body</button>
          <a href="https://www.reddit.com/r/test/comments/${id}/">open in reddit</a>
        </article>` : `
        <article><div><a href="https://www.reddit.com/r/test/comments/thread/">open in reddit</a></div><div>
          <button aria-label="Expand comment"></button><span>7</span>
          <a href="https://www.reddit.com/r/test">r/test</a>
          <a href="https://www.reddit.com/r/test/comments/thread/${id}/">view comment</a>
        </div></article>`).join('');
      document.querySelectorAll('#cards [aria-label="Show post body"]').forEach((button) => {
        button.onclick = () => {
          setTimeout(() => {
            button.setAttribute('aria-label', 'Hide post body');
            button.closest('article').insertAdjacentHTML('beforeend', `<p>Body of ${button.closest('article').querySelector('p').textContent}</p>`);
          }, 30);
        };
      });
      document.querySelectorAll('#cards [aria-label="Expand comment"]').forEach((button) => {
        button.onclick = () => setTimeout(() => {
          button.setAttribute('aria-label', 'Collapse comment');
          const permalink = [...button.closest('article').querySelectorAll('a')].find((a) => a.textContent === 'view comment');
          button.parentElement.insertAdjacentHTML('beforeend', `<p>Body of ${permalink.href.split('/').filter(Boolean).at(-1)}</p>`);
        }, 30);
      });
    };
    document.querySelector('#posts-tab').onclick = () => { tab = 'Posts'; page = 0; setTimeout(render, 30); };
    document.querySelector('#comments-tab').onclick = () => { tab = 'Comments'; page = 0; setTimeout(render, 30); };
    document.querySelector('[aria-label="Next page"]').onclick = () => { page++; setTimeout(render, 30); };
    render();

    const urlApi = { createObjectURL: (blob) => { downloaded = blob; return 'blob:rosint-test'; }, revokeObjectURL: () => {} };
    const chrome = { storage: { local: { get: (_keys, callback) => callback({}), set: () => {} } }, runtime: { onMessage: { addListener: () => {} } } };
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      window.RosintHelpers = H;
      new Function('window', 'document', 'location', 'chrome', 'MutationObserver', 'navigator', 'Blob', 'URL', 'setTimeout', 'setInterval', source)(
        window, document, { href: 'https://rosint.dev/?u=test' }, chrome, MutationObserver, navigator, NodeBlob, urlApi,
        (fn, ms) => (ms >= 2000 ? 0 : setTimeout(fn, 0)), () => 0
      );
      const widget = document.querySelector('#sc-rosint-widget');
      expect(widget).not.toBeNull();
      expect(widget.querySelector('#sc-rosint-posts-mode').value).toBe('full');
      expect(widget.querySelector('#sc-rosint-comments-mode').value).toBe('full');

      widget.querySelector('#sc-rosint-posts-mode').value = 'quick';
      widget.querySelector('#sc-rosint-posts-mode').dispatchEvent(new Event('change'));
      widget.querySelector('#sc-rosint-dl').click();
      await vi.waitFor(() => expect(downloaded).toBeTruthy(), { timeout: 5000 });
      const first = await downloaded.text();
      expect(first).toContain('## Posts (2 captured)');
      expect(first).toContain('## Comments (4 captured)');
      expect(first).toContain('Body of comment-d');
      expect(first).not.toContain('post-c');

      downloaded = undefined;
      widget.querySelector('#sc-rosint-posts-mode').value = 'full';
      widget.querySelector('#sc-rosint-posts-mode').dispatchEvent(new Event('change'));
      widget.querySelector('#sc-rosint-comments-mode').value = 'quick';
      widget.querySelector('#sc-rosint-comments-mode').dispatchEvent(new Event('change'));
      widget.querySelector('#sc-rosint-dl').click();
      await vi.waitFor(() => expect(downloaded).toBeTruthy(), { timeout: 5000 });
      const second = await downloaded.text();
      expect(second).toContain('## Posts (4 captured)');
      expect(second).toContain('## Comments (2 captured)');
      expect(second).toContain('Body of post-d');
      expect(second).not.toContain('comment-c');
      expect(second).not.toContain('Body of comment-a');

      downloaded = undefined;
      widget.querySelector('#sc-rosint-comments-mode').value = 'full';
      widget.querySelector('#sc-rosint-comments-mode').dispatchEvent(new Event('change'));
      widget.querySelector('#sc-rosint-capture').click();
      await vi.waitFor(() => expect(widget.querySelector('#sc-rosint-status').textContent).toBe('8 captured'), { timeout: 5000 });
      widget.querySelector('#sc-rosint-dl').click();
      await vi.waitFor(() => expect(downloaded).toBeTruthy(), { timeout: 5000 });
      const third = await downloaded.text();
      expect(third).toContain('## Posts (4 captured)');
      expect(third).toContain('## Comments (4 captured)');
    } finally {
      click.mockRestore();
      delete window.RosintHelpers;
    }
  });
});
