import test from 'node:test';
import assert from 'node:assert/strict';
import { isFullAccess, describePermission, formatYocto, assertTransfer, assertOwnerKeyPermission, isExactChallengePermission } from '../src/permissions.js';

const restricted = {
  FunctionCall: {
    receiver_id: 'vault.testnet',
    method_names: ['ping'],
    allowance: '50000000000000000000000'
  }
};

test('FullAccess grants transfer permission', () => {
  assert.equal(isFullAccess('FullAccess'), true);
  assert.equal(isFullAccess(restricted), false);
  assert.match(describePermission('FullAccess'), /transfers permitted/);
});

test('Restricted key is not able to initiate transfers', () => {
  assert.match(describePermission(restricted), /Native transfers forbidden/);
  assert.throws(
    () => assertTransfer('0.01', 'receiver.testnet', restricted),
    /Blocked: this key is restricted/
  );
});

test('Unknown permission cannot authorize transfers', () => {
  assert.equal(isFullAccess({ BadPermission: {} }), false);
  assert.throws(() => assertTransfer('1', 'receiver.testnet', {}), /Blocked/);
});

test('Full access key may transfer only positive well-formed amounts', () => {
  assert.doesNotThrow(() => assertTransfer('0.0001', 'receiver.testnet', 'FullAccess'));
  for (const invalid of ['0', '0.0', '-1', '1e9', '1.0000000000000000000000001', 'NaN', '1.']) {
    assert.throws(() => assertTransfer(invalid, 'receiver.testnet', 'FullAccess'));
  }
});

test('Balances are formatted without floating point precision loss', () => {
  assert.equal(formatYocto('1000000000000000000000000'), '1');
  assert.equal(formatYocto('1234567890000000000000000'), '1.234567');
  assert.equal(formatYocto('0'), '0');
  assert.equal(formatYocto('123'), '0');
});

test('only verified full-access permission may authorize administrative wallet actions', () => {
  assert.doesNotThrow(() => assertOwnerKeyPermission('FullAccess'));
  assert.throws(() => assertOwnerKeyPermission(restricted), /only a verified full-access owner key/);
  assert.throws(() => assertOwnerKeyPermission(null), /Blocked by NEAR permissions/);
  assert.throws(() => assertOwnerKeyPermission({ FullAccess: {} }), /Blocked by NEAR permissions/);
});

test('public challenge verification requires exact named-account ping scope', () => {
  assert.equal(isExactChallengePermission(restricted, 'vault.testnet'), true);
  assert.equal(isExactChallengePermission(restricted, 'other.testnet'), false);
  assert.equal(isExactChallengePermission('FullAccess', 'vault.testnet'), false);
  assert.equal(isExactChallengePermission({
    FunctionCall: { receiver_id: 'vault.testnet', method_names: ['ping', 'withdraw'] }
  }, 'vault.testnet'), false);
  assert.equal(isExactChallengePermission({
    FunctionCall: { receiver_id: 'vault.testnet', method_names: [] }
  }, 'vault.testnet'), false);
});
