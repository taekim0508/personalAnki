# Interview SRS: MVP Plan

A personal web app for practicing interview answers out loud with spaced repetition. You see a question, record a spoken answer within a time limit, the answer is transcribed and graded against a bullet checklist, and the result feeds an FSRS schedule.

Why not existing tools: Anki has no spoken-answer grading. Mock interviews and voice-mode chats aren't repeatable and have no fixed criteria. This app gives the same criteria every review, with spaced repetition.

## Priorities

1. **Cost:** at most $5/month, enforced with a hard cap. Target is $0.15 or less per day at 30 reviews.
2. **Latency:** under 5s from stopping the recording to seeing the graded result, on 95% of reviews. Real time is not required.

## Scope

- One user (the owner). Supabase sign-in with sign-ups disabled.
- Card types: behavioral, technical concept or trade-off, and system design described in words.
- Built from scratch. Not an Anki fork or add-on.
- Desktop Chrome and Safari only.

### Not in the MVP

- Accuracy grading beyond the bullets
- Stored audio and transcripts
- Mobile and PWA
- Multiple users
- Re-recording
- Anki `.apkg` import
- Live coding and diagram-based system design

## Cards

| Field | Notes |
|---|---|
| `question` | |
| `type` | `behavioral`, `concept` or `design` |
| `targetSeconds` | Set when the card is created. The hard cutoff is 1.5 × target. |
| `bullets[]` | `{ text, core }`. Each bullet includes its own explanation, e.g. "Chunking: split files into ~4MB blocks so only changed blocks re-upload." |
| `reference` | Optional notes or your story |
| `tags[]` | For organization and focused study. There are no decks. |

- Behavioral bullets are the STAR beats (Situation, Task, Action, Result) of your own story.
- **Creating cards:**
  - One at a time on the Add Card page, with "draft bullets with AI."
  - **Bulk JSON import from day one.** The app publishes the JSON format as a ready-made prompt to paste into an AI.
- **Import preview:** imported cards appear in a list to edit or approve before saving, with duplicate questions flagged.

Import format:

```json
[{"question": "...", "type": "design", "targetSeconds": 180,
  "bullets": [{"text": "...", "core": true}], "reference": "", "tags": []}]
```

## Review flow

1. The question appears with **Record** and **Skip** buttons, each with a hotkey. Nothing starts automatically.
2. The time before you press Record is **thinking time**, shown but not penalized.
3. Recording stops when you stop it or at the 1.5 × target cutoff. **One attempt, no re-recording.**
4. **Skip:** the bullets are revealed and you rate yourself. The review is logged as `selfRated`.
5. The bullets stay hidden until the grade comes back.
6. Feedback shows:
   - Each bullet marked hit, partial or missed, with a one-line reason.
   - The transcript.
   - Words per minute, filler-word count, thinking time, and time used against the target.
7. The suggested rating is highlighted as the default. Confirming it takes one key.

Daily limits: **3 new cards and a maximum of 15 reviews** (based on 30 minutes a day). Both are configurable.

## Grading

### The pipeline

```
browser MediaRecorder (Opus/AAC, ~400KB per 3 min) → single upload when you stop
  → Groq Whisper large-v3-turbo (transcribe)
  → Claude Haiku 5.5 (per-bullet verdicts, structured output)
  → deterministic code (coverage, cap, penalty, rating, delivery metrics)
```

There's no chunked upload, because compressed audio is already small.

### LLM responsibility (the only non-deterministic step)

The model only marks each bullet hit, partial or missed:

- **Hit:** the transcript conveys the bullet's explanation, not just its keyword.
- **Partial:** the bullet is covered incompletely, for example "what" without "why."
- **Missed:** the bullet isn't present.
- Anything said outside the bullets is not judged.
- Transcription misspellings of technical terms are tolerated.

Prompt structure:

- **System prompt (static, so it can be cached):** role, the verdict definitions, the rules above, and 3 generic calibration examples (not tied to any card).
- **User message (per review):** `<question>`, `<bullets>` with IDs, `<transcript>`.
- **Output** (schema enforced through `output_config.format`):

  ```
  { bullets: [ { id, evidence: string | null, status: "hit"|"partial"|"missed", reason: string (≤15 words) } ] }
  ```

  `evidence` (a quote from the transcript) comes **before** `status`.

Settings:

- Claude Haiku 5.5 rejects temperature, so consistency comes from this structure.
- Thinking is either off or at low effort, chosen by the eval.
- No streaming.
- A 3s timeout with 1 retry. If that fails, the review falls back to self-rating.
- Zero-shot plus calibration examples. No fine-tuning.

