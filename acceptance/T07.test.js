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

test('quotes for 1,000 or less are free', async () => {
  for (const amount of [1, 500, 1_000]) {
    const result = await app.call('POST', '/fees/quote', { type: 'send', amount });
    assert.equal(result.body.fee, 0, `amount ${amount}`);
  }
});

test('a transfer of 1,000 costs the sender exactly 1,000', async () => {
  await app.open('micro-a', 10_000);
  await app.open('micro-b', 0);
  const result = await app.call('POST', '/transfers', { from: 'micro-a', to: 'micro-b', amount: 1_000 });
  assert.equal(result.status, 201);
  assert.equal(result.body.fee, 0);
  assert.equal(await app.balance('micro-a'), 9_000);
  assert.equal(await app.balance('micro-b'), 1_000);
});

test('a free transfer leaves no fee line in the ledger', async () => {
  await app.open('micro-c', 10_000);
  await app.open('micro-d', 0);
  const before = await app.call('GET', '/accounts/SYSTEM_FEES/statement');
  await app.call('POST', '/transfers', { from: 'micro-c', to: 'micro-d', amount: 800 });
  const after = await app.call('GET', '/accounts/SYSTEM_FEES/statement');
  assert.equal(after.body.entries.length, before.body.entries.length);
});

test('a micro-transfer can use the whole balance', async () => {
  await app.open('micro-e', 1_000);
  await app.open('micro-f', 0);
  const result = await app.call('POST', '/transfers', { from: 'micro-e', to: 'micro-f', amount: 1_000 });
  assert.equal(result.status, 201);
  assert.equal(await app.balance('micro-e'), 0);
});

test('sends above 1,000 still pay a fee', async () => {
  const quote = await app.call('POST', '/fees/quote', { type: 'send', amount: 1_001 });
  assert.ok(quote.body.fee > 0);
  await app.open('micro-g', 10_000);
  await app.open('micro-h', 0);
  const result = await app.call('POST', '/transfers', { from: 'micro-g', to: 'micro-h', amount: 1_001 });
  assert.equal(result.body.fee, quote.body.fee);
});

test('larger fees are untouched', async () => {
  const quote = await app.call('POST', '/fees/quote', { type: 'send', amount: 20_000 });
  assert.equal(quote.body.fee, 500);
});
