# Notes for coding agents working in this repository

This is a small mobile money fee and ledger API in plain Node (ES modules, no dependencies).

- Run the regression suite with `npm test`. It must stay green.
- Run one task's acceptance tests with `node --test acceptance/T01.test.js` (swap the id). Run `npm run grade` for everything.
- Do not edit anything under `test/` or `acceptance/`, `backlog/backlog.json` or `scripts/`. `npm run verify:tests` fails if you do, and the fix is to restore the files, never to regenerate `tests.lock.json`.
- Do not add dependencies. Node 20 or newer, standard library only.
- Money is always a whole number of UGX. Never use floating point for stored amounts.
- Every movement of money goes through `store.ledger.post` as one balanced entry.
- `docs/api.md` describes the endpoints and error codes that exist today. Follow the same response and error shapes in new code.
- Errors are created in `src/errors.js` and thrown as `AppError`. The server turns them into JSON responses.
