import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { calculateFee } from '../src/fees/calculate.js';
import { startApp } from './helpers.js';

test('flat band fees', () => {
  assert.equal(calculateFee('send', 20_000), 500);
  assert.equal(calculateFee('send', 50_000), 500);
});

test('percentage bands when the result is a whole shilling', () => {
  assert.equal(calculateFee('send', 100_000), 1_000);
  assert.equal(calculateFee('send', 500_000), 5_000);
  assert.equal(calculateFee('send', 1_000_000), 8_000);
  assert.equal(calculateFee('send', 5_000_000), 40_000);
});

test('band boundaries', () => {
  assert.equal(calculateFee('send', 50_001), 500);
  assert.equal(calculateFee('send', 500_001), 4_000);
});

test('unknown fee type is a programming error', () => {
  assert.throws(() => calculateFee('teleport', 10_000), /no fee schedule/);
});

let app;
before(async () => {
  app = await startApp();
});
after(async () => {
  await app.close();
});

test('quote returns the fee for a send', async () => {
  const result = await app.call('POST', '/fees/quote', { type: 'send', amount: 20_000 });
  assert.equal(result.status, 200);
  assert.equal(result.body.type, 'send');
  assert.equal(result.body.amount, 20_000);
  assert.equal(result.body.fee, 500);
});

test('quote rejects an unknown type', async () => {
  const result = await app.call('POST', '/fees/quote', { type: 'teleport', amount: 20_000 });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_TYPE');
});

test('quote rejects bad amounts', async () => {
  for (const amount of [0, -1, 1.5, '100', null, 5_000_001]) {
    const result = await app.call('POST', '/fees/quote', { type: 'send', amount });
    assert.equal(result.status, 400, `amount ${amount}`);
    assert.equal(result.body.error.code, 'INVALID_AMOUNT');
  }
});
