import { describe, it, expect } from 'vitest';
const { JSDOM } = require('jsdom');
const { clean, parseListRows, parseWords } = require('./dictionary-parser.js');

// ─── Real HTML from Cambridge Dictionary wordlist page ───
// (extracted from the user's DOM snapshot of the "Cool" list)
const WORDLIST_PAGE_HTML = `
<ul class="hul-u lmt-10 hax" id="wordlistEntries">
  <li class="wordlistentry-row" data-word-id="190357843">
    <div class="bpb hbr-10 lp-20 lpr-15 lpt-15 lpb-15 lmb-10">
      <div class="x lmb-10">
        <div class="hfl">
          <a class="tb" href="https://dictionary.cambridge.org/dictionary/english/salivate">
            <span class="phrase haxa lmr-10">salivate</span>
            <span class="pos fs14 ti">verb</span>
            <span class="gram dgram tn lml-8">[ <span class="gc dgc">I</span> ]</span>
            <div>
              <span class="tn usage dusage dlab">humorous or specialized</span>
              <span class="tn domain ddomain lml-8">BIOLOGY</span>
            </div>
          </a>
        </div>
      </div>
      <div class="def fs16 fs18-s fs19-m lmb-10">to produce saliva</div>
      <div class="x lc1">
        <div class="hfl lpt-10"><p class="h6 lm-0">English</p></div>
      </div>
    </div>
  </li>

  <li class="wordlistentry-row" data-word-id="190356294">
    <div class="bpb hbr-10 lp-20 lpr-15 lpt-15 lpb-15 lmb-10">
      <div class="x lmb-10">
        <div class="hfl">
          <a class="tb" href="https://dictionary.cambridge.org/dictionary/english/sundries">
            <span class="phrase haxa lmr-10">sundries</span>
            <span class="pos fs14 ti">noun</span>
            <span class="gram dgram tn lml-8">[ <span class="gc dgc">plural</span> ]</span>
          </a>
        </div>
      </div>
      <div class="def fs16 fs18-s fs19-m lmb-10">various different small things that are considered together</div>
      <div class="x lc1">
        <div class="hfl lpt-10"><p class="h6 lm-0">English</p></div>
      </div>
    </div>
  </li>

  <li class="wordlistentry-row" data-word-id="181829380">
    <div class="bpb hbr-10 lp-20 lpr-15 lpt-15 lpb-15 lmb-10">
      <div class="x lmb-10">
        <div class="hfl">
          <a class="tb" href="https://dictionary.cambridge.org/dictionary/english/scintillating">
            <span class="phrase haxa lmr-10">scintillating</span>
            <span class="pos fs14 ti">adjective</span>
          </a>
        </div>
      </div>
      <div class="def fs16 fs18-s fs19-m lmb-10">funny, exciting, and clever</div>
      <div class="x lc1">
        <div class="hfl lpt-10"><p class="h6 lm-0">English</p></div>
      </div>
    </div>
  </li>

  <li class="wordlistentry-row" data-word-id="168340879">
    <div class="bpb hbr-10 lp-20 lpr-15 lpt-15 lpb-15 lmb-10">
      <div class="x lmb-10">
        <div class="hfl">
          <a class="tb" href="https://dictionary.cambridge.org/dictionary/english/superlative">
            <span class="phrase haxa lmr-10">superlative</span>
            <span class="pos fs14 ti">noun</span>
            <span class="gram dgram tn lml-8">[ <span class="gc dgc">C</span> ]</span>
            <div>
              <span class="def-info ddef-info"><span class="epp-xref dxref A2">A2</span></span>
              <span class="tn usage dusage dlab lml-8">specialized</span>
              <span class="tn domain ddomain lml-8">LANGUAGE</span>
            </div>
          </a>
        </div>
      </div>
      <div class="def fs16 fs18-s fs19-m lmb-10">the form of an adjective or adverb that expresses that the thing or person being described has more of the particular quality</div>
      <div class="x lc1">
        <div class="hfl lpt-10"><p class="h6 lm-0">English</p></div>
      </div>
    </div>
  </li>

  <li class="wordlistentry-row" data-word-id="179209687">
    <div class="bpb hbr-10 lp-20 lpr-15 lpt-15 lpb-15 lmb-10">
      <div class="x lmb-10">
        <div class="hfl">
          <a class="tb" href="https://dictionary.cambridge.org/dictionary/english/canoodle">
            <span class="phrase haxa lmr-10">canoodle</span>
            <span class="pos fs14 ti">verb</span>
            <span class="gram dgram tn lml-8">[ <span class="gc dgc">I</span> ]</span>
            <div>
              <span class="tn usage dusage dlab">old-fashioned informal</span>
            </div>
          </a>
        </div>
      </div>
      <div class="def fs16 fs18-s fs19-m lmb-10">If two people canoodle, they kiss and hold each other in a sexual way.</div>
      <div class="x lc1">
        <div class="hfl lpt-10"><p class="h6 lm-0">English</p></div>
      </div>
    </div>
  </li>

  <li class="wordlistentry-row" data-word-id="150106889">
    <div class="bpb hbr-10 lp-20 lpr-15 lpt-15 lpb-15 lmb-10">
      <div class="x lmb-10">
        <div class="hfl">
          <a class="tb" href="https://dictionary.cambridge.org/dictionary/learner-english/trite_1">
            <span class="phrase haxa lmr-10">trite</span>
            <span class="pos fs14 ti">adjective</span>
          </a>
        </div>
      </div>
      <div class="def fs16 fs18-s fs19-m lmb-10">A trite remark, idea, etc does not seem sincere or true because it has been used so much before or is too simple.</div>
      <div class="x lc1">
        <div class="hfl lpt-10"><p class="h6 lm-0">Learner's Dictionary</p></div>
      </div>
    </div>
  </li>

  <li class="wordlistentry-row" data-word-id="154885995">
    <div class="bpb hbr-10 lp-20 lpr-15 lpt-15 lpb-15 lmb-10">
      <div class="x lmb-10">
        <div class="hfl">
          <a class="tb" href="https://dictionary.cambridge.org/dictionary/english/addendum">
            <span class="phrase haxa lmr-10">addendum</span>
            <span class="pos fs14 ti">noun</span>
            <span class="gram dgram tn lml-8">[ <span class="gc dgc">C</span> ]</span>
            <div>
              <span class="tn usage dusage dlab">specialized</span>
              <span class="tn domain ddomain lml-8">PUBLISHING</span>
            </div>
          </a>
        </div>
      </div>
      <div class="def fs16 fs18-s fs19-m lmb-10">something that has been added to a book, speech, or document</div>
      <div class="x lc1">
        <div class="hfl lpt-10"><p class="h6 lm-0">English</p></div>
      </div>
    </div>
  </li>
</ul>
`;

