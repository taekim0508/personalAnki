# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal web app for practicing interview answers out loud with spaced repetition. You record a spoken answer to a card within a time limit. It's transcribed, graded against the card's bullet checklist, and the result sets the FSRS schedule. The full MVP spec and its decisions are in `docs/plans/interview-srs-mvp.md`. Read it before making product or architecture changes.

**Status:** planning is complete and no code exists yet. Update the Commands section once the app is scaffolded.

## Hard constraints

- **Latency:** under 10s from stopping the recording to seeing the graded result (95th percentile). The grader call alone should stay under 2s.
- **Cost:** $10/month is the absolute maximum for all API spending combined (grading, transcription, AI bullet drafting, timed-out calls). It's enforced in code by the cost ledger, checked before every paid call, so the total never goes over $10. At $9.50, grading and AI drafting turn off, and transcription keeps running until $10. At $10, every paid call stops. Skip and self-rate always work.
- **Single user:** Supabase Auth with sign-ups disabled. Don't add multi-user features.
- **Not stored:** audio, transcripts, per-bullet grading results. Show them, then discard them. Only cards, FSRS state, the review log (card, date, rating, suggestedRating, time used, coverage %, selfRated, sameDayRetry), the daily cost ledger (dollars per day, split by transcription, grading and AI drafting) and one settings row are stored. The Dashboard page is worked out from these. Don't add new stored data for it.

## Stack

- Next.js (App Router), TypeScript, Tailwind, hosted on Vercel
- Supabase (Postgres + Auth), with Drizzle for database access
- `ts-fsrs` for scheduling
- Groq Whisper large-v3-turbo for speech-to-text
- Claude Haiku 5.5 (`claude-haiku-5-5`) through `@anthropic-ai/sdk` for grading

## Grading architecture

The pipeline runs in one request: browser MediaRecorder (compressed Opus/AAC, uploaded once with no chunking), then Groq transcription, then the grader LLM, then deterministic code.

- **The LLM only marks each bullet** `hit`, `partial` or `missed`, returning `evidence` (a quote from the transcript) before `status`, and a short `reason`. Output is schema-enforced through `output_config.format`.
- **Code does the rest:** coverage, the core-bullet cap (any missed core bullet means the rating can't be better than Hard), the over-target penalty (one level lower when over 110% of the target, applied after the cap, so the two stack), the rating thresholds, the delivery metrics (words per minute, filler words, thinking time), and the quote check. Keep these deterministic and out of the prompt.
- **Static system prompt:** keep it byte-stable so it can be cached. Per-card content goes only in the user message.
- **Haiku 5.5 rejects `temperature`.** Don't add it. Consistency comes from the structure above.
- A 3s grader timeout with 1 retry, then fallback to self-rating. The transcript is still shown when grading falls back.
- **Scheduling:** the maximum gap is a setting (`maxGapDays`, default 14). `ts-fsrs` runs with `enable_short_term: false`, `request_retention: 0.95`, `maximum_interval: maxGapDays` and `enable_fuzz: false`. Code then caps gaps per rating at half, 80% and the full maximum gap for Hard, Good and Easy, which is 7, 11 and 14 days at the default. Days are kept balanced by four mechanisms, specified in the plan's Scheduling section: new cards start only when the next 3 days have room, overflow rolls forward most at risk first, a load balancer picks the least busy nearby day, and Push to tomorrow. Every rating schedules at least 1 day out. "Add to today" pulls any card into today's queue as a real FSRS review. It's outside the daily limit and limited only by the cost cap. A card rated Again is also offered for unlimited optional retries at the end of today's session, while the daily limit has room and spending is under $9.50. A retry is graded and logged with `sameDayRetry`, but doesn't change the FSRS schedule. Retries are left out of success-rate stats, and each card's retry count is shown.

## Grader eval

`npm run eval` (to be built) runs the grader against owner-labeled recordings with frozen transcripts and reports consistency, accuracy against the owner's labels, latency and cost. The targets are in the plan. **Re-run it after any change to the grader prompt, calibration examples, schema, model or thinking setting**, and don't ship a regression. Eval recordings live on the owner's machine and are git-ignored. Never commit them.
