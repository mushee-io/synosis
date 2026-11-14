import { Account, JsonRpcProvider, KeyPair, actions, nearToYocto } from 'near-api-js';
import { generateSeedPhrase, parseSeedPhrase } from 'near-seed-phrase';
import { encryptWallet, decryptWallet } from './crypto.js';
import { assertTransfer, describePermission, formatYocto, isFullAccess } from './permissions.js';

const RPC = 'https://rpc.testnet.near.org';
const provider = new JsonRpcProvider({ url: RPC });
const STORAGE_KEY = 'synosis.near.testnet.encrypted.wallet.v1';
const NAME_KEY = 'synosis.near.testnet.public.named.account.v1';
const $ = id => document.getElementById(id);
const viewIds = ['start-view', 'create-view', 'backup-view', 'import-view', 'watch-view', 'unlock-view', 'dashboard-view'];
let session = null;
let pending = null;
let publicChallengePhrase = null;
let busy = false;

function notice(message, error = false) {
  const el = $('notice');
  el.hidden = false;
  el.classList.toggle('error', error);
  el.textContent = message;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function show(id) {
  viewIds.forEach(view => { $(view).hidden = view !== id; });
  $('notice').hidden = true;
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('button').forEach(button => { button.disabled = value; });
  if (!value) {
    $('finish-create').disabled = !$('backup-confirm').checked;
    const allowed = !!session?.secretKey && isFullAccess(session.permission) && session.active;
    $('do-send').disabled = !allowed;
  }
}

async function task(fn) {
  if (busy) return;
  setBusy(true);
  try { await fn(); }
  catch (error) {
    console.error('Synosis action failed:', error?.name || 'Error');
    notice(error?.message || 'The request failed. Check your network and try again.', true);
  } finally {
    setBusy(false);
  }
}

function on(id, fn) { $(id).addEventListener('click', () => task(fn)); }
function validateId(value) {
  const id = value.trim();
  if (/^[a-f0-9]{64}$/.test(id)) return id;
  if (/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.testnet$/.test(id) && id.length <= 64) return id;
  throw new Error('Enter a .testnet account ID or a 64-character lowercase implicit address.');
}

function normalizeSecret(input) {
  const text = input.trim();
  if (text.startsWith('ed25519:')) return text;
  const words = text.toLowerCase().replace(/\s+/g, ' ');
  if (![12, 24].includes(words.split(' ').length)) {
    throw new Error('Enter exactly 12 or 24 recovery words, or an ed25519 private key.');
  }
  return parseSeedPhrase(words).secretKey;
}

async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'synosis-web', method, params })
  });
  if (!response.ok) throw new Error('NEAR Testnet RPC failed (' + response.status + ').');
  const payload = await response.json();
  if (payload.error) {
    const error = new Error(payload.error.cause?.name || payload.error.message || 'NEAR query failed.');
    error.rpc = payload.error;
    throw error;
  }
  return payload.result;
}

function accountMissing(error) {
  const name = error?.rpc?.cause?.name || error?.rpc?.name || error?.message || '';
  return /UNKNOWN_ACCOUNT|ACCOUNT_DOES_NOT_EXIST|does not exist|UnknownAccount/i.test(name);
}

async function accountInfo(id) {
  try {
    return await rpc('query', { request_type: 'view_account', account_id: id, finality: 'final' });
  } catch (error) {
    if (accountMissing(error)) return null;
    throw error;
  }
}

async function permissionFor(id, publicKey) {
  const result = await rpc('query', {
    request_type: 'view_access_key', account_id: id,
    public_key: publicKey, finality: 'final'
  });
  if (!result?.permission) throw new Error('The imported key is not authorised on this account.');
  return result.permission;
}

async function loadDashboard() {
  if (!session) return;
  const snapshot = session;
  const account = await accountInfo(snapshot.accountId);
  if (session !== snapshot) return;
  snapshot.active = !!account;
  snapshot.permission = null;
  $('balance').textContent = account ? formatYocto(account.amount) : '0';
  $('account-address').textContent = snapshot.accountId;
  $('activation').textContent = account
    ? 'Account confirmed on NEAR Testnet.'
    : 'This account has not been activated. Fund the implicit address with testnet NEAR before using it.';
  if (!snapshot.secretKey) {
    $('key-type').textContent = 'Watch only';
    $('permission-details').textContent = 'No signing key is stored for this session.';
  } else if (!account) {
    $('key-type').textContent = 'Awaiting activation';
    $('permission-details').textContent = 'Wallet keys were created locally. An implicit account becomes active when funded from NEAR Testnet.';
  } else {
    try {
      snapshot.permission = await permissionFor(snapshot.accountId, snapshot.publicKey);
      $('key-type').textContent = isFullAccess(snapshot.permission) ? 'Full access' : 'Restricted key';
      $('permission-details').textContent = describePermission(snapshot.permission);
    } catch (error) {
      $('key-type').textContent = 'Key not authorised';
      $('permission-details').textContent = 'The key is not authorised by this account on NEAR Testnet. Sending is disabled.';
      snapshot.permission = null;
    }
  }
  $('do-send').disabled = !snapshot.secretKey || !snapshot.active || !isFullAccess(snapshot.permission);
  renderNamedPanel();
  renderChallengePanel();
}