// ─── Real HTML from wordlist INDEX page ───
const INDEX_PAGE_HTML = `
<ul class="hul-u hax fs-18 wordlist-personal">
  <li data-wordlist-id="103770619" class="pr wordlist-row bg hao hbr-20 lmb-10 sort-personal">
    <span class="hdf hflx-c wl-parent">
      <span class="hdib tb lml-15 hoh dipa to-e wl-name">
        <a href="https://dictionary.cambridge.org/plus/wordlist/103770619_cool">Cool&nbsp; <span class="hdi hdn-xs break">(270)</span></a>
      </span>
    </span>
  </li>
  <li data-wordlist-id="103416098" class="pr wordlist-row bg hao hbr-20 lmb-10 sort-personal">
    <span class="hdf hflx-c wl-parent">
      <span class="hdib tb lml-15 hoh dipa to-e wl-name">
        <a href="https://dictionary.cambridge.org/plus/wordlist/103416098_misc">Misc&nbsp; <span class="hdi hdn-xs break">(6)</span></a>
      </span>
    </span>
  </li>
</ul>
<ul class="hul-u hax fs-18 wordlist-cambridge">
  <li data-wordlist-id="547" class="pr wordlist-row bg hao hbr-20 lmb-10 sort-cup">
    <span class="hdf hflx-c wl-parent">
      <span class="hdib tb lml-15 hoh dipa to-e wl-name">
        <a href="https://dictionary.cambridge.org/plus/wordlist/547_words-about-education">Words about education&nbsp; <span class="hdi hdn-xs break">(20)</span></a>
      </span>
      <span class="hdb hdn-xs lpr-10 lpl-10 wl-mobile">
        <a class="fs14 lmr-5 lpt-1 tcu" href="https://dictionary.cambridge.org/plus/wordlist/547_words-about-education">Beginner</a>
      </span>
    </span>
  </li>
  <li data-wordlist-id="234" class="pr wordlist-row bg hao hbr-20 lmb-10 sort-cup">
    <span class="hdf hflx-c wl-parent">
      <span class="hdib tb lml-15 hoh dipa to-e wl-name">
        <a href="https://dictionary.cambridge.org/plus/wordlist/234_words-about-work">Words about work&nbsp; <span class="hdi hdn-xs break">(20)</span></a>
      </span>
      <span class="hdb hdn-xs lpr-10 lpl-10 wl-mobile">
        <a class="fs14 lmr-5 lpt-1 tcu" href="https://dictionary.cambridge.org/plus/wordlist/234_words-about-work">Advanced</a>
      </span>
    </span>
  </li>
</ul>
<ul class="hul-u hax fs-18 wordlist-community">
  <li data-wordlist-id="21826933" class="pr wordlist-row bg hao hbr-20 lmb-10 sort-community">
    <span class="hdf hflx-c wl-parent">
      <span class="hdib tb lml-15 hoh dipa to-e wl-name">
        <a href="https://dictionary.cambridge.org/plus/wordlist/21826933_using-computers">Using computers&nbsp; <span class="hdi hdn-xs break">(20)</span></a>
      </span>
      <span class="hdb hdn-xs lpr-10 lpl-10 wl-mobile">
        <a class="fs14 lmr-5 lpt-1 tcu" href="https://dictionary.cambridge.org/plus/wordlist/21826933_using-computers">Intermediate</a>
      </span>
    </span>
  </li>
</ul>
`;

