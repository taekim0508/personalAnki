# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A personal web app for practicing interview answers out loud with spaced repetition. You record a spoken answer to a card within a time limit. It's transcribed, graded against the card's bullet checklist, and the result sets the FSRS schedule. The full MVP spec and its decisions are in `docs/plans/interview-srs-mvp.md`. Read it before making product or architecture changes.

**Status:** planning is complete and no code exists yet. Update the Commands section once the app is scaffolded.

## Hard constraints

- **Latency:** under 5s from stopping the recording to seeing the graded result (95th percentile). The grader call alone should stay under 2s.
- **Cost:** a $5/month hard cap, enforced in code by a cost counter. At the cap, grading turns off and skip and self-rate still work.
- **Single user:** Supabase Auth with sign-ups disabled. Don't add multi-user features.
- **Not stored:** audio, transcripts, per-bullet grading results. Show them, then discard them. Only cards, FSRS state, the review log (date, rating, time used, coverage %, selfRated) and the cost counter are stored.

## Stack

- Next.js (App Router), TypeScript, Tailwind, hosted on Vercel
- Supabase (Postgres + Auth), with Drizzle for database access
- `ts-fsrs` for scheduling
- Groq Whisper large-v3-turbo for speech-to-text
- Claude Haiku 5.5 (`claude-haiku-5-5`) through `@anthropic-ai/sdk` for grading

## Grading architecture

The pipeline runs in one request: browser MediaRecorder (compressed Opus/AAC, uploaded once with no chunking), then Groq transcription, then the grader LLM, then deterministic code.

- **The LLM only marks each bullet** `hit`, `partial` or `missed`, returning `evidence` (a quote from the transcript) before `status`, and a short `reason`. Output is schema-enforced through `output_config.format`.
- **Code does the rest:** coverage, the core-bullet cap (any missed core bullet caps the rating at Hard), the over-target penalty, the rating thresholds, the delivery metrics (words per minute, filler words, thinking time), and the quote check. Keep these deterministic and out of the prompt.
- **Static system prompt:** keep it byte-stable so it can be cached. Per-card content goes only in the user message.
- **Haiku 5.5 rejects `temperature`.** Don't add it. Consistency comes from the structure above.
- A 3s grader timeout with 1 retry, then fallback to self-rating.

## Grader eval

`npm run eval` (to be built) runs the grader against owner-labeled recordings with frozen transcripts and reports consistency, accuracy against the owner's labels, latency and cost. The targets are in the plan. **Re-run it after any change to the grader prompt, calibration examples, schema, model or thinking setting**, and don't ship a regression. Eval recordings live on the owner's machine and are git-ignored. Never commit them.
