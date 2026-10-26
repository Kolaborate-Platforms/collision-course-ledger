import { createApp } from '../src/api/server.js';
import { createStore } from '../src/store.js';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

export function fakeClock(startIso = '2026-01-15T10:00:00.000Z') {
  let current = new Date(startIso);
  const clock = () => new Date(current);
  clock.advanceMinutes = (minutes) => {
    current = new Date(current.getTime() + minutes * MS_PER_MINUTE);
  };
  clock.advanceDays = (days) => {
    current = new Date(current.getTime() + days * MS_PER_DAY);
  };
  return clock;
}

export async function startApp({ clock } = {}) {
  const store = createStore(clock ? { clock } : undefined);
  const { server } = createApp(store);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, path, body, headers = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text === '' ? null : JSON.parse(text) };
  }

  async function callRaw(method, path, rawBody) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: rawBody,
    });
    return { status: response.status, body: await response.json() };
  }

  async function open(id, openingBalance = 0, extra = {}) {
    const result = await call('POST', '/accounts', { id, name: id, openingBalance, ...extra });
    if (result.status !== 201) {
      throw new Error(`could not open ${id}: ${result.status} ${JSON.stringify(result.body)}`);
    }
    return result.body;
  }

  async function balance(id) {
    const result = await call('GET', `/accounts/${id}`);
    return result.body.balance;
  }

  async function totalOfAllBalances() {
    let total = 0;
    for (const id of store.accounts.keys()) total += await balance(id);
    return total;
  }

  function close() {
    return new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }

  return { call, callRaw, open, balance, totalOfAllBalances, close, store };
}
