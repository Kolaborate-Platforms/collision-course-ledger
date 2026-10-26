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

test('unknown route is a JSON 404', async () => {
  const result = await app.call('GET', '/nothing-here');
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, 'NOT_FOUND');
});

test('right path with the wrong method is a 404', async () => {
  const result = await app.call('POST', '/health', {});
  assert.equal(result.status, 404);
});

test('malformed JSON is a 400', async () => {
  const result = await app.callRaw('POST', '/transfers', '{not json');
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_JSON');
});

test('a body that is not an object is a 400', async () => {
  const result = await app.call('POST', '/transfers', [1, 2, 3]);
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'INVALID_BODY');
});
