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

async function transfer(from, to, amount) {
  const result = await app.call('POST', '/transfers', { from, to, amount });
  assert.equal(result.status, 201);
  return result.body;
}

test('a reversal returns the amount but keeps the fee', async () => {
  await app.open('rev-a', 100_000);
  await app.open('rev-b', 0);
  const feesBefore = await app.balance('SYSTEM_FEES');
  const sent = await transfer('rev-a', 'rev-b', 20_000);
  const reversed = await app.call('POST', `/transfers/${sent.id}/reverse`);
  assert.equal(reversed.status, 200);
  assert.deepEqual(reversed.body, { id: sent.id, status: 'reversed' });
  assert.equal(await app.balance('rev-a'), 100_000 - 500);
  assert.equal(await app.balance('rev-b'), 0);
  assert.equal((await app.balance('SYSTEM_FEES')) - feesBefore, 500);
});

test('a second reversal is a conflict and changes nothing', async () => {
  await app.open('rev-c', 100_000);
  await app.open('rev-d', 100_000);
  const sent = await transfer('rev-c', 'rev-d', 20_000);
  await app.call('POST', `/transfers/${sent.id}/reverse`);
  const again = await app.call('POST', `/transfers/${sent.id}/reverse`);
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'ALREADY_REVERSED');
  assert.equal(await app.balance('rev-c'), 100_000 - 500);
  assert.equal(await app.balance('rev-d'), 100_000);
});

test('a reversal fails when the receiver has spent the money', async () => {
  await app.open('rev-e', 100_000);
  await app.open('rev-f', 0);
  await app.open('rev-g', 0);
  const sent = await transfer('rev-e', 'rev-f', 20_000);
  await transfer('rev-f', 'rev-g', 15_000);
  const attempt = await app.call('POST', `/transfers/${sent.id}/reverse`);
  assert.equal(attempt.status, 422);
  assert.equal(attempt.body.error.code, 'INSUFFICIENT_FUNDS');
  assert.equal(await app.balance('rev-e'), 100_000 - 20_000 - 500);
  assert.equal(await app.balance('rev-f'), 20_000 - 15_000 - 500);
  assert.equal(await app.balance('rev-g'), 15_000);
});

test('an unknown transfer id is a 404', async () => {
  const result = await app.call('POST', '/transfers/tr_999999/reverse');
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'TRANSFER_NOT_FOUND');
});

test('the reversal is recorded and the books still balance', async () => {
  await app.open('rev-h', 100_000);
  await app.open('rev-i', 0);
  const sent = await transfer('rev-h', 'rev-i', 20_000);
  await app.call('POST', `/transfers/${sent.id}/reverse`);
  const statement = await app.call('GET', '/accounts/rev-h/statement');
  const entry = statement.body.entries.find((candidate) => candidate.kind === 'reversal');
  assert.ok(entry, 'statement has a reversal entry');
  assert.equal(entry.amount, 20_000);
  assert.equal(await app.totalOfAllBalances(), 0);
});
