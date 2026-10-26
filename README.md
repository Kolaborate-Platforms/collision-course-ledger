# Collision Course: practice repository

The codebase and practice backlog for [Collision Course: Build Your Own Agent Harness](https://academy.kolaborate.africa/hackathon/collision-course-build-your-own-agent-harness), a Kola Academy hackathon.

Running one coding agent is easy. Running three at once on the same codebase is where things break. Your job is to build the harness that stops that: the coordination code that gives each agent a task, keeps agents out of each other's way, tracks what is really finished, and stays inside a budget. This repository is the work your harness gets pointed at.

This repository holds the **practice backlog**. The live run on Thursday 29 October uses a hidden variant of the backlog, so do not tune your harness to these twelve tasks. Tune it to the kind of problem they represent.

## What is in here

A small mobile money fee and ledger API: wallets, tiered fees, a double-entry ledger and transfers between wallets. It is plain Node with no dependencies.

```
src/
  api/          HTTP server and route table
  fees/         fee schedule and fee calculation
  ledger/       double-entry journal and transfer logic
  accounts.js   account creation and lookup
  validation.js request validation
  errors.js     error types and codes
  store.js      in-memory store and clock
docs/           API notes, fee table, compliance limits
backlog/        the practice backlog
test/           regression suite (must always pass)
acceptance/     one acceptance test file per backlog task
scripts/        test runner, grader, integrity check
```

Read `docs/api.md` first. It describes what exists today.

## Quick start

You need Node 20 or newer. There is nothing to install.

```bash
npm test            # regression suite, green on a fresh checkout
npm run grade       # regression + every task's acceptance tests + integrity check
npm start           # run the API on http://localhost:3000 (set PORT to change it)
```

## The backlog

`backlog/backlog.json` has this shape:

```json
{
  "version": 1,
  "tasks": [
    { "id": "T01", "title": "Short ticket title", "body": "Full ticket text, written like a real ticket." }
  ]
}
```

- `id` is unique and names the acceptance file: task `T01` is checked by `acceptance/T01.test.js`.
- `title` and `body` are free text. The body is the whole specification. There are no other fields, so there is no dependency list and no file list. Working out what a ticket touches, and what it needs first, is part of the exercise.

Build against this format. If the organizers change anything for the live run, they will tell entrants.

As the hackathon page says, the backlog is deliberately tricky. Tasks can overlap in the files they touch, depend on each other without saying so, contradict each other, or sound finished when they are not. The grader only reports pass or fail per task. What to do about the rest is your harness's job, and how honestly it reports on it is part of your score.

## Grading yourself

`npm run grade` runs the regression suite, runs each task's acceptance file on its own, checks that the locked files are unchanged, and writes `grade-report.json`.

```
regression suite   pass (33 tests, 0 failed)
locked files       unchanged
T01                FAIL (5 tests, 3 failed)
...
```

A fresh checkout fails every task. That is the starting line.

The exit code of `npm run grade` covers only the regression suite and the locked files. It does not say whether tasks pass, so read the per-task lines or `grade-report.json`.

Do not edit `test/`, `acceptance/`, `backlog/backlog.json` or the files in `scripts/`. `npm run verify:tests` catches accidental changes by comparing them with `tests.lock.json`. It is a convenience, not a security check: the organizers compare against their own copies, and tampering with tests is grounds for disqualification (rule 9).

The organizers' hidden tests are rerun by them, not by your harness. Passing your local acceptance files is evidence, not the score.

## Rules

These are the rules from the hackathon page.

1. Solo entry only. Open to anyone.
2. Build your own harness. Agent HQ (code, binaries, MCP gateway) and prebuilt multi-agent orchestration frameworks are not allowed.
3. Allowed: model APIs and SDKs, MCP libraries, and single-agent command line tools used as workers.
4. Your repository must be open, list its dependencies, and run with one command. Judges check the dependency list against the banned list.
5. Your harness must enforce a hard budget cap during the live run. The cap is announced at kickoff.
6. Run at least 3 agents across at least 2 different tools or models.
7. Hidden tests are rerun by the organizers. Claims of "done" that fail the tests count against honesty.
8. Scoring: hidden tests 40%, collision efficiency 20%, cost against cap 15%, honesty of "done" claims 15%, process evidence 10%.
9. Disqualification for using banned tools, tampering with tests, or sharing the hidden backlog.

The budget cap is set by the organizers and announced to entrants. Make it a setting in your harness, not a constant, so you can change it for the live run.

## Submitting

Submit your repository link, the full logs from your live run, and a one-page write-up covering what your harness does, what it got wrong, and what you would fix next. Submissions close at 23:59 EAT on Thursday 29 October. Questions go to academy@kolaborate.co.

## Notes

The fees, limits and tax rates in this repository are invented for the exercise. They are not the rates of any real operator or tax authority.

Released under the MIT license.
