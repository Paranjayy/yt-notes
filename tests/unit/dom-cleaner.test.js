import { describe, it, expect } from 'vitest';
const { stripDomNoise } = require('../../helpers.js');

const X_LIKE_HTML = `<article role="article" class="css-g5y9jx r-18u37iz r-1udh08x" data-testid="tweet" aria-labelledby="id__abc id__def">
  <div class="css-g5y9jx r-eqz5dr" id="id__abc" data-testid="tweetText"><span class="css-1jxf684 r-bcqeeo">Hello world</span></div>
  <a class="css-146c3p1 r-bcqeeo" href="/theo/status/123" aria-label="Sep 10"><time>Sep 10</time></a>
  <svg class="r-4qtqp9"><path d="M100 200 L300 400"/></svg>
  <script>evil()</script>
</article>`;

describe('stripDomNoise', () => {
  it('low mode keeps classes/ids, drops scripts and svg guts', () => {
    document.body.innerHTML = X_LIKE_HTML;
    const root = document.querySelector('article');
    const counts = stripDomNoise(root, 'low');
    expect(root.querySelector('script')).toBeNull();
    expect(root.getAttribute('class')).toMatch(/css-g5y9jx/);
    expect(root.getAttribute('aria-labelledby')).toBe('id__abc id__def');
    expect(root.querySelector('[data-testid="tweetText"]').textContent).toContain('Hello world');
    expect(root.querySelector('svg').innerHTML).toContain('STRIPPED');
    expect(counts.removedElements).toBeGreaterThanOrEqual(1);
  });

  it('high mode strips hashed classes + generated ids, keeps parser anchors', () => {
    document.body.innerHTML = X_LIKE_HTML;
    const root = document.querySelector('article');
    const before = root.outerHTML.length;
    stripDomNoise(root, 'high');
    const after = root.outerHTML.length;
    expect(after).toBeLessThan(before * 0.7);
    expect(root.hasAttribute('class')).toBe(false);
    expect(root.querySelector('[data-testid="tweetText"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="tweetText"]').hasAttribute('class')).toBe(false);
    expect(root.querySelector('a[href="/theo/status/123"]')).not.toBeNull();
    expect(root.querySelector('a[href="/theo/status/123"]').textContent).toContain('Sep 10');
    expect(root.hasAttribute('aria-labelledby')).toBe(false);
    expect(document.getElementById('id__abc')).toBeNull();
    expect(root.querySelector('svg')).not.toBeNull();
  });
});
