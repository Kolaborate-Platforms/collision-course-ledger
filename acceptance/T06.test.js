import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { startApp } from '../test/helpers.js';

let app;
before(async () => {
  app = await startApp();
});
after(async () => {
  await app.close();
});

const keyed = (key) => ({ 'Idempotency-Key': key });

test('a repeated request with the same key moves money once', async () => {
  await app.open('idem-a', 100_000);
  await app.open('idem-b', 0);
  const key = randomUUID();
  const request = { from: 'idem-a', to: 'idem-b', amount: 20_000 };
  const first = await app.call('POST', '/transfers', request, keyed(key));
  const second = await app.call('POST', '/transfers', request, keyed(key));
  assert.equal(first.status, 201);
  assert.equal(second.status, first.status);
  assert.deepEqual(second.body, first.body);
  assert.equal(await app.balance('idem-a'), 100_000 - 20_000 - 500);
  assert.equal(await app.balance('idem-b'), 20_000);
});

test('different keys are different transfers', async () => {
  await app.open('idem-c', 100_000);
  await app.open('idem-d', 0);
  const request = { from: 'idem-c', to: 'idem-d', amount: 20_000 };
  await app.call('POST', '/transfers', request, keyed(randomUUID()));
  await app.call('POST', '/transfers', request, keyed(randomUUID()));
  assert.equal(await app.balance('idem-d'), 40_000);
});

test('reusing a key with a different body is a conflict', async () => {
  await app.open('idem-e', 100_000);
  await app.open('idem-f', 0);
  const key = randomUUID();
  await app.call('POST', '/transfers', { from: 'idem-e', to: 'idem-f', amount: 20_000 }, keyed(key));
  const clash = await app.call('POST', '/transfers', { from: 'idem-e', to: 'idem-f', amount: 30_000 }, keyed(key));
  assert.equal(clash.status, 409);
  assert.equal(clash.body.error.code, 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(await app.balance('idem-f'), 20_000);
});

test('requests without a key are never merged', async () => {
  await app.open('idem-g', 100_000);
  await app.open('idem-h', 0);
  const request = { from: 'idem-g', to: 'idem-h', amount: 20_000 };
  await app.call('POST', '/transfers', request);
  await app.call('POST', '/transfers', request);
  assert.equal(await app.balance('idem-h'), 40_000);
});

test('the fees account is credited once for a replayed request', async () => {
  await app.open('idem-i', 100_000);
  await app.open('idem-j', 0);
  const feesBefore = await app.balance('SYSTEM_FEES');
  const key = randomUUID();
  const request = { from: 'idem-i', to: 'idem-j', amount: 20_000 };
  await app.call('POST', '/transfers', request, keyed(key));
  await app.call('POST', '/transfers', request, keyed(key));
  assert.equal((await app.balance('SYSTEM_FEES')) - feesBefore, 500);
});
