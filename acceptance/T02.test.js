import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startApp } from '../test/helpers.js';

let app;
before(async () => {
  app = await startApp();
});
after(async () => {
  await app.close();
});

test('a cash-out debits the customer and credits float and fees', async () => {
  await app.open('cust-a', 100_000);
  const floatBefore = await app.balance('SYSTEM_FLOAT');
  const feesBefore = await app.balance('SYSTEM_FEES');
  const result = await app.call('POST', '/cashouts', { account: 'cust-a', amount: 20_000 });
  assert.equal(result.status, 201);
  assert.equal(result.body.fee, 900);
  assert.equal(result.body.account.id, 'cust-a');
  const debit = 100_000 - (await app.balance('cust-a'));
  assert.ok(debit >= 20_000 + 900, `customer was debited ${debit}`);
  assert.equal(result.body.account.balance, 100_000 - debit);
  assert.equal((await app.balance('SYSTEM_FLOAT')) - floatBefore, 20_000);
  assert.equal((await app.balance('SYSTEM_FEES')) - feesBefore, 900);
});

test('cash-out fee schedule', async () => {
  const cases = [
    { amount: 5_000, fee: 300 },
    { amount: 10_000, fee: 300 },
    { amount: 10_001, fee: 900 },
    { amount: 100_000, fee: 900 },
    { amount: 200_000, fee: 2_400 },
    { amount: 2_000_000, fee: 20_000 },
  ];
  for (const { amount, fee } of cases) {
    const quote = await app.call('POST', '/fees/quote', { type: 'cashout', amount });
    assert.equal(quote.status, 200, `amount ${amount}`);
    assert.equal(quote.body.fee, fee, `amount ${amount}`);
  }
});

test('the charged fee matches the quote', async () => {
  await app.open('cust-b', 10_000_000);
  for (const amount of [5_000, 200_000]) {
    const quote = await app.call('POST', '/fees/quote', { type: 'cashout', amount });
    const result = await app.call('POST', '/cashouts', { account: 'cust-b', amount });
    assert.equal(result.body.fee, quote.body.fee);
  }
});

test('not enough balance changes nothing', async () => {
  await app.open('cust-c', 1_000);
  const result = await app.call('POST', '/cashouts', { account: 'cust-c', amount: 1_000 });
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, 'INSUFFICIENT_FUNDS');
  assert.equal(await app.balance('cust-c'), 1_000);
});

test('unknown account is a 404', async () => {
  const result = await app.call('POST', '/cashouts', { account: 'nobody-here', amount: 20_000 });
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'ACCOUNT_NOT_FOUND');
});

test('bad amounts are a 400', async () => {
  await app.open('cust-d', 100_000);
  for (const amount of [0, -1, 1.5, '1000', 5_000_001]) {
    const result = await app.call('POST', '/cashouts', { account: 'cust-d', amount });
    assert.equal(result.status, 400, `amount ${amount}`);
    assert.equal(result.body.error.code, 'INVALID_AMOUNT');
  }
});

test('the cash-out is recorded and the books still balance', async () => {
  await app.open('cust-e', 100_000);
  await app.call('POST', '/cashouts', { account: 'cust-e', amount: 20_000 });
  const statement = await app.call('GET', '/accounts/cust-e/statement');
  const entry = statement.body.entries.find((candidate) => candidate.kind === 'cashout');
  assert.ok(entry, 'statement has a cashout entry');
  assert.ok(entry.amount <= -20_900);
  assert.equal(await app.totalOfAllBalances(), 0);
});