function makeDoc(html) {
  return new JSDOM(html).window.document;
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

describe('clean()', () => {
  it('should normalize whitespace and non-breaking spaces', () => {
    expect(clean('  hello   world  ')).toBe('hello world');
    expect(clean('hello\u00a0world')).toBe('hello world');
    expect(clean(null)).toBe('');
    expect(clean(undefined)).toBe('');
    expect(clean('')).toBe('');
  });
});

describe('parseListRows()', () => {
  const doc = makeDoc(INDEX_PAGE_HTML);
  const rows = parseListRows(doc);

  it('should find all wordlist rows across categories', () => {
    expect(rows.length).toBe(4);
  });

  it('should parse personal lists correctly', () => {
    const cool = rows.find(r => r.id === '103770619');
    expect(cool).toBeDefined();
    expect(cool.name).toBe('Cool');
    expect(cool.count).toBe(270);
    expect(cool.type).toBe('my');
  });

  it('should parse cambridge lists with level', () => {
    const edu = rows.find(r => r.id === '547');
    expect(edu).toBeDefined();
    expect(edu.name).toBe('Words about education');
    expect(edu.count).toBe(20);
    expect(edu.type).toBe('cambridge');
    expect(edu.level).toBe('Beginner');

    const work = rows.find(r => r.id === '234');
    expect(work.level).toBe('Advanced');
  });

  it('should parse community lists', () => {
    const comp = rows.find(r => r.id === '21826933');
    expect(comp).toBeDefined();
    expect(comp.name).toBe('Using computers');
    expect(comp.type).toBe('community');
    expect(comp.level).toBe('Intermediate');
  });
});

describe('parseWords()', () => {
  const doc = makeDoc(WORDLIST_PAGE_HTML);
  const words = parseWords(doc, 'https://example.com');

  it('should extract all 8 word entries', () => {
    expect(words.length).toBe(8);
  });

  it('should extract basic word info', () => {
    const salivate = words.find(w => w.word === 'salivate');
    expect(salivate).toBeDefined();
    expect(salivate.pos).toBe('verb');
    expect(salivate.grammar).toBe('I');
    expect(salivate.definition).toBe('to produce saliva');
    expect(salivate.dictionary).toBe('English');
    expect(salivate.id).toBe('190357843');
  });

  it('should extract usage labels', () => {
    const salivate = words.find(w => w.word === 'salivate');
    expect(salivate.usage).toBe('humorous or specialized');
  });

  it('should extract domain labels', () => {
    const salivate = words.find(w => w.word === 'salivate');
    expect(salivate.domain).toBe('BIOLOGY');
  });

  it('should extract CEFR level', () => {
    const superlative = words.find(w => w.word === 'superlative');
    expect(superlative).toBeDefined();
    expect(superlative.cefr).toBe('A2');
    expect(superlative.pos).toBe('noun');
    expect(superlative.grammar).toBe('C');
    expect(superlative.usage).toBe('specialized');
    expect(superlative.domain).toBe('LANGUAGE');
  });

  it('should handle words without grammar labels', () => {
    const scintillating = words.find(w => w.word === 'scintillating');
    expect(scintillating).toBeDefined();
    expect(scintillating.pos).toBe('adjective');
    expect(scintillating.grammar).toBe('');
    expect(scintillating.definition).toBe('funny, exciting, and clever');
  });

  it('should handle multi-word usage labels', () => {
    const canoodle = words.find(w => w.word === 'canoodle');
    expect(canoodle.usage).toBe('old-fashioned informal');
  });

  it('should handle Learner Dictionary source', () => {
    const trite = words.find(w => w.word === 'trite');
    expect(trite).toBeDefined();
    expect(trite.dictionary).toBe("Learner's Dictionary");
    expect(trite.pos).toBe('adjective');
  });

  it('should extract domain and usage together', () => {
    const addendum = words.find(w => w.word === 'addendum');
    expect(addendum).toBeDefined();
    expect(addendum.usage).toBe('specialized');
    expect(addendum.domain).toBe('PUBLISHING');
    expect(addendum.grammar).toBe('C');
  });

  it('should deduplicate words with same id+word', () => {
    // Parse the same doc twice — should get same count
    const words2 = parseWords(doc, 'https://example.com');
    expect(words2.length).toBe(words.length);
  });

  it('should handle empty DOM gracefully', () => {
    const emptyDoc = makeDoc('<div></div>');
    expect(parseWords(emptyDoc, '')).toEqual([]);
  });

  it('all words should have required fields', () => {
    words.forEach(w => {
      expect(w.word).toBeTruthy();
      expect(typeof w.pos).toBe('string');
      expect(typeof w.grammar).toBe('string');
      expect(typeof w.usage).toBe('string');
      expect(typeof w.domain).toBe('string');
      expect(typeof w.cefr).toBe('string');
      expect(typeof w.definition).toBe('string');
      expect(typeof w.dictionary).toBe('string');
      expect(typeof w.id).toBe('string');
    });
  });
});
