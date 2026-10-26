import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fakeClock, startApp } from '../test/helpers.js';

const clock = fakeClock('2026-03-02T08:30:00.000Z');
let app;
before(async () => {
  app = await startApp({ clock });
});
after(async () => {
  await app.close();
});

test('a transfer response carries an id', async () => {
  await app.open('sender', 500_000);
  await app.open('receiver', 0);
  const result = await app.call('POST', '/transfers', { from: 'sender', to: 'receiver', amount: 20_000 });
  assert.equal(result.status, 201);
  assert.match(result.body.id, /^tr_\d+$/);
});

test('every transfer gets its own id', async () => {
  await app.open('sender-2', 500_000);
  await app.open('receiver-2', 0);
  const ids = new Set();
  for (let count = 0; count < 5; count += 1) {
    const result = await app.call('POST', '/transfers', { from: 'sender-2', to: 'receiver-2', amount: 20_000 });
    ids.add(result.body.id);
  }
  assert.equal(ids.size, 5);
});

test('a transfer can be read back by id', async () => {
  await app.open('sender-3', 500_000);
  await app.open('receiver-3', 0);
  const sent = await app.call('POST', '/transfers', { from: 'sender-3', to: 'receiver-3', amount: 20_000 });
  const found = await app.call('GET', `/transfers/${sent.body.id}`);
  assert.equal(found.status, 200);
  assert.deepEqual(found.body, {
    id: sent.body.id,
    from: 'sender-3',
    to: 'receiver-3',
    amount: 20_000,
    fee: 500,
    status: 'completed',
    at: '2026-03-02T08:30:00.000Z',
  });
});

test('an unknown id is a 404', async () => {
  const result = await app.call('GET', '/transfers/tr_999999');
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'TRANSFER_NOT_FOUND');
});

test('a failed transfer has no id', async () => {
  await app.open('broke', 10_000);
  await app.open('receiver-4', 0);
  const failed = await app.call('POST', '/transfers', { from: 'broke', to: 'receiver-4', amount: 10_000 });
  assert.equal(failed.status, 422);
  assert.equal(failed.body.id, undefined);
});
