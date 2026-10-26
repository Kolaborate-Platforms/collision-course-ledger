import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startApp } from '../test/helpers.js';

const SENDS = 24;
let app;
before(async () => {
  app = await startApp();
  await app.open('page-a', 10_000_000);
  await app.open('page-b', 0);
  for (let count = 0; count < SENDS; count += 1) {
    const result = await app.call('POST', '/transfers', { from: 'page-a', to: 'page-b', amount: 10_000 });
    assert.equal(result.status, 201);
  }
});
after(async () => {
  await app.close();
});

const statement = (query = '') => app.call('GET', `/accounts/page-a/statement${query}`);

test('the default page is the 20 newest entries, newest first', async () => {
  const result = await statement();
  assert.equal(result.status, 200);
  const { entries } = result.body;
  assert.equal(entries.length, 20);
  for (let index = 1; index < entries.length; index += 1) {
    assert.ok(entries[index - 1].seq > entries[index].seq);
  }
  assert.equal(entries[0].kind, 'send');
});

test('nextBefore walks back through the history', async () => {
  const first = await statement();
  assert.equal(first.body.nextBefore, first.body.entries.at(-1).seq);
  const second = await statement(`?before=${first.body.nextBefore}`);
  assert.equal(second.body.entries.length, SENDS + 1 - 20);
  assert.ok(second.body.entries.every((entry) => entry.seq < first.body.nextBefore));
  assert.equal(second.body.entries.at(-1).kind, 'opening');
  assert.equal(second.body.nextBefore, null);
});

test('limit sets the page size', async () => {
  const result = await statement('?limit=5');
  assert.equal(result.body.entries.length, 5);
  assert.equal(result.body.nextBefore, result.body.entries.at(-1).seq);
});

test('a page that ends exactly at the oldest entry has no nextBefore', async () => {
  const result = await statement(`?limit=${SENDS + 1}`);
  assert.equal(result.body.entries.length, SENDS + 1);
  assert.equal(result.body.nextBefore, null);
});

test('limit accepts 100 and rejects anything outside 1 to 100', async () => {
  assert.equal((await statement('?limit=100')).status, 200);
  for (const limit of ['0', '101', '-3', 'abc', '2.5', '']) {
    const result = await statement(`?limit=${limit}`);
    assert.equal(result.status, 400, `limit "${limit}"`);
    assert.equal(result.body.error.code, 'INVALID_QUERY');
  }
});

test('before must be a positive whole number', async () => {
  for (const value of ['0', '-1', 'x', '1.5', '']) {
    const result = await statement(`?before=${value}`);
    assert.equal(result.status, 400, `before "${value}"`);
    assert.equal(result.body.error.code, 'INVALID_QUERY');
  }
  const none = await statement('?before=1');
  assert.equal(none.status, 200);
  assert.deepEqual(none.body.entries, []);
  assert.equal(none.body.nextBefore, null);
});

test('the entry shape is unchanged', async () => {
  const result = await statement('?limit=1');
  assert.deepEqual(Object.keys(result.body.entries[0]).sort(), ['amount', 'at', 'kind', 'memo', 'seq']);
});

test('an unknown account is still a 404', async () => {
  const result = await app.call('GET', '/accounts/nobody-here/statement');
  assert.equal(result.status, 404);
});
