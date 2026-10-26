import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fakeClock, startApp } from '../test/helpers.js';

const clock = fakeClock('2026-01-15T10:00:00.000Z');
let app;
before(async () => {
  app = await startApp({ clock });
});
after(async () => {
  await app.close();
});

const send = (from, to, amount) => app.call('POST', '/transfers', { from, to, amount });

test('tier1 may send up to 500,000 in a day and no more', async () => {
  await app.open('lim-a', 5_000_000);
  await app.open('lim-sink-a', 0);
  assert.equal((await send('lim-a', 'lim-sink-a', 300_000)).status, 201);
  assert.equal((await send('lim-a', 'lim-sink-a', 200_000)).status, 201);
  const balanceBefore = await app.balance('lim-a');
  const over = await send('lim-a', 'lim-sink-a', 10_000);
  assert.equal(over.status, 422);
  assert.equal(over.body.error.code, 'DAILY_LIMIT_EXCEEDED');
  assert.equal(await app.balance('lim-a'), balanceBefore);
});

test('a single send above the limit is rejected', async () => {
  await app.open('lim-b', 5_000_000);
  await app.open('lim-sink-b', 0);
  const result = await send('lim-b', 'lim-sink-b', 600_000);
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, 'DAILY_LIMIT_EXCEEDED');
});

test('tier2 may send up to 2,000,000 in a day', async () => {
  await app.open('lim-c', 10_000_000, { tier: 'tier2' });
  await app.open('lim-sink-c', 0);
  assert.equal((await send('lim-c', 'lim-sink-c', 1_500_000)).status, 201);
  const over = await send('lim-c', 'lim-sink-c', 600_000);
  assert.equal(over.status, 422);
  assert.equal(over.body.error.code, 'DAILY_LIMIT_EXCEEDED');
  assert.equal((await send('lim-c', 'lim-sink-c', 500_000)).status, 201);
});

test('tier3 may send up to 5,000,000 in a day', async () => {
  await app.open('lim-d', 20_000_000, { tier: 'tier3' });
  await app.open('lim-sink-d', 0);
  assert.equal((await send('lim-d', 'lim-sink-d', 4_000_000)).status, 201);
  assert.equal((await send('lim-d', 'lim-sink-d', 1_000_000)).status, 201);
  assert.equal((await send('lim-d', 'lim-sink-d', 1_000)).status, 422);
});

test('rejected sends do not count toward the total', async () => {
  await app.open('lim-e', 5_000_000);
  await app.open('lim-sink-e', 0);
  assert.equal((await send('lim-e', 'lim-sink-e', 400_000)).status, 201);
  assert.equal((await send('lim-e', 'lim-sink-e', 200_000)).status, 422);
  assert.equal((await send('lim-e', 'lim-sink-e', 100_000)).status, 201);
});

test('the limit is per sender', async () => {
  await app.open('lim-f', 5_000_000);
  await app.open('lim-g', 5_000_000);
  await app.open('lim-sink-f', 0);
  assert.equal((await send('lim-f', 'lim-sink-f', 500_000)).status, 201);
  assert.equal((await send('lim-g', 'lim-sink-f', 500_000)).status, 201);
});

test('the total resets the next UTC day', async () => {
  await app.open('lim-h', 5_000_000);
  await app.open('lim-sink-h', 0);
  assert.equal((await send('lim-h', 'lim-sink-h', 500_000)).status, 201);
  assert.equal((await send('lim-h', 'lim-sink-h', 1_000)).status, 422);
  clock.advanceDays(1);
  assert.equal((await send('lim-h', 'lim-sink-h', 100_000)).status, 201);
});

test('the day rolls over at midnight UTC', async () => {
  const lateClock = fakeClock('2026-06-30T23:59:00.000Z');
  const lateApp = await startApp({ clock: lateClock });
  try {
    await lateApp.open('late-a', 5_000_000);
    await lateApp.open('late-sink', 0);
    const request = { from: 'late-a', to: 'late-sink', amount: 500_000 };
    assert.equal((await lateApp.call('POST', '/transfers', request)).status, 201);
    assert.equal((await lateApp.call('POST', '/transfers', request)).status, 422);
    lateClock.advanceMinutes(2);
    assert.equal((await lateApp.call('POST', '/transfers', request)).status, 201);
  } finally {
    await lateApp.close();
  }
});
