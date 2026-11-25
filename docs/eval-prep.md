# Eval prep: what to do before the eval is built

The grader eval checks the AI grader the way you'd test a new referee: show it about 25 recorded answers where you already know the right call, and see how often it agrees with you and whether it gives the same call every time. The targets and the harness are in `docs/plans/interview-srs-mvp.md` under "Grader eval".

This page is the checklist for your part. There are four steps. Steps 1 and 2 can happen in any order; step 3 needs the cards from step 2.

| Step | What | Time |
|---|---|---|
| 1 | Get the Groq and Anthropic API keys | 15 min |
| 2 | Write the 10 eval cards (separate session) | 1 hr |
| 3 | Record about 25 answers | 1 hr |
| 4 | Label each recording | 45 min |

## 1. API keys

| Service | Where | Notes |
|---|---|---|
| Groq | console.groq.com → API Keys | Used for transcription, and for the Llama model the eval compares against. Check whether the free tier's rate limits are enough; the eval makes about 60 transcriptions once, then about 150 Llama grading calls per full run. |
| Anthropic | console.anthropic.com → API Keys | Used for grading. Load a small amount of credit ($5 is plenty for the eval: a full run is about 300 Haiku calls, roughly $0.15). Under Limits, set a monthly spend limit as a backup to the app's own $10 cap. |

**Where the keys go.** **Don't paste keys into a Claude chat.** Copy `.env.example` to `.env.local` and fill in `GROQ_API_KEY` and `ANTHROPIC_API_KEY`. `.env.local` is git-ignored, so it can't be committed.

## 2. Write the 10 eval cards

Do this in a separate session. These should be real cards you'll keep using, so the work isn't wasted.

**The mix:**
- 4 concept cards (a technical idea or trade-off, e.g. "SQL vs NoSQL", "How does an LRU cache work?")
- 3 behavioral cards (your own stories, STAR: Situation, Task, Action, Result)
- 3 design cards (system design described in words, e.g. "Design a URL shortener")

**Each card:**
- An `id`: short, lowercase, with dashes, e.g. `lru-cache`. Recordings and labels refer to it.
- 3–6 bullets. Each bullet carries its own explanation, not just a keyword: "Eviction: when full, drop the least recently used key, tracked with a doubly linked list plus a hash map for O(1)" rather than "eviction".
- 1–2 bullets marked `core: true`: the ones you'd fail the question without.
- `targetSeconds`: 60 for concept, 120 for behavioral, 180 for design, unless you have a reason to change it.

Save them as `eval/cards.json` in this format (the app's import format, plus `id`):

```json
[
  {
    "id": "lru-cache",
    "question": "How does an LRU cache work?",
    "type": "concept",
    "targetSeconds": 60,
    "bullets": [
      {"text": "Purpose: keep the most recently used items in a fixed-size cache and evict the least recently used one when full.", "core": true},
      {"text": "Data structures: a hash map for O(1) lookup plus a doubly linked list ordered by recency.", "core": true},
      {"text": "On access: move the item to the front of the list.", "core": false},
      {"text": "On insert when full: remove the tail of the list and its map entry.", "core": false}
    ],
    "reference": "",
    "tags": ["data-structures"]
  }
]
```

**Prompt to paste into the other session:**

> Help me write 10 interview flashcards for spoken practice, saved as `eval/cards.json` in the format in `docs/eval-prep.md`, section 2. The mix is 4 concept, 3 behavioral (my own stories, so ask me for them) and 3 design. Each card has 3–6 bullets, each bullet carrying its own explanation, and 1–2 core bullets. Ask me about my background and target roles first, and pick questions I'm likely to get.

## 3. Record about 25 answers

**Setup:**
- Use the Mac and microphone you'll practice with in the real app, in a normal quiet room. The grader should be tested on the audio it will actually get.
- Any common format works: Voice Memos (`.m4a`), `.webm`, `.mp3` or `.wav`.
- Speak naturally, the way you would in the app. Don't read from the bullets.

**What to record.** The point is a spread of quality, so record some answers badly on purpose:

| Kind | How many | How to record it |
|---|---|---|
| `strong` | 8 | Cover every bullet with its explanation, within the target time |
| `partial` | 7 | Cover about half the bullets, or give the "what" without the "why" |
| `weak` | 3 | Cover one bullet at most |
| `nocore` | 3 | A decent answer that skips a core bullet (tests the cap at Hard) |
| `keywords` | 2 | Say the bullet keywords without explaining them (should be graded partial) |
| `rambling` | 1 | Talk around the topic without hitting the bullets |
| `silence` | 1 | A few seconds of "um, I'm not sure" |
| `overtime` | 2 | A strong answer that runs at least 25% over the target |
| `terms` | 2 | Lean on technical terms Whisper may mishear (e.g. "Kafka", "idempotent", "p99", "CRDT") |

That's 29. Anything from 25 to 30 is fine. Spread them across all 10 cards, 2–4 per card, and include at least one recording for every behavioral card.

**Naming:** `<cardId>__<nn>__<kind>.<ext>`, e.g. `lru-cache__01__strong.m4a` and `lru-cache__02__keywords.m4a`. The kind is only a hint about what you meant to do; your labels in step 4 are the truth.

**Where:** put them in `eval/recordings/`. That folder is git-ignored, so the audio never reaches GitHub.

## 4. Label each recording

This is the answer key: what a fair grader **should** say about each answer.

- **Listen back** to each recording before labeling it. Label what you actually said, not what you meant to say.
- For each bullet, mark one of:
  - `hit`: the explanation was conveyed, not just the keyword. Paraphrasing is fine.
  - `partial`: covered incompletely, for example "what" without "why".
  - `missed`: not there.
- Give the rating **you** would give the answer: `again`, `hard`, `good` or `easy`. The eval checks the grader's suggested rating against this.
- For about 5 of the recordings, also count your filler words ("um", "uh", "like", "you know"). That checks whether transcription keeps them.

Save the labels as `eval/labels.json`, with the bullets in the same order as in `cards.json`:

```json
[
  {
    "file": "lru-cache__01__strong.m4a",
    "bullets": ["hit", "hit", "hit", "partial"],
    "rating": "good",
    "fillers": 4
  }
]
```

`fillers` is optional; leave it out when you didn't count. If hand-writing JSON is a pain, record first and label later: once the recordings are in place, the eval build can generate a pre-filled `labels.json` with every file and bullet listed, so you only fill in the verdicts.

## When you're done

Tell Claude the recordings, `eval/cards.json` and `eval/labels.json` are in place, and that `.env.local` has both keys. The eval build then:

1. Transcribes each recording once and freezes the transcript in `eval/transcripts/` (git-ignored), plus a second transcription to check Whisper on its own.
2. Grades each transcript 5 times with each of the three grader setups.
3. Prints the scorecard against the plan's targets, and tunes the grader until every target passes.
