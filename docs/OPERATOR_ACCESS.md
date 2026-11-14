# Synosis official operator approval

The public repository is **source available**, not an authentication boundary.
NEAR itself authorizes transfers and access-key management. A copied site cannot
spend an official wallet's NEAR unless its operator obtains a valid full-access
signing key. A public fork can still create its own unrelated NEAR accounts.

## Official deployment (Vercel)

Set `SYNOSIS_REGISTRATION_TOKEN` as an **encrypted/sensitive server-side**
environment variable in the **trusted** Synosis Vercel project. Use a unique,
cryptographically random token of at least 32 bytes. Configure it for the
deployment environment(s) that should sponsor operator-approved registrations.
Redeploy the project to activate the variable. Never use a full-access NEAR
private key, recovery phrase or personal password as this token.

Without the variable (or with a short token), `/api/create-testnet-account`
**returns HTTP 503 and does not call the NEAR helper**. With a missing or
incorrect token, it returns HTTP 401. The operator supplies the token at
the name-registration prompt on the trusted deployment only; the browser
does not save it to localStorage or a wallet backup. This is a shared
operator code, not a per-user identity system. Rotate it if compromised.

The endpoint is intentionally limited to creating requested public-key-
controlled **testnet** accounts via the NEAR testnet sponsor. It has no
private owner phrase, no official vault signing key, and no power to
transfer an official wallet's funds.

## Additional operational controls

- Keep full-access owner phrases offline; consider hardware or multisig
  custody before placing valuable funds anywhere.
- Do not configure any owner phrase as a `VITE_*` variable, GitHub secret,
  client-side constant, or Vercel public environment variable.
- Never paste a wallet recovery phrase into the operator-code prompt.
- Restrict deployment administration to trusted maintainers and enable MFA.
- Confirm function-call access-key scope on NEAR RPC and perform a live
  negative transfer test before advertising the public challenge as proven.
- Keep the challenge on Testnet until threat-model review and an audit.

This is **not a license or DRM**: anyone may fork or redeploy the public code,
create independent wallets, or change their own copy's UI. The gate protects
the original Synosis registration service, not the NEAR protocol.