### Quote check (deterministic)

- **Match:** the evidence must appear in the transcript under a loose match (ignore case, punctuation and filler words, and accept about 80% of words appearing in order).
- **On failure:** the bullet drops one level (hit to partial, partial to missed).
- **Kept only if it helps:** the check stays only if the eval shows a false-downgrade rate of 2% or less and no loss in accuracy. Otherwise it becomes a flag only ("evidence unclear").

### Rating (deterministic, thresholds are config values)

- Coverage = (hits + 0.5 × partials) / bullets
- **Easy:** at least 90% and within the target length
- **Good:** at least 75%
- **Hard:** at least 50%, or any core bullet missed (the cap)
- **Again:** below 50%
- **Over the target:** one level lower

## Data

**Stored:**

- Cards
- Each card's FSRS state (`ts-fsrs`)
- A review log: date, rating, time used, coverage %, `selfRated`
- A monthly cost counter

**Not stored:** audio, transcripts, per-bullet results. They're shown on screen and then discarded.

**Cost cap:** a running estimate based on audio seconds and token usage. At $5/month, grading turns off. Skip and self-rate still work.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript + Tailwind | UI and server in one project. API keys stay on the server. TypeScript catches mistakes, including in AI-written code. |
| Hosting | Vercel | Starts instantly with no sleeping free tier (unlike Render). Next.js deploys natively. |
| DB and auth | Supabase (Postgres + Auth), Drizzle ORM | Relational data. Auth is built in. Free tier. |
| Scheduling | `ts-fsrs` | The same FSRS algorithm modern Anki uses |
| Speech-to-text | Groq Whisper large-v3-turbo | Usually under $0.001/min and about 1s for minutes of audio |
| Grader | Claude Haiku 5.5 via `@anthropic-ai/sdk` | $0.10/$0.50 per million tokens, about $0.0005 per grade |

## Grader eval (`npm run eval`)

- **Eval set:** about 25 recordings across 10 cards, mixing strong, partial and weak answers, plus edge cases:
  - Keywords without explanation (should be partial)
  - Off-topic rambling
  - Near-silence
  - Over-length answers
  - Easily mistranscribed technical terms
- **Answer key:** the owner labels every bullet hit, partial or missed.
- **Storage:** recordings are kept on the owner's machine only (git-ignored). This is the one exception to the no-audio rule.
- **Frozen transcripts:** each recording is transcribed once and the transcript is frozen, so transcription and grading errors stay separate. Transcription is tested on its own by transcribing each recording twice.
- **Repeats:** each transcript is graded 5 times. A full run costs about $0.06.
- Re-run on every prompt, model or example change. The same script compares Haiku with thinking off, Haiku at low effort, and Groq Llama.

| Metric | Target |
|---|---|
| Identical bullet verdicts across 5 runs | ≥ 95% |
| Identical suggested rating across 5 runs | ≥ 90% |
| Bullet agreement with the owner's labels | ≥ 85% |
| Rating agreement: exact / within one level | ≥ 80% / ≥ 95% |
| Core bullets labeled hit but graded missed | ~0 |
| Quote-check false downgrades | ≤ 2% |
| Grader latency at the 95th percentile | < 2s |
| Cost per grade | ≤ $0.001 |

## Definition of done

- You can create or import a card, record an answer, get a graded result in under 5s on 95% of reviews, confirm the rating, and have the card come back on the FSRS schedule.
- A day of 30 reviews costs $0.15 or less.
- The grader meets every eval target above.

## Risks

- **Grader consistency** is the least proven part. Mitigations are the eval, a deterministic rollup, calibration examples, and the quote check.
- **AI-written bullet quality:** bad bullets produce bad grades. The import preview is the safeguard.
- **Latency outliers** from Groq or Anthropic. Mitigation: the timeout with fallback to self-rating.
- **Mistranscribed technical terms.** Mitigation: pass the card's terms to Whisper as a prompt hint.
- **Price changes:** confirm pricing at build time.

## Open questions

- The UI design pass
- Default target length per type (proposed: concept 60s, behavioral 120s, design 180s)
- The exact grader prompt wording, tuned through the eval

## Build order

1. Scaffold Next.js, the Supabase schema (cards, FSRS state, review log, cost counter) and sign-in.
2. Record and label the eval set. Build the transcription and grading pipeline and `npm run eval`, and tune until every target is met.
3. Build the Add Card page with AI bullet drafting, and JSON import with the preview and the published prompt.
4. Build the review loop: daily queue, Record/Skip, feedback, rating confirmation, FSRS.
5. Add the cost counter and cap, and tag filtering.
6. Do the UI design pass.
