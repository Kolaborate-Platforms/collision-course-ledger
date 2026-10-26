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

test('a cash-out pays 0.5% duty on top of amount and fee', async () => {
  await app.open('duty-a', 200_000);
  const taxBefore = await app.balance('SYSTEM_TAX');
  const result = await app.call('POST', '/cashouts', { account: 'duty-a', amount: 100_000 });
  assert.equal(result.status, 201);
  assert.equal(result.body.duty, 500);
  assert.equal(result.body.fee, 900);
  assert.equal(await app.balance('duty-a'), 200_000 - 100_000 - 900 - 500);
  assert.equal((await app.balance('SYSTEM_TAX')) - taxBefore, 500);
});

test('duty is rounded half up', async () => {
  await app.open('duty-b', 500_000);
  const taxBefore = await app.balance('SYSTEM_TAX');
  const result = await app.call('POST', '/cashouts', { account: 'duty-b', amount: 150_100 });
  assert.equal(result.body.duty, 751);
  assert.equal((await app.balance('SYSTEM_TAX')) - taxBefore, 751);
  assert.equal(await app.balance('duty-b'), 500_000 - 150_100 - result.body.fee - 751);
});

test('duty is worked out on the amount, not the fee', async () => {
  const quote = await app.call('POST', '/fees/quote', { type: 'cashout', amount: 10_000 });
  assert.equal(quote.body.fee, 300);
  assert.equal(quote.body.duty, 50);
});

test('the quote carries the duty', async () => {
  const quote = await app.call('POST', '/fees/quote', { type: 'cashout', amount: 100_000 });
  assert.equal(quote.status, 200);
  assert.equal(quote.body.fee, 900);
  assert.equal(quote.body.duty, 500);
});

test('the balance check includes the duty', async () => {
  await app.open('duty-c', 100_900);
  const taxBefore = await app.balance('SYSTEM_TAX');
  const result = await app.call('POST', '/cashouts', { account: 'duty-c', amount: 100_000 });
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, 'INSUFFICIENT_FUNDS');
  assert.equal(await app.balance('duty-c'), 100_900);
  assert.equal(await app.balance('SYSTEM_TAX'), taxBefore);
});

test('sends carry no duty', async () => {
  await app.open('duty-d', 500_000);
  await app.open('duty-e', 0);
  const taxBefore = await app.balance('SYSTEM_TAX');
  const sent = await app.call('POST', '/transfers', { from: 'duty-d', to: 'duty-e', amount: 100_000 });
  assert.equal(sent.body.duty, undefined);
  assert.equal(await app.balance('SYSTEM_TAX'), taxBefore);
});

test('the books still balance with the tax account included', async () => {
  await app.open('duty-f', 300_000);
  await app.call('POST', '/cashouts', { account: 'duty-f', amount: 200_000 });
  assert.equal(await app.totalOfAllBalances(), 0);
});
