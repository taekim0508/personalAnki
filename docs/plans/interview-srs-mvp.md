# Interview SRS: MVP Plan

A personal web app for practicing interview answers out loud with spaced repetition. You see a question, record a spoken answer within a time limit, the answer is transcribed and graded against a bullet checklist, and the result feeds an FSRS schedule.

Why not existing tools: Anki has no spoken-answer grading. Mock interviews and voice-mode chats aren't repeatable and have no fixed criteria. This app gives the same criteria every review, with spaced repetition.

## Priorities

1. **Cost:** at most $10/month for all API spending combined, enforced with a hard cap (see Cost cap below). Target is $0.15 or less per day at 30 reviews. Expected real spend is about $0.002 per review, or about $1.80/month at 30 reviews a day.
2. **Latency:** under 10s from stopping the recording to seeing the graded result, on 95% of reviews. Real time is not required.

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

**Same-day retries of Again cards:**
- Same-day repeats are off in FSRS (`enable_short_term: false`), so every rating, including Again, schedules the card at least 1 day out.
- A card rated Again is also marked "Retry today" and offered as an optional retry after the day's queue is done.
- A retry is available only while the daily review limit has room and the cost cap hasn't been reached. It counts toward the daily review limit.
- A retry is graded and shown like any review, and logged with `sameDayRetry: true`. It **doesn't change the FSRS schedule**, so the card still comes back on the date set by the original Again.

**Adding a card to today ("Practice today"):**
- A Cards page lists every card with its next due date and an **Add to today** button.
- The card joins today's queue, even if it isn't due for two weeks.
- It doesn't count toward the 15-review daily limit, since you chose it.
- It's limited only by the cost cap. Below $9.50 it's graded as usual. From $9.50 it's transcribed and you rate yourself. At $10 you can still practice it, but nothing is uploaded.
- It's a **real review**: the rating updates FSRS, and the next due date is set from today. FSRS accounts for reviewing early, so remembering a card a few days after you last saw it doesn't push it out further than usual.

## Scheduling

The goal is to keep every answer fresh, not to space cards out for years. **By default, no card goes more than 14 days without coming back.**

### Maximum gap (a setting)

`maxGapDays` is a setting with a default of 14. Keep it at 14 while you're actively interviewing. Raise it to 30–60 between job searches, so well-known cards drift further out and the deck can hold more cards.

`ts-fsrs` settings:
- `enable_short_term: false`: no same-day repeats, so the minimum gap is 1 day.
- `request_retention: 0.95`: FSRS schedules for a 95% chance you still remember, up from the default 90%. This shortens every gap.
- `maximum_interval: maxGapDays`
- `enable_fuzz: false`: the load balancer below spreads cards out instead.

On top of that, code applies a per-rating maximum, so the buttons still mean different things once a card is well known:
- **Hard:** at most half the maximum gap
- **Good:** at most 80% of it
- **Easy:** at most the full maximum gap

Each is rounded to whole days. At the default of 14 that's **Hard ≤ 7 days, Good ≤ 11 days, Easy ≤ 14 days.** Again stays at whatever FSRS gives, which in practice is 1–2 days.

Resulting gaps, simulated with `ts-fsrs`:

| Card | Again | Hard | Good | Easy |
|---|---|---|---|---|
| Brand new | 1 day | 2 days | 3 days | 4 days |
| Well known | 1 day | 7 days | 11 days | 14 days |
| Just failed (after an Again) | 1 day | 2 days | 3 days | 4 days |

If you rate a card the same every time:
- **Good:** 3, then 6, then 11 days, and then every 11 days.
- **Easy:** 4, then 14 days, and then every 14 days.
- **Hard:** 2, 2, 3, 4, 5, 6, then 7 days.

**Workload:** with a typical gap of about 11 days and 15 reviews a day, the deck tops out at about 150–165 active cards. Beyond that, due cards pile up faster than the daily limit clears them. Raise the daily limit or the maximum gap if the deck grows past that.

### Keeping days balanced

