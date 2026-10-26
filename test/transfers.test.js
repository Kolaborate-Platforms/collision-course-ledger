import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startApp } from './helpers.js';

let app;
before(async () => {
  app = await startApp();
});
after(async () => {
  await app.close();
});

test('a transfer moves the amount and charges the sender the fee', async () => {
  await app.open('alice', 100_000);
  await app.open('bob', 0);
  const result = await app.call('POST', '/transfers', { from: 'alice', to: 'bob', amount: 20_000 });
  assert.equal(result.status, 201);
  assert.equal(result.body.fee, 500);
  assert.equal(result.body.from.id, 'alice');
  assert.equal(result.body.from.balance, 79_500);
  assert.equal(result.body.to.balance, 20_000);
  assert.equal(await app.balance('alice'), 79_500);
  assert.equal(await app.balance('bob'), 20_000);
});

test('the fee lands in the fees account', async () => {
  const feesBefore = await app.balance('SYSTEM_FEES');
  await app.open('carol', 200_000);
  await app.open('dave', 0);
  await app.call('POST', '/transfers', { from: 'carol', to: 'dave', amount: 100_000 });
  const feesAfter = await app.balance('SYSTEM_FEES');
  assert.equal(feesAfter - feesBefore, 1_000);
});

test('every balance in the store sums to zero', async () => {
  await app.open('erin', 500_000);
  await app.open('frank', 10_000);
  await app.call('POST', '/transfers', { from: 'erin', to: 'frank', amount: 200_000 });
  await app.call('POST', '/transfers', { from: 'frank', to: 'erin', amount: 20_000 });
  assert.equal(await app.totalOfAllBalances(), 0);
});

test('insufficient funds changes nothing', async () => {
  await app.open('gina', 10_000);
  await app.open('hugo', 0);
  const result = await app.call('POST', '/transfers', { from: 'gina', to: 'hugo', amount: 10_000 });
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, 'INSUFFICIENT_FUNDS');
  assert.equal(await app.balance('gina'), 10_000);
  assert.equal(await app.balance('hugo'), 0);
});

test('the amount plus fee may use the whole balance', async () => {
  await app.open('ivan', 20_500);
  await app.open('jade', 0);
  const result = await app.call('POST', '/transfers', { from: 'ivan', to: 'jade', amount: 20_000 });
  assert.equal(result.status, 201);
  assert.equal(await app.balance('ivan'), 0);
});

test('a wallet cannot send to itself', async () => {
  await app.open('kofi', 100_000);
  const result = await app.call('POST', '/transfers', { from: 'kofi', to: 'kofi', amount: 20_000 });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'SELF_TRANSFER');
});

test('unknown accounts are a 404', async () => {
  await app.open('lena', 100_000);
  const unknownTo = await app.call('POST', '/transfers', { from: 'lena', to: 'nobody-here', amount: 20_000 });
  assert.equal(unknownTo.status, 404);
  assert.equal(unknownTo.body.error.code, 'ACCOUNT_NOT_FOUND');
  const unknownFrom = await app.call('POST', '/transfers', { from: 'nobody-here', to: 'lena', amount: 20_000 });
  assert.equal(unknownFrom.status, 404);
});

test('bad transfer input is a 400', async () => {
  await app.open('mona', 100_000);
  await app.open('nate', 0);
  for (const amount of [0, -20_000, 1.5, '20000', undefined, 5_000_001]) {
    const result = await app.call('POST', '/transfers', { from: 'mona', to: 'nate', amount });
    assert.equal(result.status, 400, `amount ${amount}`);
    assert.equal(result.body.error.code, 'INVALID_AMOUNT');
  }
  const noSender = await app.call('POST', '/transfers', { to: 'nate', amount: 20_000 });
  assert.equal(noSender.status, 400);
});

test('statement lists what happened to the account', async () => {
  await app.open('olga', 100_000);
  await app.open('pete', 0);
  await app.call('POST', '/transfers', { from: 'olga', to: 'pete', amount: 20_000 });
  const result = await app.call('GET', '/accounts/olga/statement');
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.entries));
  const send = result.body.entries.find((entry) => entry.kind === 'send');
  assert.equal(send.amount, -20_500);
  const opening = result.body.entries.find((entry) => entry.kind === 'opening');
  assert.equal(opening.amount, 100_000);
});

test('statement of an unknown account is a 404', async () => {
  const result = await app.call('GET', '/accounts/ghost-account/statement');
  assert.equal(result.status, 404);
});
