# Synosis challenge — NEAR Testnet only

The vault contract must be built and deployed **before** creating the public challenge key.

## Requirements

- Node.js version supported by the pinned `near-api-js` version, npm, Rust, `wasm32-unknown-unknown`.
- A dedicated `vault-name.testnet` challenge account with a full-access deploy key.
- A separate `owner-name.testnet` account, whose full-access key is **never shared**.
- A small amount of testnet NEAR for deployment and the challenge.

## Compile the contract

```sh
rustup target add wasm32-unknown-unknown
cargo build --manifest-path contracts/vault/Cargo.toml --target wasm32-unknown-unknown --release
cargo test --manifest-path contracts/vault/Cargo.toml
```

If the WASM compiler requires a NEAR-specific toolchain, use the official `cargo-near` build flow and set `VAULT_WASM_PATH` to that output.

## Configure locally — secrets never go into GitHub

```sh
export CHALLENGE_ACCOUNT_ID="vault-name.testnet"
export CHALLENGE_ACCOUNT_PRIVATE_KEY="ed25519:<private full-access key for vault-name.testnet>"
export VAULT_OWNER_ACCOUNT_ID="owner-name.testnet"
```

These are commands to run in a secure terminal, not secrets to paste into a public issue or chat.

## Deploy, create a key, prove the restriction

```sh
npm install
node scripts/deploy-vault.mjs
node scripts/create-challenge.mjs
```

Store the **restricted** seed phrase printed by the setup script. Publish only that restricted phrase plus `CHALLENGE_ACCOUNT_ID` in the challenge page or extension.

```sh
export PUBLIC_CHALLENGE_SEED_PHRASE="<restricted words printed by setup>"
node scripts/probe-restricted.mjs
```

The challenge key is only authorised to invoke the vault's `ping` method. It cannot submit native transfer actions. The contract's `withdraw` method can only be called by the separately configured owner account. A participant with a genuine **full-access** key to the vault account could still transfer or replace the contract, so **never share it or describe this as protection against a leaked full-access key**.

No deployment or live testnet proof is implied by the source code being present.
