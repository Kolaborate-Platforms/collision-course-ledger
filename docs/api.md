# API as it stands today

All bodies are JSON. Money is a whole number of UGX. Errors look like `{ "error": { "code": "...", "message": "..." } }`.

| Method and path                  | What it does                                                          |
| -------------------------------- | --------------------------------------------------------------------- |
| `GET /health`                    | Answers `{ "ok": true }`.                                             |
| `POST /accounts`                 | Creates a wallet from `{ id, name, openingBalance? }`. Answers 201.   |
| `GET /accounts/:id`              | Returns `{ id, name, currency, balance }`.                            |
| `GET /accounts/:id/statement`    | Returns `{ entries }`, oldest first. Each entry is `{ seq, kind, memo, at, amount }`, where `amount` is the net change for that account. |
| `POST /fees/quote`               | Takes `{ type, amount }` and returns `{ type, amount, fee }`.         |
| `POST /transfers`                | Sends `{ from, to, amount }`. The sender pays the fee on top. Answers 201 with `{ fee, from: { id, balance }, to: { id, balance } }`. |

`POST /transfers` honours an `Idempotency-Key` header: a repeat of the same request with the same key returns the first response and moves no money.

`SYSTEM_FEES` and `SYSTEM_FLOAT` are real accounts. They can be read with `GET /accounts/:id` and `GET /accounts/:id/statement` like any wallet.

## Error codes in use

| Code                 | Status | Meaning                                              |
| -------------------- | ------ | ---------------------------------------------------- |
| `INVALID_JSON`       | 400    | The body is not valid JSON.                          |
| `INVALID_BODY`       | 400    | The body is missing a field or has the wrong shape.  |
| `INVALID_AMOUNT`     | 400    | Not a positive whole number up to 5,000,000.         |
| `INVALID_TYPE`       | 400    | Unknown transaction type for a quote.                |
| `SELF_TRANSFER`      | 400    | Sender and receiver are the same account.            |
| `NOT_FOUND`          | 404    | No such route.                                       |
| `ACCOUNT_NOT_FOUND`  | 404    | No such account.                                     |
| `ACCOUNT_EXISTS`     | 409    | The account id is taken.                             |
| `INSUFFICIENT_FUNDS` | 422    | The balance cannot cover the amount plus charges.    |

## Ledger

Every movement of money is one entry in a double-entry journal. Debits equal credits in every entry. A wallet's balance is its credits minus its debits, so `SYSTEM_FLOAT` goes negative as wallets are funded, and the balances of all accounts in the store add up to zero.

The store takes a clock function, which the tests replace with a fake so that dates are predictable.
