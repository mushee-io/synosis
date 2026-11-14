import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/create-testnet-account.js';

const savedToken = process.env.SYNOSIS_REGISTRATION_TOKEN;
const savedFetch = globalThis.fetch;
const secret = 'a'.repeat(48);
const publicKey = 'ed25519:' + '1'.repeat(44);

function request(headers = {}) {
  return {
    method: 'POST',
    headers: { origin: 'https://synosis.example', host: 'synosis.example', ...headers },
    body: { newAccountId: 'new-wallet.testnet', newAccountPublicKey: publicKey }
  };
}
function response() {
  return {
    statusCode: 200,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}
test.after(() => {
  if (savedToken === undefined) delete process.env.SYNOSIS_REGISTRATION_TOKEN;
  else process.env.SYNOSIS_REGISTRATION_TOKEN = savedToken;
  globalThis.fetch = savedFetch;
});

test('official registration fails closed without operator configuration', async () => {
  delete process.env.SYNOSIS_REGISTRATION_TOKEN;
  globalThis.fetch = () => { throw new Error('Sponsor must not be called'); };
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
});

test('unauthorized clients cannot invoke the testnet sponsor', async () => {
  process.env.SYNOSIS_REGISTRATION_TOKEN = secret;
  globalThis.fetch = () => { throw new Error('Sponsor must not be called'); };
  for (const headers of [
    {},
    { 'x-synosis-operator-token': 'wrong' },
    { 'x-synosis-operator-token': 'a'.repeat(48) + 'extra' }
  ]) {
    const res = response();
    await handler(request(headers), res);
    assert.equal(res.statusCode, 401);
  }
});

test('official registration requires same origin even with a correct token', async () => {
  process.env.SYNOSIS_REGISTRATION_TOKEN = secret;
  globalThis.fetch = () => { throw new Error('Sponsor must not be called'); };
  const res = response();
  await handler(request({ origin: 'https://a-cloned-site.example', 'x-synosis-operator-token': secret }), res);
  assert.equal(res.statusCode, 403);
});

test('authorized request forwards only account name and PUBLIC key to helper', async () => {
  process.env.SYNOSIS_REGISTRATION_TOKEN = secret;
  let called = false;
  globalThis.fetch = async (url, options) => {
    called = true;
    assert.equal(url, 'https://helper.nearprotocol.com/account');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), {
      newAccountId: 'new-wallet.testnet',
      newAccountPublicKey: publicKey
    });
    assert.doesNotMatch(JSON.stringify(options), /aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/);
    return { ok: true, text: async () => 'ok' };
  };
  const res = response();
  await handler(request({ 'x-synosis-operator-token': secret }), res);
  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.submitted, true);
});
