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

test('tier defaults to tier1', async () => {
  const created = await app.call('POST', '/accounts', { id: 'plain', name: 'Plain' });
  assert.equal(created.status, 201);
  assert.equal(created.body.tier, 'tier1');
  const read = await app.call('GET', '/accounts/plain');
  assert.equal(read.body.tier, 'tier1');
});

test('a tier can be chosen at creation', async () => {
  for (const tier of ['tier1', 'tier2', 'tier3']) {
    const created = await app.call('POST', '/accounts', { id: `chosen-${tier}`, name: tier, tier });
    assert.equal(created.status, 201);
    assert.equal(created.body.tier, tier);
  }
});

test('an unknown tier is rejected at creation', async () => {
  for (const tier of ['gold', 'TIER2', 5, null]) {
    const result = await app.call('POST', '/accounts', { id: 'rejected', name: 'No', tier });
    assert.equal(result.status, 400, `tier ${tier}`);
    assert.equal(result.body.error.code, 'INVALID_TIER');
  }
  const read = await app.call('GET', '/accounts/rejected');
  assert.equal(read.status, 404);
});

test('PATCH changes the tier and returns the account', async () => {
  await app.open('upgrader', 25_000);
  const result = await app.call('PATCH', '/accounts/upgrader', { tier: 'tier3' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    id: 'upgrader',
    name: 'upgrader',
    currency: 'UGX',
    balance: 25_000,
    tier: 'tier3',
  });
  const read = await app.call('GET', '/accounts/upgrader');
  assert.equal(read.body.tier, 'tier3');
});

test('PATCH rejects a missing or invalid tier', async () => {
  await app.open('stays-put', 0, { tier: 'tier2' });
  for (const body of [{}, { tier: 'platinum' }, { tier: 2 }]) {
    const result = await app.call('PATCH', '/accounts/stays-put', body);
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'INVALID_TIER');
  }
  const read = await app.call('GET', '/accounts/stays-put');
  assert.equal(read.body.tier, 'tier2');
});

test('PATCH on an unknown account is a 404', async () => {
  const result = await app.call('PATCH', '/accounts/nobody-here', { tier: 'tier2' });
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'ACCOUNT_NOT_FOUND');
});
