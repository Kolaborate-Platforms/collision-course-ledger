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

test('a cash-in credits the wallet from float and charges nothing', async () => {
  await app.open('depositor', 10_000);
  const floatBefore = await app.balance('SYSTEM_FLOAT');
  const result = await app.call('POST', '/cashins', { account: 'depositor', amount: 50_000 });
  assert.equal(result.status, 201);
  assert.equal(result.body.fee, 0);
  assert.equal(result.body.account.id, 'depositor');
  assert.equal(result.body.account.balance, 60_000);
  assert.equal(await app.balance('depositor'), 60_000);
  assert.equal(floatBefore - (await app.balance('SYSTEM_FLOAT')), 50_000);
});

test('a cash-in leaves no fee line', async () => {
  await app.open('no-fee-line', 0);
  await app.call('POST', '/cashins', { account: 'no-fee-line', amount: 30_000 });
  const feesStatement = await app.call('GET', '/accounts/SYSTEM_FEES/statement');
  const touched = feesStatement.body.entries.filter((entry) => entry.kind === 'cashin');
  assert.equal(touched.length, 0);
});

test('quote for a cash-in is free', async () => {
  const result = await app.call('POST', '/fees/quote', { type: 'cashin', amount: 50_000 });
  assert.equal(result.status, 200);
  assert.equal(result.body.fee, 0);
});

test('unknown account is a 404', async () => {
  const result = await app.call('POST', '/cashins', { account: 'nobody-here', amount: 20_000 });
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'ACCOUNT_NOT_FOUND');
});

test('bad amounts are a 400', async () => {
  await app.open('bad-amounts', 0);
  for (const amount of [0, -5, 1.5, '100', 5_000_001]) {
    const result = await app.call('POST', '/cashins', { account: 'bad-amounts', amount });
    assert.equal(result.status, 400, `amount ${amount}`);
    assert.equal(result.body.error.code, 'INVALID_AMOUNT');
  }
});

test('the cash-in is recorded and the books still balance', async () => {
  await app.open('recorded', 0);
  await app.call('POST', '/cashins', { account: 'recorded', amount: 40_000 });
  const statement = await app.call('GET', '/accounts/recorded/statement');
  const entry = statement.body.entries.find((candidate) => candidate.kind === 'cashin');
  assert.ok(entry, 'statement has a cashin entry');
  assert.equal(entry.amount, 40_000);
  assert.equal(await app.totalOfAllBalances(), 0);
});
