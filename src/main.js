import { Account, JsonRpcProvider, KeyPair, actions, nearToYocto } from 'near-api-js';
import { parseSeedPhrase } from 'near-seed-phrase';
import { assertTransfer, describePermission, formatYocto, isFullAccess } from './permissions.js';

const RPC = 'https://rpc.testnet.near.org';
const provider = new JsonRpcProvider({ url: RPC });
const $ = (id) => document.getElementById(id);
const storage = chrome.storage.local;
let session = null;
let busy = false;

function notify(message, error = false) {
  const alert = $('alert');
  alert.hidden = false;
  alert.textContent = message;
  alert.classList.toggle('error', error);
}

function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll('button')) button.disabled = value;
}

function validAccountId(value) {
  const id = value.trim();
  // The extension never connects to a mainnet RPC; additionally reject mainnet-style names.
  const implicit = /^[a-f0-9]{64}$/.test(id);
  const named = /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.testnet$/.test(id) && id.length <= 64;
  if (!implicit && !named) throw new Error('Use a NEAR Testnet account ending in .testnet, or a 64-character implicit account.');
  return id;
}

async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'synosis', method, params })
  });
  if (!response.ok) throw new Error('NEAR RPC unavailable (HTTP ' + response.status + ').');
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.cause?.name || payload.error.message || 'NEAR RPC query failed.');
  return payload.result;
}

async function fetchAccount(accountId) {
  const account = await rpc('query', { request_type: 'view_account', account_id: accountId, finality: 'final' });
  if (typeof account.amount !== 'string') throw new Error('Unexpected balance from RPC.');
  return account;
}

async function fetchPermission(accountId, publicKey) {
  const key = await rpc('query', {
    request_type: 'view_access_key',
    account_id: accountId,
    public_key: publicKey,
    finality: 'final'
  });
  if (!key.permission) throw new Error('Key is not registered on this NEAR account.');
  return key.permission;
}

async function displayWallet() {
  if (!session) return;
  const current = session;
  const account = await fetchAccount(current.accountId);
  if (session !== current) return;
  $('near-balance').textContent = formatYocto(account.amount);
  $('wallet-account').textContent = current.accountId;
  if (current.secretKey) {
    current.permission = await fetchPermission(current.accountId, current.publicKey);
  }
  const permission = current.secretKey ? current.permission : null;
  $('permission').textContent = current.secretKey
    ? (isFullAccess(permission) ? 'Full access' : 'Restricted')
    : 'Watch only';
  $('permission').classList.toggle('full', !!current.secretKey && isFullAccess(permission));
  $('permission-info').textContent = current.secretKey
    ? describePermission(permission)
    : 'Watch-only account: this extension holds no signing key.';
  $('send-button').disabled = busy || !current.secretKey || !isFullAccess(permission);
  $('send-button').textContent = current.secretKey && !isFullAccess(permission) ? 'Transfer blocked on-chain' : 'Send testnet NEAR';
}

function showPanel(name) {
  for (const id of ['onboarding', 'unlock-panel', 'wallet-panel']) $(id).hidden = id !== name;
}

function getSecret(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith('ed25519:')) return trimmed;
  if (!/^[a-z]+(?:\s+[a-z]+){11,23}$/.test(trimmed)) {
    throw new Error('Enter a 12/24-word mnemonic or an ed25519: private key.');
  }
  return parseSeedPhrase(trimmed).secretKey;
}

async function importWallet() {
  const accountId = validAccountId($('account-input').value);
  const password = $('new-password').value;
  if (password.length < 10) throw new Error('Use an unlock password with at least 10 characters.');
  const secretKey = getSecret($('seed-input').value);
  const publicKey = KeyPair.fromString(secretKey).getPublicKey().toString();
  // Reject keys that cannot sign for the chosen account before saving anything.
  const permission = await fetchPermission(accountId, publicKey);
  const { encryptWallet } = await import('./crypto.js');
  const encrypted = await encryptWallet({ accountId, secretKey, publicKey }, password);
  await storage.set({ wallet: encrypted });
  $('seed-input').value = '';
  $('new-password').value = '';
  session = { accountId, secretKey, publicKey, permission };
  showPanel('wallet-panel');
  await displayWallet();
  notify('Testnet key imported. Encrypted locally; nothing was uploaded.');
}

