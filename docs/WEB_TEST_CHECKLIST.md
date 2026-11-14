# Synosis Web-First Test Checklist

Target: **NEAR Testnet only**, Vite static web app on Vercel, followed by Chrome extension port after acceptance.

## Vercel import

1. Open https://vercel.com/new using an account with permission to create projects.
2. Import GitHub repository `mushee-io/synosis` into the Vercel team that owns the project.
3. Select **Vite**, root directory `./`, build command `npm run build`, output directory `dist`.
4. Deploy, confirm the build is READY, and open the generated HTTPS URL.
5. Confirm the web page identifies itself as **NEAR Testnet / Web Beta**.
6. Do not add private key, seed phrase, or password environment variables.

## Browser acceptance tests

- [ ] New wallet displays exactly 12 unique-positioned recovery words with their order.
- [ ] Wallet creation requires a 10+ character local password and explicit recovery-backup acknowledgement.
- [ ] Browser receives a 64-character implicit testnet account address (fund it from a testnet faucet/existing testnet account).
- [ ] Page reload requires unlocking the encrypted saved key.
- [ ] Wrong password does not unlock; offline phrase recovery imports the same address.
- [ ] Watch-only account opens without storing a secret and cannot send.
- [ ] Import an existing funded testnet account with a full-access key; signed 0.001 testnet NEAR transfer produces a successful explorer receipt.
- [ ] Import a **restricted** challenge phrase for the vault; NEAR permissions show FunctionCall and the web app refuses native transfer.
- [ ] Independent client runs `scripts/probe-restricted.mjs` and records actual failure of a native transfer.
- [ ] Independent external owner runs `scripts/owner-withdraw.mjs` and records successful vault withdrawal receipt.
- [ ] Confirm no mainnet RPC calls or server requests contain mnemonics/private keys.
- [ ] Verify browser console has no unexpected errors; do not treat errors as proof of security.

## Known limitations

- Prototype is not security-audited. Browser-side key storage is encrypted in localStorage, not a hardware wallet.
- Generating keys does not immediately activate the implicit account. On-chain activation/funding must be verified.
- The withdrawal challenge proves **restricted-key permissions**, not protection of leaked full-access keys.
- The earlier Chrome extension source is preserved but is **not** the current shipping target.
- Do not use production funds or production seed phrases in the hosted test.

## Gate for Chrome extension

Port only after the Vercel build is READY and the wallet and challenge acceptance tests above are evidenced with logs, explorer links, and manual QA notes.
