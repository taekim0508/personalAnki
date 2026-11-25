# Glossary

Terms explained during this project, in plain language.

## Add Card page ("form")
A paper form you fill in and hand back.
A page in the app with fields (question, type, target seconds, bullets) and a Save button.
**For this app:** one way to make cards. The other is bulk JSON import.

## Compressed vs uncompressed audio
Like a RAW photo vs a JPEG: the JPEG drops detail you can't see and is far smaller.
Uncompressed (WAV) keeps every sound sample. Compressed (Opus, AAC) drops what your ear won't miss.
**For this app:** a 3-minute answer is about 400KB compressed vs about 6MB uncompressed. Small files upload fast enough to stay under the 10-second limit.

## Eval vs test
A test checks that the oven turns on. An eval is taste-testing 25 dishes and scoring them.
A test is pass/fail on exact behavior. An eval measures how well something unpredictable (the AI grader) does across a set of examples.
**For this app:** `npm test` checks the code. `npm run eval` scores the grader against your labeled recordings.

## FSRS
A study coach that decides when you should see a flashcard again.
The scheduling algorithm modern Anki uses. It picks the next review date from how well you did.
**For this app:** `ts-fsrs` runs it. Your rating (Again/Hard/Good/Easy) feeds it.

## Next.js vs React
React is the engine. Next.js is the whole car: engine plus routing plus a server.
Plain React runs only in the browser. Next.js adds server code in the same project.
**For this app:** API keys for Groq and Claude must stay on a server, so Next.js avoids building a separate backend.

## Quote check
Asking a student to point to the sentence in their essay that proves their claim.
The grader quotes your transcript as evidence for each bullet. Code checks that quote really appears in the transcript.
**For this app:** it compares the quote to your transcript, not to the bullet's wording, so paraphrasing is fine.

## Rating buttons (Again / Hard / Good / Easy)
Telling your coach how a practice rep went.
After each card you pick how well you did, and that sets when the card comes back.
**For this app:** the grader suggests a rating and you confirm or change it with one key.

## Temperature
A "creativity dial" on an AI model: low is predictable, high is varied.
A setting that controls how random the model's answers are.
**For this app:** Haiku 5.5 doesn't allow it, so grading consistency comes from the structure (per-bullet verdicts, code does the math).

## TypeScript
Spell-check for code.
JavaScript with type checking, which catches mistakes before the code runs.
**For this app:** catches cases like the grader returning `"75"` (text) where code expects `75` (a number).

## Same-day repeats ("learning steps")
A coach making you redo a drill you just flubbed, a few minutes later, before moving on.
FSRS can bring a failed card back within minutes, on the same day, before it switches to day-long gaps.
**For this app:** turned off, so even an Again card waits at least a day. You can still choose to retry Again cards at the end of today's session. Retries are graded but don't change the schedule.

## Cost cap
A prepaid phone card: when the balance runs out, calls stop, so you can't get a surprise bill.
A counter adds up the estimated cost of every paid API call and refuses any call that would push the month's total over the limit.
**For this app:** $10/month for everything combined. Grading turns off at $9.50, transcription keeps running until $10, and then all paid calls stop.
