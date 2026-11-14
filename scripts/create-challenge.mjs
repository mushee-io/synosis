import { Account, JsonRpcProvider, KeyPair, actions, nearToYocto } from 'near-api-js';
import { generateSeedPhrase } from 'near-seed-phrase';

const RPC = 'https://rpc.testnet.near.org';
const accountId = process.env.CHALLENGE_ACCOUNT_ID?.trim();
const privateKey = process.env.CHALLENGE_ACCOUNT_PRIVATE_KEY?.trim();
if (!/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.testnet$/.test(accountId || '')) {
  throw new Error('CHALLENGE_ACCOUNT_ID must end in .testnet.');
}
if (!privateKey?.startsWith('ed25519:')) {
  throw new Error('Set CHALLENGE_ACCOUNT_PRIVATE_KEY locally. NEVER publish or commit it.');
}
const provider = new JsonRpcProvider({ url: RPC });
// Require an initialized Synosis contract; do not create a misleading challenge against
// an ordinary account without the contract guard deployed.
const owner = await provider.callFunction({ contractId: accountId, method: 'get_owner', args: {} });
const ping = await provider.callFunction({ contractId: accountId, method: 'ping', args: {} });
if (owner === accountId || !owner || ping !== 'synosis-guard-active') {
  throw new Error('The vault contract is not initialized with an external owner.');
}

const { seedPhrase, secretKey } = generateSeedPhrase();
const challengeKey = KeyPair.fromString(secretKey);
const publicKey = challengeKey.getPublicKey();
const account = new Account(accountId, provider, privateKey);
const outcome = await account.signAndSendTransaction({
  receiverId: accountId,
  actions: [actions.addFunctionCallAccessKey(
    publicKey,
    accountId,
    ['ping'],
    nearToYocto('0.05')
  )],
  waitUntil: 'FINAL'
});

// Keep the full-access owner/deployer key secret! ONLY the newly generated
// limited-function-call phrase may be posted in the public challenge.
console.log('\n=== PUBLIC NEAR TESTNET CHALLENGE DETAILS ===');
console.log('Account with visible NEAR:', accountId);
console.log('Restricted seed phrase:', seedPhrase);
console.log('Public key:', publicKey.toString());
console.log('Allowed call: ping() only');
console.log('Full native transfers: DISALLOWED by access-key permissions');
console.log('Separate vault withdrawal owner:', owner);
console.log('Add-key transaction:', outcome.transaction?.hash || 'see testnet explorer');
console.log('\nNever post CHALLENGE_ACCOUNT_PRIVATE_KEY or any full-access mnemonic.');