async function enterDashboard(nextSession) {
  session = nextSession;
  show('dashboard-view');
  await loadDashboard();
}

function hexPublicKey(publicKey) {
  const data = publicKey?.data;
  if (!(data instanceof Uint8Array) || data.length !== 32) {
    throw new Error('Could not derive a 32-byte NEAR implicit account address.');
  }
  return Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeTestnetName(value) {
  const label = value.trim().toLowerCase().replace(/\.testnet$/, '');
  // Restrict to one top-level .testnet name; nested subaccounts are separate.
  if (label.length < 2 || label.length > 56 ||
      !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(label)) {
    throw new Error('Use 2–56 lowercase letters, numbers, hyphens or underscores, without spaces.');
  }
  return label + '.testnet';
}

function renderNamedPanel() {
  const hasSigningKey = !!session?.secretKey;
  let implicitId;
  if (hasSigningKey) {
    implicitId = hexPublicKey(KeyPair.fromString(session.secretKey).getPublicKey());
  }
  const canCreate = hasSigningKey &&
    (session.accountId === implicitId || isFullAccess(session.permission));
  $('name-panel').hidden = !canCreate;
  if (!canCreate) return;
  const linked = !!session.namedAccountId && (session.accountId === implicitId || isFullAccess(session.permission));
  $('linked-name-view').hidden = !linked;
  $('linked-name').textContent = session.namedAccountId || '';
  $('linked-implicit').textContent = implicitId;
  $('name-input').disabled = linked;
  $('check-name').hidden = linked;
  $('create-name').hidden = linked;
  $('switch-account').textContent = session.accountId === implicitId
    ? 'Switch to ' + (session.namedAccountId || '.testnet account')
    : 'Switch to long implicit address';
  if (linked) {
    $('name-status').textContent = session.accountId === session.namedAccountId
      ? 'Using your .testnet account. The long address is a separate account with its own balance.'
      : 'Using your implicit account. Switch to the .testnet name to view its separate balance.';
  }
}

async function restoreNamedAccount(loaded) {
  const saved = localStorage.getItem(NAME_KEY);
  const namedAccountId = loaded.accountId.endsWith('.testnet') ? loaded.accountId : null;
  const next = { ...loaded, namedAccountId, permission: null, active: false };
  if (!saved || namedAccountId) return next;
  try {
    const link = JSON.parse(saved);
    if (link.publicKey !== loaded.publicKey || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*\.testnet$/.test(link.accountId)) return next;
    const permission = await permissionFor(link.accountId, loaded.publicKey);
    if (isFullAccess(permission)) {
      next.namedAccountId = link.accountId;
      next.accountId = link.accountId;
    }
  } catch {
    // Local public metadata is not authoritative. Preserve the original account.
  }
  return next;
}

async function checkNamedAvailability() {
  if (!session?.secretKey) throw new Error('Unlock the wallet first.');
  const name = normalizeTestnetName($('name-input').value);
  const account = await accountInfo(name);
  if (!account) {
    $('name-status').textContent = name + ' appears available. Creation must still be confirmed on chain.';
  } else {
    try {
      const permission = await permissionFor(name, session.publicKey);
      $('name-status').textContent = isFullAccess(permission)
        ? name + ' already belongs to this recovery phrase. Click Create/Link to use it.'
        : name + ' is already registered but not controlled by this phrase.';
    } catch {
      $('name-status').textContent = name + ' is already taken. Try another name.';
    }
  }
}

async function createNamedAccount() {
  if (!session?.secretKey) throw new Error('Unlock the wallet first.');
  if (session.namedAccountId) throw new Error('This wallet already has a linked .testnet account.');
  const implicitId = hexPublicKey(KeyPair.fromString(session.secretKey).getPublicKey());
  // Do not create a full-access account from a public challenge/restricted phrase.
  if (session.accountId !== implicitId && !isFullAccess(session.permission)) {
    throw new Error('The current key is restricted. Create a new private wallet to register a name.');
  }
  const name = normalizeTestnetName($('name-input').value);
  const existing = await accountInfo(name);
  if (existing) {
    let permission;
    try { permission = await permissionFor(name, session.publicKey); } catch {}
    if (!isFullAccess(permission)) throw new Error('That .testnet name is already taken by another key.');
  } else {
    if (!confirm('Register ' + name + ' on NEAR Testnet using your existing PUBLIC key? This is a separate blockchain account, controlled by the same recovery phrase.')) return;
    const response = await fetch('/api/create-testnet-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newAccountId: name, newAccountPublicKey: session.publicKey })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.submitted) {
      throw new Error(data.error || 'Testnet naming service unavailable; no account has been confirmed.');
    }
  }
  let verified = false;
  for (let attempt = 0; attempt < 7; attempt++) {
    try {
      const account = await accountInfo(name);
      if (account) {
        const permission = await permissionFor(name, session.publicKey);
        if (!isFullAccess(permission)) throw new Error('The new name does not authorise this key.');
        verified = true;
        break;
      }
    } catch (error) {
      if (/does not authorise/.test(error.message)) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if (!verified) {
    $('name-status').textContent = 'Request submitted, but NEAR has not confirmed the account yet. Check the explorer and use this same name again to verify it.';
    notice('Name creation was submitted but is not yet verified on-chain; it has not been linked.', true);
    return;
  }
  // Store only the public account name and public key; the secret stays encrypted.
  localStorage.setItem(NAME_KEY, JSON.stringify({ accountId: name, publicKey: session.publicKey }));
  session.namedAccountId = name;
  session.accountId = name;
  await loadDashboard();
  notice('Created and verified ' + name + ' on NEAR Testnet! This account and your long address have separate balances but use the same backed-up recovery phrase.');
}

async function switchAccount() {
  if (!session?.secretKey || !session.namedAccountId) throw new Error('No verified named account linked.');
  const implicitId = hexPublicKey(KeyPair.fromString(session.secretKey).getPublicKey());
  session.accountId = session.accountId === implicitId ? session.namedAccountId : implicitId;
  await loadDashboard();
  notice('Switched to ' + session.accountId + '. Balance and send permissions now refer to this account.');
}

function clearPublicPhrase() {
  publicChallengePhrase = null;
  $('public-phrase').replaceChildren();
  $('public-phrase-wrap').hidden = true;
}

function renderChallengePanel() {
  const canPublish = !!session?.secretKey && !!session.namedAccountId &&
    session.accountId === session.namedAccountId &&
    session.active && isFullAccess(session.permission);
  $('challenge-panel').hidden = !canPublish;
  if (!canPublish) clearPublicPhrase();
}

function drawWords(words, element) {
  element.replaceChildren();
  words.split(/\\s+/).forEach((word, index) => {
    const cell = document.createElement('div');
    const number = document.createElement('span');
    const label = document.createElement('strong');
    number.textContent = String(index + 1).padStart(2, '0');
    label.textContent = word;
    cell.append(number, label);
    element.append(cell);
  });
}

async function generatePublicChallengePhrase() {
  if (!session?.secretKey || !session.namedAccountId ||
      session.accountId !== session.namedAccountId || !session.active ||
      !isFullAccess(session.permission)) {
    throw new Error('Unlock the named .testnet account with its PRIVATE owner phrase first.');
  }
  if (publicChallengePhrase) {
    throw new Error('You already created a restricted phrase this session. Copy it first.');
  }
  if (!confirm('Create a SECOND recovery phrase with restricted on-chain permissions? Never share your PRIVATE owner phrase.')) return;
  const target = session.namedAccountId;
  const ownerPermission = await permissionFor(target, session.publicKey);
  if (!isFullAccess(ownerPermission)) throw new Error('Owner key is not full-access on this account.');
  const restricted = generateSeedPhrase();
  const restrictedPublicKey = KeyPair.fromString(restricted.secretKey).getPublicKey();
  // A function-call key restricted to this account and this one method
  // can never authorise native transfer actions, including in another client.
  const tx = await new Account(target, provider, session.secretKey).signAndSendTransaction({
    receiverId: target,
    actions: [actions.addFunctionCallAccessKey(restrictedPublicKey, target, ['ping'], nearToYocto('0.05'))],
    waitUntil: 'FINAL'
  });
  if (tx?.status?.Failure) throw new Error('Adding the restricted access key failed on NEAR Testnet.');
  const recorded = await permissionFor(target, restrictedPublicKey.toString());
  if (isFullAccess(recorded) || !recorded?.FunctionCall ||
      recorded.FunctionCall.receiver_id !== target ||
      !recorded.FunctionCall.method_names?.includes('ping')) {
    throw new Error('Restricted-key permissions were not verified on chain. DO NOT share this phrase.');
  }
  publicChallengePhrase = restricted.seedPhrase;
  drawWords(publicChallengePhrase, $('public-phrase'));
  $('public-phrase-wrap').hidden = false;
  $('public-challenge-details').textContent = 'Account: ' + target +
    '. Public key: ' + restrictedPublicKey.toString() +
    '. This phrase only authorises a restricted function call, not native NEAR transfers. ' +
    'The named account does not need to implement ping for the transfer restriction to work. ' +
    'The private owner recovery phrase must remain secret.';
  notice('Restricted SECOND recovery phrase is now verified on NEAR Testnet. Only this displayed phrase may be shared for the challenge.');
}

async function generateNewWallet() {
  if (!window.isSecureContext || !crypto?.subtle) throw new Error('A secure HTTPS context is required to generate keys.');
  // Validate the requested named account before generating a new recovery phrase.
  normalizeTestnetName($('initial-name').value);
  const password = $('create-password').value;
  if (password.length < 10) throw new Error('Choose an unlock password of at least 10 characters.');
  const generated = generateSeedPhrase();
  if (!generated?.seedPhrase || !generated?.secretKey) throw new Error('Secure phrase generation failed.');
  const kp = KeyPair.fromString(generated.secretKey);
  const accountId = hexPublicKey(kp.getPublicKey());
  pending = { accountId, seedPhrase: generated.seedPhrase, secretKey: generated.secretKey, publicKey: kp.getPublicKey().toString(), password };
  drawWords(generated.seedPhrase, $('seed-words'));
  $('new-address').textContent = accountId;
  $('backup-confirm').checked = false;
  show('backup-view');
  $('finish-create').disabled = true;
}

async function finishCreate() {
  if (!pending || !$('backup-confirm').checked) throw new Error('Confirm that you saved your words offline.');
  const saved = await encryptWallet({
    accountId: pending.accountId, secretKey: pending.secretKey, publicKey: pending.publicKey
  }, pending.password);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  const next = { accountId: pending.accountId, secretKey: pending.secretKey, publicKey: pending.publicKey, namedAccountId: null, permission: null, active: false };
  pending = null;
  $('seed-words').replaceChildren();
  $('create-password').value = '';
  await enterDashboard(next);
  $('name-input').value = $('initial-name').value.trim();
  try {
    await createNamedAccount();
  } catch (error) {
    notice('Recovery phrase and encrypted wallet saved. ' +
      'The .testnet name is not confirmed yet: ' + (error?.message || 'Retry name creation below.'), true);
  }
}

async function importWallet() {
  const accountId = validateId($('import-id').value);
  const secretKey = normalizeSecret($('import-secret').value);
  const password = $('import-password').value;
  if (password.length < 10) throw new Error('Choose an unlock password of at least 10 characters.');
  const publicKey = KeyPair.fromString(secretKey).getPublicKey().toString();
  const account = await accountInfo(accountId);
  if (!account) throw new Error('This account is not active on NEAR Testnet yet.');
  const permission = await permissionFor(accountId, publicKey);
  const saved = await encryptWallet({ accountId, secretKey, publicKey }, password);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  $('import-secret').value = '';
  $('import-password').value = '';
  await enterDashboard({ accountId, secretKey, publicKey, namedAccountId: accountId.endsWith('.testnet') && isFullAccess(permission) ? accountId : null, permission, active: true });
  notice('Testnet key imported. Encrypted key material stays in this browser.');
}

async function watchAccount() {
  const accountId = validateId($('watch-id').value);
  const account = await accountInfo(accountId);
  if (!account) throw new Error('This account does not exist on NEAR Testnet.');
  await enterDashboard({ accountId, secretKey: null, publicKey: null, permission: null, active: true });
}

async function unlockWallet() {
  const encrypted = localStorage.getItem(STORAGE_KEY);
  if (!encrypted) throw new Error('No saved wallet exists in this browser.');
  const loaded = await decryptWallet(JSON.parse(encrypted), $('unlock-password').value);
  $('unlock-password').value = '';
  const key = KeyPair.fromString(loaded.secretKey).getPublicKey().toString();
  if (key !== loaded.publicKey) throw new Error('Stored signing key does not match the saved public key.');
  await enterDashboard(await restoreNamedAccount(loaded));
  notice('Wallet unlocked on this device.');
}

async function send() {
  if (!session?.secretKey || !session.active) throw new Error('This account cannot send yet.');
  const to = validateId($('send-to').value);
  const value = $('send-amount').value.trim();
  const permission = await permissionFor(session.accountId, session.publicKey);
  assertTransfer(value, to, permission);
  if (!confirm('Send ' + value + ' testnet NEAR to ' + to + '? This is an on-chain action.')) return;
  const result = await new Account(session.accountId, provider, session.secretKey).signAndSendTransaction({
    receiverId: to, actions: [actions.transfer(nearToYocto(value))], waitUntil: 'FINAL'
  });
  if (result?.status?.Failure) throw new Error('The testnet transaction failed. Check the network explorer.');
  $('send-amount').value = '';
  await loadDashboard();
  notice('Testnet transfer submitted. Transaction: ' + (result.transaction?.hash || 'check NEAR explorer'));
}

async function inspectChallenge() {
  if (!session?.secretKey || !session.active) {
    notice('Import and unlock an active account key to inspect its on-chain permissions.', true);
    return;
  }
  const permission = await permissionFor(session.accountId, session.publicKey);
  if (isFullAccess(permission)) {
    notice('WARNING: This key has FULL ACCESS and can withdraw funds. Never publish this recovery phrase.', true);
  } else if (permission?.FunctionCall) {
    notice('Verified on NEAR Testnet: this is a restricted function-call key and cannot authorise native NEAR transfers. Live negative-transaction testing remains separate.');
  } else {
    notice('Unsupported or unknown key permissions. No claim of withdrawal protection can be made.', true);
  }
}

function forgetWallet() {
  if (!confirm('Erase the locally encrypted wallet from this browser? Ensure your recovery phrase is safely backed up first.')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(NAME_KEY);
  session = null;
  pending = null;
  clearPublicPhrase();
  $('unlock-password').value = '';
  show('start-view');
  notice('Local encrypted wallet was erased from this browser.');
}

function lockWallet() {
  session = null;
  pending = null;
  $('import-secret').value = '';
  $('seed-words').replaceChildren();
  clearPublicPhrase();
  show(localStorage.getItem(STORAGE_KEY) ? 'unlock-view' : 'start-view');
}

on('choose-create', () => show('create-view'));
on('choose-import', () => show('import-view'));
on('choose-watch', () => show('watch-view'));
document.querySelectorAll('[data-back]').forEach(el => el.addEventListener('click', () => {
  pending = null;
  $('seed-words').replaceChildren();
  show('start-view');
}));
on('generate-seed', generateNewWallet);
$('backup-confirm').addEventListener('change', () => { $('finish-create').disabled = !$('backup-confirm').checked; });
on('finish-create', finishCreate);
on('do-import', importWallet);
on('do-watch', watchAccount);
on('do-unlock', unlockWallet);
on('do-refresh', loadDashboard);
on('do-send', send);
on('do-check', inspectChallenge);
on('check-name', checkNamedAvailability);
on('create-name', createNamedAccount);
on('switch-account', switchAccount);
on('make-public-phrase', generatePublicChallengePhrase);
on('copy-public-phrase', async () => {
  if (!publicChallengePhrase) throw new Error('No restricted public phrase available to copy.');
  await navigator.clipboard.writeText(publicChallengePhrase);
  notice('The restricted public challenge phrase was copied. Keep the owner recovery phrase PRIVATE.');
});
on('copy-named', async () => {
  if (!session?.namedAccountId) return;
  await navigator.clipboard.writeText(session.namedAccountId);
  notice('Named .testnet account copied.');
});
on('copy-implicit', async () => {
  if (!session?.secretKey) return;
  await navigator.clipboard.writeText(hexPublicKey(KeyPair.fromString(session.secretKey).getPublicKey()));
  notice('Long implicit address copied.');
});
on('do-lock', lockWallet);
on('do-forget', forgetWallet);
on('clear-locked', forgetWallet);
on('copy-account', async () => {
  if (!session) return;
  await navigator.clipboard.writeText(session.accountId);
  notice('Account ID copied to clipboard.');
});
on('copy-new-address', async () => {
  if (!pending) return;
  await navigator.clipboard.writeText(pending.accountId);
  notice('Implicit account address copied.');
});
show(localStorage.getItem(STORAGE_KEY) ? 'unlock-view' : 'start-view');
