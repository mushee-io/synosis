# Synosis — NEAR Testnet Wallet & Challenge

Synosis is a Chrome Manifest V3 wallet for **NEAR Testnet only**. It can import a NEAR mnemonic/private key, show native NEAR balances and on-chain access-key permissions, and send testnet NEAR when — and only when — the imported key has full access.

The public withdrawal challenge is based on **NEAR restricted function-call access keys**. Importing a *restricted* challenge key lets anyone view the balance, but NEAR itself will reject native transfers signed by that key. This security claim **does not apply to a full-access seed phrase**; never publish the owner's full-access key. The restricted key is not a magical unwithdrawable wallet and not sufficient to demonstrate two-factor authentication against full-key compromise.

## Quick start
```bash
npm install
npm run build
```
Open `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.

## Features
- NEAR Testnet only. No mainnet fallback.
- Read balances and access-key permissions directly from the chain.
- Import a challenge mnemonic or ed25519 secret key; encrypt it with a local password (PBKDF2/AES-GCM).
- Watch any testnet account without storing a key.
- Full-access accounts can send testnet NEAR.
- Restricted keys are prevented from initiating native transfers (both in UI and by NEAR protocol).
- Challenge creation script lets the owner add a restricted function-call key; the original full-access owner key is never published.

## Challenge workflow
1. Create a **dedicated testnet account** with a full-access key you keep confidential. Fund it with only testnet tokens.
2. Run the challenge setup script (see `scripts/README.md`) to add a newly generated restricted key for a harmless contract method.
3. Publish **only** the generated restricted mnemonic and the account name.
4. Participants can import that mnemonic; on-chain permission says FunctionCall and native transfers are blocked.
5. Have an independent tester reproduce on a separate NEAR client. The owner's private key never goes into GitHub or a public website.

**Security warning:** This is a testnet-only proof of NEAR's access-key permissions, not a production audited custody product. A full-access key for the account can transfer the balance; a private-key disclosure challenge must not claim otherwise. No contract deployment or live challenge has been verified yet.
