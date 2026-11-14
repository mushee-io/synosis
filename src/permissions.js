export function isFullAccess(permission) {
  return permission === 'FullAccess' ||
    (typeof permission === 'object' && permission !== null && Object.hasOwn(permission, 'GasKeyFullAccess'));
}

export function describePermission(permission) {
  if (isFullAccess(permission)) return 'Full access · transfers permitted';
  const restricted = permission?.FunctionCall || permission?.GasKeyFunctionCall;
  if (restricted) {
    const methods = restricted.method_names?.join(', ') || 'any method';
    return 'Restricted to ' + restricted.receiver_id + ' / ' + methods + '. Native transfers forbidden.';
  }
  return 'Unknown permission · transfers disabled';
}

export function formatYocto(raw) {
  const n = BigInt(raw);
  const base = 10n ** 24n;
  const whole = n / base;
  const fraction = (n % base).toString().padStart(24, '0').slice(0, 6).replace(/0+$/, '');
  return whole.toString() + (fraction ? '.' + fraction : '');
}

export function assertTransfer(amount, receiver, permission) {
  if (!isFullAccess(permission)) {
    throw new Error('Blocked: this key is restricted on NEAR and cannot authorize native transfers.');
  }
  if (!/^(?=.{2,64}$)[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/.test(receiver) && !/^[0-9a-f]{64}$/.test(receiver)) {
    throw new Error('Enter a valid NEAR testnet recipient account ID.');
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(amount) || !/[1-9]/.test(amount)) {
    throw new Error('Enter a positive NEAR amount (at most 24 decimal places).');
  }
}
