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

test('health check answers ok', async () => {
  const result = await app.call('GET', '/health');
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
});

test('creates an account with an opening balance', async () => {
  const result = await app.call('POST', '/accounts', { id: 'amina', name: 'Amina', openingBalance: 50_000 });
  assert.equal(result.status, 201);
  assert.equal(result.body.id, 'amina');
  assert.equal(result.body.name, 'Amina');
  assert.equal(result.body.currency, 'UGX');
  assert.equal(result.body.balance, 50_000);
});

test('opening balance defaults to zero', async () => {
  const result = await app.call('POST', '/accounts', { id: 'zero-wallet', name: 'Zero' });
  assert.equal(result.status, 201);
  assert.equal(result.body.balance, 0);
});

test('reads an account back', async () => {
  await app.open('reader', 12_000);
  const result = await app.call('GET', '/accounts/reader');
  assert.equal(result.status, 200);
  assert.equal(result.body.id, 'reader');
  assert.equal(result.body.balance, 12_000);
});

test('rejects a duplicate account id', async () => {
  await app.open('dupe', 0);
  const result = await app.call('POST', '/accounts', { id: 'dupe', name: 'Again' });
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'ACCOUNT_EXISTS');
});

test('rejects bad account input', async () => {
  const badId = await app.call('POST', '/accounts', { id: 'x', name: 'Short id' });
  assert.equal(badId.status, 400);
  const noName = await app.call('POST', '/accounts', { id: 'no-name' });
  assert.equal(noName.status, 400);
  const badBalance = await app.call('POST', '/accounts', { id: 'bad-balance', name: 'B', openingBalance: -5 });
  assert.equal(badBalance.status, 400);
  const fractional = await app.call('POST', '/accounts', { id: 'fractional', name: 'F', openingBalance: 10.5 });
  assert.equal(fractional.status, 400);
});

test('unknown account is a 404', async () => {
  const result = await app.call('GET', '/accounts/ghost-account');
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'ACCOUNT_NOT_FOUND');
});

test('system accounts exist from the start', async () => {
  const fees = await app.call('GET', '/accounts/SYSTEM_FEES');
  const float = await app.call('GET', '/accounts/SYSTEM_FLOAT');
  assert.equal(fees.status, 200);
  assert.equal(float.status, 200);
});
