const utf8 = new TextEncoder();
const decode = new TextDecoder();
function b64(bytes) {
  let text = '';
  bytes.forEach(b => { text += String.fromCharCode(b); });
  return btoa(text);
}
function unb64(text) {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0));
}
async function derive(password, salt) {
  const material = await crypto.subtle.importKey('raw', utf8.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
export async function encryptWallet(payload, password) {
  if (password.length < 10) throw new Error('Use a password of at least 10 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8.encode(JSON.stringify(payload)));
  return { v: 1, kdf: 'PBKDF2-SHA256', salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(encrypted)) };
}
export async function decryptWallet(saved, password) {
  if (saved?.v !== 1) throw new Error('Unknown wallet storage version.');
  const key = await derive(password, unb64(saved.salt));
  try {
    const content = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(saved.iv) }, key, unb64(saved.data));
    return JSON.parse(decode.decode(content));
  } catch {
    throw new Error('Incorrect password or corrupt wallet data.');
  }
}
