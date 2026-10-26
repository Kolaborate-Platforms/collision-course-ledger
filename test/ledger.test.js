import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLedger } from '../src/ledger/ledger.js';

const clock = () => new Date('2026-01-15T10:00:00.000Z');

test('posts a balanced entry and derives balances', () => {
  const ledger = createLedger(clock);
  ledger.post({
    kind: 'test',
    memo: 'move 100',
    lines: [
      { account: 'a', debit: 100 },
      { account: 'b', credit: 100 },
    ],
  });
  assert.equal(ledger.balance('a'), -100);
  assert.equal(ledger.balance('b'), 100);
  assert.equal(ledger.balance('nobody'), 0);
});

test('refuses an unbalanced entry', () => {
  const ledger = createLedger(clock);
  assert.throws(
    () => ledger.post({ kind: 'test', memo: 'bad', lines: [{ account: 'a', debit: 100 }, { account: 'b', credit: 90 }] }),
    /unbalanced/,
  );
  assert.equal(ledger.balance('a'), 0);
});

test('entries get increasing sequence numbers and a timestamp', () => {
  const ledger = createLedger(clock);
  const first = ledger.post({ kind: 'k', memo: 'one', lines: [{ account: 'a', debit: 1 }, { account: 'b', credit: 1 }] });
  const second = ledger.post({ kind: 'k', memo: 'two', lines: [{ account: 'a', debit: 1 }, { account: 'b', credit: 1 }] });
  assert.equal(first.seq, 1);
  assert.equal(second.seq, 2);
  assert.equal(first.at, '2026-01-15T10:00:00.000Z');
});

test('statement shows the net amount for one account', () => {
  const ledger = createLedger(clock);
  ledger.post({
    kind: 'send',
    memo: 'with fee',
    lines: [
      { account: 'a', debit: 105 },
      { account: 'b', credit: 100 },
      { account: 'fees', credit: 5 },
    ],
  });
  const entries = ledger.statementFor('a');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, -105);
  assert.equal(ledger.statementFor('b')[0].amount, 100);
  assert.equal(ledger.statementFor('nobody').length, 0);
});
