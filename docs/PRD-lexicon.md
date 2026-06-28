# PRD: Lexicon — Personal Vocabulary Intelligence System

> Not a dictionary. Not flashcards. A language knowledge graph.

## Vision

A system that treats vocabulary as a **connected network** — not isolated flashcards. Every word has relationships to people, topics, examples, and other words. You learn by exploring neighborhoods, not memorizing lists.

**One-line pitch:** Know your words the way you know people — by their habits, friends, and context.

---

## Problem

Current vocabulary tools (Anki, Quizlet, Memrise) all do the same thing:
- Word → Definition → Mark known/unknown
- No connections between words
- No understanding of *who* uses them, *where* they appear, or *why* they matter
- No intelligence about your own vocabulary growth

**The gap:** There's no tool that answers "What words should *I* learn next based on what I already know and what I read?"

---

## Target Users

| Persona | What they want |
|---|---|
| **IELTS/GRE aspirants** | Targeted vocab for exams, frequency-based learning |
| **Writers & essayists** | Precision vocabulary, collocations, register awareness |
| **Language enthusiasts** | Word origins, untranslatable words, vocabulary of interesting people |
| **Non-native English speakers** | CEFR-leveled progression, pronunciation, usage examples |
| **Content creators** | "What words does [person] use that I don't?" |

---

## Core Features

### V1: Foundation (MVP)

#### 1. Word Database
Each word is a rich object, not a flashcard:

```
Word: ephemeral
├── POS: adjective
├── IPA: /ɪˈfem.ər.əl/
├── Audio: 🔊 (UK + US)
├── CEFR: B2
├── Domain: [general, literary, philosophy]
├── Register: [formal, literary]
├── Definition: lasting for only a short time
├── Examples:
│   ├── "The beauty of cherry blossoms is ephemeral."
│   ├── "Fame on social media is often ephemeral."
│   └── "AI-generated content has an ephemeral quality."
├── Collocations: ephemeral beauty, ephemeral success, ephemeral moment
├── Synonyms: temporary, fleeting, transient, evanescent
├── Antonyms: permanent, lasting, enduring
├── Etymology: Greek ephēmeros "lasting only a day"
├── Word family: ephemera (n), ephemerally (adv)
├── Related: transient, fleeting, evanescent, fugacious
└── Personal notes: (user can add)
```

#### 2. Import System
- **Cambridge CSV export** (manual upload — `Word list: Name,,,` format)
- **Generic CSV** (`word,pos,definition`)
- **Plain text** (one word per line)
- **Paste from clipboard**
- Future: browser extension auto-imports from reading

#### 3. Quiz Engine
- **Multiple Choice** — 4 options, definition → word and word → definition
- **Type the Definition** — fuzzy matching with partial credit
- **Audio Quiz** — hear pronunciation, type the word
- **Context Quiz** — fill in the blank from a real sentence
- **Collocation Quiz** — which word pairs with this?

#### 4. Flashcards
- Flip animation with keyboard shortcuts
- Audio on front face
- Mark: known / learning / new
- Filter by domain, list, or status
- Spaced repetition scheduling (future)

#### 5. Progress Tracking
- Stats dashboard: total, known, learning, new
- Words per domain
- Learning velocity (words/day)
- All persisted in localStorage (V1), cloud sync (V2)

---

### V2: Intelligence Layer

#### 6. Vocabulary DNA
For any body of text, generate a profile:

```
┌─────────────────────────────────────────┐
│           VOCABULARY DNA                │
│                                         │
│  Reading Level    ████████░░  C1        │
│  Precision        ██████████  Expert    │
│  Technicality     ███████░░░  High      │
│  Creativity       ████████░░  High      │
│  Emotion          ████░░░░░░  Low       │
│  Formality        ████████░░  Formal    │
│  Vocabulary Size  ~18,000 active        │
│  Rare Word Rate   12%                   │
│  Avg Sentence Len 24 words              │
│                                         │
│  Top Domains:                           │
│  Technology ████████████                │
│  Philosophy ██████████                  │
│  Writing    ████████                    │
│  Economics  ██████                      │
│                                         │
│  Signature Words:                       │
│  juxtapose, ephemeral, pragmatic,       │
│  nuance, affordance, emergence          │
└─────────────────────────────────────────┘
```

