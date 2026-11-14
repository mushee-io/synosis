// Testnet-only sponsor proxy. No seeds, passwords or private keys are accepted.
// The endpoint sends only a requested name and an ed25519 PUBLIC key to NEAR's helper.
import { timingSafeEqual } from 'node:crypto';

const HELPER = 'https://helper.nearprotocol.com/account';
const NAME = /^[a-z0-9]+(?:[-_][a-z0-9]+)*\.testnet$/;
const PUBLIC_KEY = /^ed25519:[1-9A-HJ-NP-Za-km-z]{32,60}$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required.' });
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let allowedOrigin = false;
  try {
    const origin = new URL(req.headers.origin);
    allowedOrigin = (origin.host === host && (origin.protocol === 'https:' ||
      (origin.protocol === 'http:' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))));
  } catch { /* Cross-origin or scripted requests are not trusted. */ }
  if (!allowedOrigin) return res.status(403).json({ error: 'Same-origin browser request required.' });
  // Official account sponsorship is an operator-only service. A public GitHub
  // fork or copied web UI never inherits this server-side credential.
  // Fail CLOSED until the Vercel project has a strong operator token configured.
  const configured = process.env.SYNOSIS_REGISTRATION_TOKEN || '';
  if (Buffer.byteLength(configured, 'utf8') < 32) {
    return res.status(503).json({ error: 'Official account registration is not configured. Contact a Synosis operator.' });
  }
  const supplied = req.headers['x-synosis-operator-token'];
  const expectedBytes = Buffer.from(configured, 'utf8');
  const suppliedBytes = Buffer.from(typeof supplied === 'string' ? supplied : '', 'utf8');
  if (suppliedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return res.status(401).json({ error: 'Synosis operator approval is required for official account registration.' });
  }
  const { newAccountId, newAccountPublicKey } = req.body || {};
  if (typeof newAccountId !== 'string' || newAccountId.length < 10 ||
      newAccountId.length > 64 || !NAME.test(newAccountId) ||
      typeof newAccountPublicKey !== 'string' || !PUBLIC_KEY.test(newAccountPublicKey)) {
    return res.status(400).json({ error: 'Valid .testnet account name and public key required.' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);
  try {
    const response = await fetch(HELPER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newAccountId, newAccountPublicKey }),
      signal: controller.signal,
      redirect: 'error'
    });
    const raw = await response.text();
    if (!response.ok) {
      // The sponsor can fail due to an existing name, rate limit, or service outage.
      return res.status(502).json({ error: 'NEAR testnet sponsor refused the request (HTTP ' +
        response.status + '). Check the name or try later.', detail: raw.slice(0, 300) });
    }
    return res.status(200).json({ submitted: true, helperResponse: raw.slice(0, 1000) });
  } catch (e) {
    return res.status(502).json({ error: e.name === 'AbortError'
      ? 'NEAR testnet account helper timed out.' : 'NEAR testnet account helper unavailable.' });
  } finally {
    clearTimeout(timer);
  }
}
