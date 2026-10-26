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

test('small send fees are raised to 200 in quotes', async () => {
  for (const amount of [1, 500, 1_000, 2_000, 5_000]) {
    const result = await app.call('POST', '/fees/quote', { type: 'send', amount });
    assert.equal(result.body.fee, 200, `amount ${amount}`);
  }
});

test('a small transfer is charged the raised fee', async () => {
  await app.open('floor-a', 10_000);
  await app.open('floor-b', 0);
  const feesBefore = await app.balance('SYSTEM_FEES');
  const result = await app.call('POST', '/transfers', { from: 'floor-a', to: 'floor-b', amount: 500 });
  assert.equal(result.status, 201);
  assert.equal(result.body.fee, 200);
  assert.equal(await app.balance('floor-a'), 10_000 - 500 - 200);
  assert.equal((await app.balance('SYSTEM_FEES')) - feesBefore, 200);
});

test('the raised fee has to be covered by the balance', async () => {
  await app.open('floor-c', 600);
  await app.open('floor-d', 0);
  const result = await app.call('POST', '/transfers', { from: 'floor-c', to: 'floor-d', amount: 500 });
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, 'INSUFFICIENT_FUNDS');
});

test('fees of 200 or more are unchanged', async () => {
  const cases = [
    { amount: 20_000, fee: 500 },
    { amount: 100_000, fee: 1_000 },
    { amount: 1_000_000, fee: 8_000 },
  ];
  for (const { amount, fee } of cases) {
    const result = await app.call('POST', '/fees/quote', { type: 'send', amount });
    assert.equal(result.body.fee, fee, `amount ${amount}`);
  }
});
