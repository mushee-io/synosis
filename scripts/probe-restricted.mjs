import { Account, JsonRpcProvider, KeyPair, actions } from 'near-api-js';
import { parseSeedPhrase } from 'near-seed-phrase';

const RPC = 'https://rpc.testnet.near.org';
const accountId = process.env.CHALLENGE_ACCOUNT_ID?.trim();
const phrase = process.env.PUBLIC_CHALLENGE_SEED_PHRASE?.trim();
if (!/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.testnet$/.test(accountId || '')) {
  throw new Error('Set CHALLENGE_ACCOUNT_ID ending in .testnet.');
}
if (!phrase) throw new Error('Set PUBLIC_CHALLENGE_SEED_PHRASE to the published RESTRICTED mnemonic.');
const secretKey = phrase.startsWith('ed25519:') ? phrase : parseSeedPhrase(phrase).secretKey;
const publicKey = KeyPair.fromString(secretKey).getPublicKey().toString();
const provider = new JsonRpcProvider({ url: RPC });
async function rpcQuery(params) {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'synosis-proof', method: 'query', params })
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message || 'NEAR RPC error');
  return body.result;
}
const keyInfo = await rpcQuery({
  request_type: 'view_access_key', account_id: accountId, public_key: publicKey, finality: 'final'
});
const restrictions = keyInfo.permission?.FunctionCall;
if (!restrictions || restrictions.receiver_id !== accountId || !restrictions.method_names?.includes('ping')) {
  throw new Error('This is NOT the expected restricted ping key. Stop: do not attempt transfers.');
}
console.log('Verified limited key on chain:', publicKey);
console.log('Permission:', JSON.stringify(keyInfo.permission));
console.log('Trying to sign a native transfer of one yoctoNEAR to the same account...');
const actor = new Account(accountId, provider, secretKey);
try {
  const receipt = await actor.signAndSendTransaction({
    receiverId: accountId,
    actions: [actions.transfer(1n)],
    waitUntil: 'FINAL'
  });
  console.error('SECURITY FAILURE: native transfer succeeded with a restricted key.', receipt.transaction?.hash);
  process.exitCode = 1;
} catch (error) {
  console.log('Transfer attempt failed:', error.message || String(error));
  console.log('Review the error: an RPC outage is NOT a security test. Access-key permissions were verified beforehand.');
}