New and just-failed cards come back after 1–4 days whatever the maximum gap is, so starting many new cards at once causes a pile-up a few days later. Four mechanisms, modeled on Anki's, keep each day's load close to the daily limit.

1. **New cards start only when there's room.**
   - Each day, up to the new-card limit (default 3) is introduced. A new card is added only if the forecast for each of the next 3 days stays at or under the daily review limit. The forecast counts cards already due plus the expected follow-ups of today's new cards.
   - If there isn't room, fewer new cards start today, possibly none. Today's page says how many were held back and why.
   - Held-back cards stay in the new pile in their original order.
2. **Overflow rolls forward, most at risk first.**
   - When more cards are due than the daily limit, today's queue takes the ones you're most likely to have forgotten first, using lowest retrievability from `ts-fsrs`.
   - The rest stay due and show up again tomorrow, ahead of cards that only become due tomorrow. They aren't rescheduled. FSRS accounts for the extra days when they're reviewed.
3. **Load balancer.**
   - After a rating, if the gap is 3 days or more, code looks at nearby days and moves the due date to the one with the fewest cards due. It looks ±1 day, or ±2 days when the gap is 7 days or more.
   - It never goes below 1 day or past `maxGapDays`. Ties keep the original date.
   - This is what stops cards studied together from all coming back on the same day.
4. **Push to tomorrow.**
   - Each card in today's queue has a **Push to tomorrow** button. It moves the card's due date to tomorrow without reviewing it.
   - It isn't an FSRS review and isn't logged, so FSRS sees a longer gap when you do review the card and schedules it accordingly.

The Dashboard's 14-day forecast shows the effect, so you can see a busy day coming before adding cards with "Add to today".

## Dashboard

Its own page in the top navigation: **Today | Cards | Dashboard**. Everything on it is worked out from the review log and the daily cost ledger, so it needs nothing else stored.

**Budget:**
- This month's spend against the $10 cap, with what's left. It's split into **transcription** (Groq), **grading** (Haiku) and **AI bullet drafting**, each with its own total.
- **Room today:** today's spend against an even daily share, which is what's left this month divided by the days left. If you skipped a day, the share grows, and the page shows roughly how many extra reviews that buys at your average cost per review.
- Average cost per review, and how many more reviews the remaining budget covers at that rate.
- A bar chart of cost per day this month, with each bar split into transcription and grading.

**Activity:**
- A GitHub-style **heatmap**: one square per day, shaded by the number of reviews. Hovering or tapping a day shows its reviews, success rate and cost (transcription and grading). It switches between a month view and a year view.
- **Streak:** the current and longest run of days with at least one review.

**Performance:**
- **Success rate:** the share of reviews rated Good or Easy, for today, this week, this month and all time. Graded and self-rated reviews are shown separately.
- How often each rating was given (Again, Hard, Good, Easy), and average coverage.
- **Cards you've gone through:** each card's review count, last rating, success rate and next due date. It can be sorted, and the weakest cards (most Again ratings) are shown first by default.

**Forecast:** cards due on each of the next 14 days, so you can see a busy day coming before you add more cards.

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
- A 3s timeout with 1 retry. If that fails, the review falls back to self-rating, and the transcript and delivery metrics are still shown. Worst case is about 7.3s before the fallback, inside the 10s budget.
- Timed-out calls count toward the cost ledger, since they're probably billed.
- Zero-shot plus calibration examples. No fine-tuning.

### Quote check (deterministic)

- **Match:** the evidence must appear in the transcript under a loose match (ignore case, punctuation and filler words, and accept about 80% of words appearing in order).
- **On failure:** the bullet drops one level (hit to partial, partial to missed).
- **Kept only if it helps:** the check stays only if the eval shows a false-downgrade rate of 2% or less and no loss in accuracy. Otherwise it becomes a flag only ("evidence unclear").

### Rating (deterministic, thresholds are config values)

Applied in this order:

1. Coverage = (hits + 0.5 × partials) / bullets
2. **Base rating from coverage:** Easy at least 90%, Good at least 75%, Hard at least 50%, Again below 50%. Easy doesn't check time. Running long is handled only by step 4, so it's punished once.
3. **Core-bullet cap (a ceiling):** if any core bullet is missed, the rating can't be better than Hard. It never raises a rating, so a 30% answer stays Again.
4. **Over-target penalty:** if time used is over 110% of `targetSeconds` (a 10% grace), the rating drops one level, down to Again at the lowest. It's applied after the cap, so the two stack.

Examples:

| Answer | Base | After cap | After penalty | Rating |
|---|---|---|---|---|
| 95%, 1:24 on a 1:00 target | Easy | Easy | Good | Good |
| 95%, 1:05 on a 1:00 target (within grace) | Easy | Easy | Easy | Easy |
| 80%, a core bullet missed | Good | Hard | Hard | Hard |
| 80%, a core bullet missed, over target | Good | Hard | Again | Again |
| 30%, a core bullet missed | Again | Again | Again | Again |

## Data

**Stored:**

- Cards
- Each card's FSRS state (`ts-fsrs`)
- A review log: date, rating, time used, coverage %, `selfRated`, `sameDayRetry`
- A daily cost ledger: one row per day per category (transcription, grading, AI drafting) with the estimated dollars. The monthly total for the cap is the sum of the month's rows. Days are counted in local time.

**Not stored:** audio, transcripts, per-bullet results. They're shown on screen and then discarded.

**Cost cap:** a running estimate based on audio seconds and token usage, covering every paid call: grading, transcription, AI bullet drafting and timed-out calls. **$10/month is the absolute maximum for everything combined.**

- Before each paid call, the code checks the counter plus that call's estimated cost. If the total would go over the limit, the call doesn't run, so spending never passes $10.
- **At $9.50:** grading and AI bullet drafting turn off. Recording still works and is still transcribed, so you see the transcript, words per minute and filler words, then rate yourself. Transcription costs about $0.001 per 90-second answer, so the $0.50 reserve covers about 500 more reviews.
- **At $10:** every paid call stops. You can still record to practice, but nothing is uploaded. Skip and self-rate still work.
- The counter resets at the start of each calendar month.

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

- You can create or import a card, record an answer, get a graded result in under 10s on 95% of reviews, confirm the rating, and have the card come back on the FSRS schedule.
- A day of 30 reviews costs $0.15 or less.
- The grader meets every eval target above.

## Risks

- **Grader consistency** is the least proven part. Mitigations are the eval, a deterministic rollup, calibration examples, and the quote check.
- **AI-written bullet quality:** bad bullets produce bad grades. The import preview is the safeguard.
- **Latency outliers** from Groq or Anthropic. Mitigation: the timeout with fallback to self-rating.
- **Mistranscribed technical terms.** Mitigation: pass the card's terms to Whisper as a prompt hint.
- **Dropped filler words:** Whisper tends to leave out "um" and "uh", which would make the filler count read near 0. Mitigation: the Whisper prompt hint also includes fillers (e.g. "Um, uh, like, you know") so they're kept, and the eval checks the filler count against the recordings.
- **Price changes:** confirm pricing at build time.

## Open questions

- The UI design pass
- Default target length per type (proposed: concept 60s, behavioral 120s, design 180s)
- The exact grader prompt wording, tuned through the eval

## Build order

1. Scaffold Next.js, the Supabase schema (cards, FSRS state, review log, daily cost ledger) and sign-in.
2. Record and label the eval set. Build the transcription and grading pipeline and `npm run eval`, and tune until every target is met.
3. Build the Add Card page with AI bullet drafting, and JSON import with the preview and the published prompt.
4. Build the review loop: daily queue, Record/Skip, feedback, rating confirmation, FSRS with the scheduling settings and the four balancing mechanisms, same-day retries of Again cards, and the Cards page with Add to today.
5. Add the cost ledger and cap, tag filtering, and the Dashboard page.
6. Do the UI design pass.