How it works:
- Upload text (blog post, essay, transcript)
- Tokenize → POS tag → frequency analysis
- Compare against corpus (COCA, BNC, or scraped data)
- Generate rarity score, domain distribution, style fingerprint

#### 7. People Graph
Compare vocabulary across people:

```
You ─────────────── Shashi Tharoor
                    ├── Ubiquitous (you: unknown)
                    ├── Civilizational (you: unknown)
                    ├── Imperative (you: learning)
                    └── Interlocutor (you: unknown)

You ─────────────── David Perell
                    ├── Juxtapose (you: known ✓)
                    ├── Narrative (you: known ✓)
                    └── Thesis (you: learning)

You ─────────────── Michael Dean
                    ├── Material (you: known ✓)
                    ├── Voice (you: known ✓)
                    └── Cohesion (you: unknown)
```

How it works:
- Scrape a person's public writing/transcripts
- Run vocabulary DNA on their text
- Diff against your known words
- Show: words they use that you don't
- Recommend: "Learn these 20 words to read Perell fluently"

#### 8. Topic Clusters
Words grouped by semantic similarity:

```
Persuasion
├── rhetoric
├── persuasion
├── rhetoric
├── discourse
├── argument
├── rhetoric
├── rhetoric
├── rhetoric
├── rhetoric
├── rhetoric
├── rhetoric
└── rhetoric

Thinking
├── epistemology
├── heuristic
├── induction
└── ...
```

Uses Datamuse API (`/words?rel_syn=...&rel_trg=...`) for free word relationships.

---

### V3: Ecosystem

#### 9. Browser Extension
- Highlight unknown words on any webpage
- Click → definition popup
- Auto-save new words to your database
- "Reading mode" — tracks words encountered vs. known

#### 10. Writing Assistant
- Paste your text
- Shows: "You used 'good' 3 times. Consider: compelling, persuasive, elegant"
- Suggests upgrades based on your vocabulary level
- Highlights words you know but never use in writing

