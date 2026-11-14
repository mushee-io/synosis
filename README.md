# Synosis — NEAR Testnet Web Wallet

**Web-first testing on Vercel; Chrome extension packaging comes later.**

This repository contains a browser-based **NEAR Testnet only** wallet with:

- New wallet generation: 12-word local recovery phrase and 64-character NEAR implicit account address.
- Encrypted client-only key storage using AES-GCM and PBKDF2 (the password never leaves the browser).
- Backup confirmation before key storage; local phrase display is cleared afterward.
- Import with an existing NEAR Testnet phrase/private key, or watch an account without a signing key.
- Testnet balance, native NEAR transfers from verified full-access keys, and restricted-key inspection.
- NEAR smart-contract vault and testnet public challenge scripts (see [scripts/README.md](scripts/README.md)).
- **No mainnet support, no backend wallet custody, no server-side secret storage.**

## Web testing

```bash
npm install
npm test
npm run build
npm run preview
```

The web build is generated in `dist/` and can be deployed to Vercel as a **Vite** project (root `/`, build command `npm run build`, output `dist`).

Never upload phrases, decrypted keys, passwords, vault-owner secrets, or GitHub repository secrets to Vercel. Use **only generated testnet phrases** for experiments. The local encrypted copy is kept in browser localStorage and can be erased from the app; recovery relies on your offline phrase backup.

## Web challenge

1. Create/fund a dedicated NEAR Testnet vault account; separately create an account to act as the authorised owner.
2. Deploy and initialize the vault contract, then add a restricted function-call key permitted only to call `ping` on that vault.
3. **Publish only the restricted challenge phrase** and the account ID. Keep full-access keys private.
4. Participants can import the phrase in the web wallet; balance is visible but the key lacks native-transfer authority.
5. Run the independent negative-transaction and positive-owner-withdrawal tests, recording actual on-chain receipts.

A restricted key **cannot** authorize a transfer, but this does not prove 2FA protection against disclosure of a real full-access phrase. The demo is not a production-audited wallet and must never be promoted as such.

## Chrome extension later

The original extension proof-of-concept remains in `popup.html`, `src/main.js`, and `public/manifest.json`. It is **not the current release target**. First verify web builds, encrypted key recovery, activation, full-access sends, and the vault challenge. Then port tested web code into Manifest V3 and repeat security testing.

## Status

Source files are committed. Neither Vercel deployment readiness nor on-chain contract execution should be assumed without checking deployment status, chain transaction receipts, and test logs.
