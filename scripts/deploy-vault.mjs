import { readFile } from 'node:fs/promises';
import { Account, JsonRpcProvider, actions, teraToGas } from 'near-api-js';

const RPC = 'https://rpc.testnet.near.org';
const accountId = process.env.CHALLENGE_ACCOUNT_ID?.trim();
const key = process.env.CHALLENGE_ACCOUNT_PRIVATE_KEY?.trim();
const ownerId = process.env.VAULT_OWNER_ACCOUNT_ID?.trim();

function requireTestnet(id) {
  if (!/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.testnet$/.test(id || '')) {
    throw new Error('Expected an account ending in .testnet.');
  }
}
requireTestnet(accountId);
requireTestnet(ownerId);
if (accountId === ownerId) throw new Error('Owner must be a different NEAR Testnet account.');
if (!key?.startsWith('ed25519:')) throw new Error('Set CHALLENGE_ACCOUNT_PRIVATE_KEY in your local environment (NEVER COMMIT IT).');

const provider = new JsonRpcProvider({ url: RPC });
// Refuse to overwrite any existing contract or vault state.
const response = await fetch(RPC, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 'synosis-preflight', method: 'query',
    params: { request_type: 'view_account', account_id: accountId, finality: 'final' }
  })
});
if (!response.ok) throw new Error('Testnet RPC unavailable; cannot safely deploy.');
const preflight = await response.json();
if (preflight.error || !preflight.result?.code_hash) {
  throw new Error('Could not inspect current account code; refusing deployment.');
}
if (preflight.result.code_hash !== '11111111111111111111111111111111') {
  throw new Error('This account already has deployed code. Refusing to overwrite it.');
}
const wasmPath = process.env.VAULT_WASM_PATH || 'contracts/vault/target/wasm32-unknown-unknown/release/synosis_guard_vault.wasm';
const code = new Uint8Array(await readFile(wasmPath));
if (!code.length) throw new Error('Vault WASM file is empty.');
const account = new Account(accountId, provider, key);

const result = await account.signAndSendTransaction({
  receiverId: accountId,
  actions: [
    actions.deployContract(code),
    actions.functionCall('new', { owner_id: ownerId }, teraToGas('30'), 0n)
  ],
  waitUntil: 'FINAL'
});
console.log('Vault deployed and initialized on NEAR Testnet.');
console.log('Contract/account:', accountId);
console.log('External owner:', ownerId);
console.log('Transaction:', result.transaction?.hash || JSON.stringify(result.status));