async function watchAccount() {
  const accountId = validAccountId($('account-input').value);
  await fetchAccount(accountId);
  session = { accountId, secretKey: null, permission: null };
  showPanel('wallet-panel');
  await displayWallet();
  notify('Watch-only session. No key has been stored.');
}

async function unlockWallet() {
  const { wallet } = await storage.get('wallet');
  if (!wallet) throw new Error('No encrypted wallet is stored.');
  const { decryptWallet } = await import('./crypto.js');
  const loaded = await decryptWallet(wallet, $('unlock-password').value);
  $('unlock-password').value = '';
  const publicKey = KeyPair.fromString(loaded.secretKey).getPublicKey().toString();
  if (publicKey !== loaded.publicKey) throw new Error('Stored key does not match wallet public key.');
  const permission = await fetchPermission(loaded.accountId, publicKey);
  session = { ...loaded, permission };
  showPanel('wallet-panel');
  await displayWallet();
}

async function sendNear() {
  if (!session?.secretKey) throw new Error('Unlock a key before sending.');
  const accountId = session.accountId;
  const permission = await fetchPermission(accountId, session.publicKey);
  const receiverId = validAccountId($('recipient').value);
  const amount = $('amount').value.trim();
  assertTransfer(amount, receiverId, permission);
  if (!confirm('Send ' + amount + ' testnet NEAR from ' + accountId + ' to ' + receiverId + '?')) return;
  // Re-verify permission immediately before signing. UI restrictions alone are not security.
  const latest = await fetchPermission(accountId, session.publicKey);
  assertTransfer(amount, receiverId, latest);
  const account = new Account(accountId, provider, session.secretKey);
  const result = await account.signAndSendTransaction({
    receiverId,
    actions: [actions.transfer(nearToYocto(amount))],
    waitUntil: 'FINAL'
  });
  const txHash = result.transaction?.hash || 'submitted';
  $('amount').value = '';
  notify('Testnet transfer finalized. Transaction: ' + txHash);
  await displayWallet();
}

async function testWithdrawal() {
  if (!session?.secretKey) throw new Error('Import a restricted key to test its permissions.');
  const permission = await fetchPermission(session.accountId, session.publicKey);
  if (isFullAccess(permission)) {
    notify('This is a FULL-ACCESS key. It CAN withdraw testnet NEAR. Do NOT publish its seed phrase.', true);
    return;
  }
  notify('On-chain verified: this key is restricted to function calls. A native NEAR transfer cannot be authorized with it.');
}

function on(id, handler) {
  $(id).addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { await handler(); }
    catch (error) { console.error(error); notify(error.message || String(error), true); }
    finally {
      setBusy(false);
      if (session) $('send-button').disabled = !session.secretKey || !isFullAccess(session.permission);
    }
  });
}

on('import-button', importWallet);
on('watch-button', watchAccount);
on('unlock-button', unlockWallet);
on('refresh-button', displayWallet);
on('send-button', sendNear);
on('challenge-button', testWithdrawal);
on('copy-button', async () => {
  if (!session) return;
  await navigator.clipboard.writeText(session.accountId);
  notify('Account ID copied.');
});
on('lock-button', async () => {
  session = null;
  const { wallet } = await storage.get('wallet');
  if (wallet) showPanel('unlock-panel');
  else showPanel('onboarding');
  notify('Wallet locked. The decrypted key is no longer in the active session.');
});
on('forget-button', async () => {
  if (!confirm('Erase the encrypted wallet from this browser? Back up your mnemonic first.')) return;
  await storage.remove('wallet');
  session = null;
  showPanel('onboarding');
  notify('Local wallet data erased.');
});

(async function start() {
  try {
    const { wallet } = await storage.get('wallet');
    if (wallet) {
      $('saved-account').textContent = 'An encrypted wallet is stored on this browser.';
      showPanel('unlock-panel');
    } else {
      showPanel('onboarding');
    }
  } catch (error) {
    notify('Chrome extension storage unavailable: ' + error.message, true);
  }
})();
