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

test('quote rounds a half up', async () => {
  const result = await app.call('POST', '/fees/quote', { type: 'send', amount: 150_050 });
  assert.equal(result.body.fee, 1_501);
});

test('quote keeps a fraction below a half down', async () => {
  const result = await app.call('POST', '/fees/quote', { type: 'send', amount: 150_049 });
  assert.equal(result.body.fee, 1_500);
});

test('the transfer charges the rounded fee', async () => {
  await app.open('payer', 1_000_000);
  await app.open('payee', 0);
  const feesBefore = await app.balance('SYSTEM_FEES');
  const sent = await app.call('POST', '/transfers', { from: 'payer', to: 'payee', amount: 150_050 });
  assert.equal(sent.body.fee, 1_501);
  assert.equal(await app.balance('payer'), 1_000_000 - 150_050 - 1_501);
  assert.equal((await app.balance('SYSTEM_FEES')) - feesBefore, 1_501);
});

test('quote and transfer agree for a spread of amounts', async () => {
  await app.open('receiver', 0);
  for (const amount of [20_000, 99_950, 150_150, 345_650, 499_950]) {
    const sender = `spender-${amount}`;
    await app.open(sender, 1_000_000);
    const quote = await app.call('POST', '/fees/quote', { type: 'send', amount });
    const sent = await app.call('POST', '/transfers', { from: sender, to: 'receiver', amount });
    assert.equal(sent.status, 201, `amount ${amount}`);
    assert.equal(sent.body.fee, quote.body.fee, `amount ${amount}`);
  }
});

test('quotes in the 0.8% band round too', async () => {
  const result = await app.call('POST', '/fees/quote', { type: 'send', amount: 1_234_567 });
  assert.equal(result.body.fee, 9_877);
});