#### 11. Free API Integration
| API | Use | Cost |
|---|---|---|
| [Free Dictionary API](https://dictionaryapi.dev/) | Definitions, pronunciation, audio | Free |
| [Datamuse API](https://www.datamuse.com/api/) | Synonyms, antonyms, related words, triggers | Free (100K/day) |
| [WordsAPI](https://www.wordsapi.com/) | Etymology, usage examples | Free tier |
| [Merriam-Webster API](https://dictionaryapi.com/) | Definitions, thesaurus | Free (1000/day) |
| [Cambridge CDN](https://dictionary.cambridge.org/media/) | Audio pronunciation | Free (predictable URLs) |

**Cambridge API is NOT free** (requires CUP license), but:
- The `/export` endpoint works for logged-in +Plus users
- Audio CDN URLs follow a predictable pattern
- We can scrape definitions from the public dictionary pages

---

## Technical Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  Next.js 14 + Tailwind + Framer Motion      │
│  Dark theme, responsive, PWA               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│                  API Layer                   │
│  Next.js API Routes / tRPC                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│                Database                     │
│  SQLite (local) → PostgreSQL (cloud)        │
│  Drizzle ORM                               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           External APIs (free)              │
│  Datamuse · Free Dict · WordsAPI            │
│  Cambridge CDN (audio)                      │
└─────────────────────────────────────────────┘
```

### Data Model

```sql
-- Core word
CREATE TABLE words (
  id INTEGER PRIMARY KEY,
  word TEXT UNIQUE NOT NULL,
  pos TEXT,
  ipa_uk TEXT,
  ipa_us TEXT,
  audio_uk TEXT,
  audio_us TEXT,
  cefr TEXT,          -- A1, A2, B1, B2, C1, C2
  domain TEXT,        -- thinking, psychology, ai, economics, writing, philosophy
  register TEXT,      -- formal, informal, literary, technical
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Definitions (many per word)
CREATE TABLE definitions (
  id INTEGER PRIMARY KEY,
  word_id INTEGER REFERENCES words(id),
  definition TEXT NOT NULL,
  source TEXT,        -- cambridge, datamuse, user
  is_primary BOOLEAN DEFAULT FALSE
);

-- Examples (many per word)
CREATE TABLE examples (
  id INTEGER PRIMARY KEY,
  word_id INTEGER REFERENCES words(id),
  sentence TEXT NOT NULL,
  source TEXT         -- cambridge, book, user
);

-- Collocations
CREATE TABLE collocations (
  id INTEGER PRIMARY KEY,
  word_id INTEGER REFERENCES words(id),
  collocate TEXT NOT NULL,
  frequency REAL      -- how common this pairing is
);

-- Relationships between words
CREATE TABLE word_relations (
  word_id INTEGER REFERENCES words(id),
  related_word_id INTEGER REFERENCES words(id),
  relation_type TEXT  -- synonym, antonym, derived, hypernym, hyponym
);

-- User's vocabulary state
CREATE TABLE user_words (
  user_id INTEGER,
  word_id INTEGER REFERENCES words(id),
  status TEXT DEFAULT 'new',  -- new, learning, known
  ease_factor REAL DEFAULT 2.5,  -- for spaced repetition
  interval INTEGER DEFAULT 0,
  next_review TIMESTAMP,
  review_count INTEGER DEFAULT 0,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- People / Authors
CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT,
  vocab_profile JSON  -- cached vocabulary DNA
);

-- User's reading history
CREATE TABLE readings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  source_url TEXT,
  title TEXT,
  word_count INTEGER,
  vocabulary_dna JSON,
  unknown_words JSON,  -- words from this text not yet learned
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Design Principles

1. **Dark by default** — reading/vocabulary tools should be easy on eyes
2. **Keyboard-first** — all actions have keyboard shortcuts
3. **Progressive disclosure** — show word → definition first, full metadata on click
4. **Offline-capable** — core quiz/flashcard works without internet
5. **Fast** — < 100ms for any interaction, no loading spinners
6. **Beautiful** — not functional, but delightful

---

## Monetization (if needed)

| Tier | Price | Features |
|---|---|---|
| Free | $0 | Import, quiz, flashcards, 500 words |
| Pro | $5/mo | Unlimited words, vocabulary DNA, people graph, spaced repetition |
| Team | $15/mo | Shared vocab lists, progress reports, writing assistant |

---

## Roadmap

| Phase | Timeline | Deliverables |
|---|---|---|
| **V1: Foundation** | 4 weeks | Word database, import, quiz, flashcards, progress |
| **V1.1: Polish** | 2 weeks | Spaced repetition, audio quiz, collocations |
| **V2: Intelligence** | 4 weeks | Vocabulary DNA, people graph, topic clusters |
| **V2.1: APIs** | 2 weeks | Datamuse integration, auto-enrichment |
| **V3: Ecosystem** | 6 weeks | Browser extension, writing assistant, cloud sync |
| **Launch** | Week 16 | Public beta |

---

## Open Questions

1. **Cambridge export reliability** — the scraping approach failed repeatedly. Should we rely entirely on manual CSV import, or find another data source?
2. **Spaced repetition algorithm** — use SM-2 (Anki's) or a modern variant (FSRS)?
3. **Corpus source** — where do we get frequency data for "vocabulary DNA"? COCA requires a license.
4. **Privacy** — vocabulary DNA of public figures is fine, but what about user data?
5. **Mobile** — native app or PWA?

---

## Success Metrics

| Metric | Target (6 months) |
|---|---|
| Words imported by users | 50,000+ |
| Quiz completions/day | 1,000+ |
| DAU | 500+ |
| Avg session length | 8 minutes |
| Words learned/week | 15+ per active user |

---

*Created: 2026-06-28*
*Author: Paranjay + Claude*
*Status: Draft — ready for review*
