/**
 * Cambridge Dictionary parser functions — extracted for unit testing.
 * These are the core parsing functions from dictionary.js, separated
 * so they can be tested with jsdom in vitest.
 */

function clean(s) {
  return (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseListRows(doc) {
  return [...doc.querySelectorAll('li.wordlist-row')].map(row => {
    const a = row.querySelector('.wl-name a');
    const id = row.dataset.wordlistId || '';
    const raw = clean(a?.textContent || '');
    const count = +(raw.match(/\((\d+)\)/)?.[1] || 0);
    const name = clean(raw.replace(/\(\d+\)/, ''));
    let level = clean(row.querySelector('.wl-mobile a')?.textContent)
      || clean([...row.querySelectorAll('span a.fs14, span.fs14')].map(x => x.textContent).find(Boolean));
    let type = 'unknown';
    if (row.classList.contains('sort-personal')) type = 'my';
    else if (row.classList.contains('sort-cup')) type = 'cambridge';
    else if (row.classList.contains('sort-community')) type = 'community';
    return { type, id, name, count, level, url: '' };
  });
}

function parseWords(doc, sourceUrl) {
  const entries = doc.querySelectorAll('li.wordlistentry-row');
  const words = [];
  const seen = new Set();

  entries.forEach(entry => {
    const id = entry.dataset.wordId || '';
    const phraseEl = entry.querySelector('a .phrase');
    const word = clean(phraseEl?.textContent);
    if (!word) return;

    const pos = clean(entry.querySelector('a .pos')?.textContent);

    const gcSpans = entry.querySelectorAll('a .gram .gc');
    const grammar = gcSpans.length === 1
      ? clean(gcSpans[0].textContent)
      : gcSpans.length > 1 ? [...gcSpans].map(s => clean(s.textContent)).join(' or ') : '';

    const usageEls = entry.querySelectorAll('a .usage, a .dusage');
    const usage = [...usageEls].map(e => clean(e.textContent)).filter(Boolean).join(', ');

    const domainEls = entry.querySelectorAll('a .domain, a .ddomain');
    const domain = [...domainEls].map(e => clean(e.textContent)).filter(Boolean).join(', ');

    const cefrEl = entry.querySelector('a .epp-xref, a .dxref');
    const cefr = clean(cefrEl?.textContent);

    const defEl = entry.querySelector('.def');
    const definition = clean(defEl?.textContent);

    const dictEl = entry.querySelector('.h6, .lm-0');
    const dictionary = clean(dictEl?.textContent);

    const key = `${id}-${word}`;
    if (seen.has(key)) return;
    seen.add(key);

    words.push({ word, pos, grammar, usage, domain, cefr, definition, dictionary, id });
  });

  return words;
}

module.exports = { clean, parseListRows, parseWords };
