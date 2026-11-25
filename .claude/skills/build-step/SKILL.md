---
name: build-step
description: Use before writing or changing code in this repo, including building any step of docs/plans/interview-srs-mvp.md. States what will be built, splits it into small units, and stops after each backend unit with what changed and how to test it.
---

# Build step

Goal: Tae always knows what is being built and how to test it. No large backend changes Tae hasn't seen.

## 1. Before writing code

Show this and wait for an OK:

```
## Building: <what>
At the end you'll have: <1-2 plain sentences>

Units:
1. <name> (backend|UI): <one line>. Test: <how>
2. ...

Needs from you: <keys, accounts, decisions, or "nothing">
```

- Keep it short. No file-by-file detail unless asked.
- If a unit hides a choice (a library, a version pin, a folder layout), name it in one line.

## 2. Unit size

- **Backend** (database, migrations, auth, server actions, route handlers, grading, cost counter): one unit = one behavior that can be tested on its own. Aim for around 500 changed lines at most. If it's bigger, split it.
- **UI** (pages, components, styling): units can be bigger, and several can run back to back.

## 3. After each unit

```
✅ Unit <n>: <name>
What it does: <plain language>
Changed: <files>
How to test: <command to run, or what to click and what you should see>
Checks: <typecheck / lint / tests: pass or fail, with output if failed>
```

- **Backend:** stop and wait for "next".
- **UI:** go on to the next UI unit. Stop when the UI work is done or the next unit is backend.
- Explain any new term the first time it shows up, in plain language. Check `docs/glossary.md` first.

## Prototypes

If a unit's result would be easier to judge by seeing it (a screen, or a flow like transcript to rating), ask: "Want a prototype of this first?" Launch the `prototyper` agent only after Tae says yes.

## 4. Hard stops

Always ask first, even mid-step:
- Applying a migration or anything else that touches a real database or Supabase project
- Installing a package that wasn't in the unit list
- Changing `CLAUDE.md`, the plan, or anything under "Hard constraints"

## 5. When the step is done

- Update **Status** and **Commands** in `CLAUDE.md`.
- Commit per `commit-style`, one commit per unit, only if Tae says to commit.
