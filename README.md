# SYNOSIS
### The key is real. The authority is conditional.

**A NEAR-native experiment in programmable wallet authority.**  
**Own a key. Enter the account. See the balance. Try to move the funds. Discover what the blockchain actually permits.**

[![NEAR](https://img.shields.io/badge/NEAR-Testnet-111827?style=for-the-badge)](https://near.org/)
[![Rust](https://img.shields.io/badge/Vault-Rust%20%2B%20WASM-111827?style=for-the-badge)](contracts/vault/)
[![Linux](https://img.shields.io/badge/CI-Ubuntu%20Linux-111827?style=for-the-badge)](.github/workflows/ci.yml)
[![Status](https://img.shields.io/badge/Status-Experimental-8b5cf6?style=for-the-badge)](#proof-over-promises)

> **The experiment:** What if possessing a legitimate signing credential did *not* automatically mean possessing the authority to withdraw?
>
> Synosis explores that question with **native NEAR access-key permissions**, client-side encryption, and an optional NEAR smart-contract vault. The restriction is a protocol rule, not a disabled button.

**Try the web beta:** [synosis-indol.vercel.app](https://synosis-indol.vercel.app/) · **Source:** [mushee-io/synosis](https://github.com/mushee-io/synosis)

---

## 01 / THE IDEA — ACCESS ≠ AUTHORITY

Traditional wallet experiences often collapse identity, account visibility, and spending power into one mental model. Synosis deliberately separates them.

The interface treats wallet ownership and challenge participation as distinct security roles:

| Capability | Private owner credential | Restricted challenge credential |
|---|---|---|
| Inspect the same NEAR account and its balance | Yes | Yes |
| Sign native NEAR transfers | **Yes**, with an authorised full-access key | **No** |
| Manage account access keys | **Yes**, with full access | **No** |
| Invoke arbitrary contract functions | Subject to account/contract rules | **No** — only allowlisted calls |
| Authorise a vault withdrawal | Only if authorised by the vault's contract rules | **No** |

One **NEAR account** can carry multiple credentials with different permissions. This is not a second wallet mirroring a balance, nor a fake watch-only overlay. A published *restricted recovery phrase* derives a real signing key, but **NEAR enforces its narrower permissions**. A plain **public key**, by contrast, cannot sign transactions at all.

**The innovation is not hiding a balance. It's making authority verifiable.**

## 02 / BUILT FROM FIRST PRINCIPLES

**Local-first key generation.** Create a new 12-word recovery phrase and a 64-character implicit NEAR address in the browser. No seed-generation endpoint.

**Encrypted ownership.** Keys are encrypted client-side using AES-GCM with a password-derived key (PBKDF2). The encrypted copy is stored locally; the user must preserve an offline recovery backup.

**Human-readable accounts.** Register a `.testnet` account using its public key, then verify that the account and its full-access permission actually exist on NEAR Testnet. The named and implicit addresses are *separate on-chain accounts*, even if the same signing key controls both.

**Permission-aware signing.** Synosis checks the key's access level against NEAR Testnet before enabling native transfers, and rechecks permission when sending.

**Public challenge mode.** A second, independently generated 12-word phrase is registered as a restricted `FunctionCall` key, currently limited to a specific account and `ping` method. The restricted key can be imported by a participant, including into a compatible third-party wallet, but cannot authorise native `Transfer` actions.

**Independent vault research.** A Rust smart-contract prototype exposes `ping`, deposits, an externally authorised `withdraw`, and owner rotation. That vault is an **additional, optional contract-level experiment**, not a property automatically guaranteed for every wallet created through the web flow.

## 03 / THE WITHDRAWAL PARADOX

```text
                 NEAR TESTNET
                      |
             ONE NAMED ACCOUNT
                /          \
               /            \
   FULL-ACCESS OWNER     RESTRICTED CHALLENGE
         KEY                    KEY
          |                      |
    Native transfers       Balance visibility
    Key management         Allowlisted call(s)
          |                      |
      ALLOWED          Native transfer DENIED
                            by NEAR
```

The test is intentionally adversarial: don't trust Synosis's interface. Import the **restricted** phrase elsewhere, inspect the actual NEAR access key, and attempt a native transfer. The network — not the page — must decide the outcome.

A failed transaction by itself proves little. A vague `near_rpc_error`, an unfunded account, and a timeout are **not** proof of permission enforcement. The decisive evidence is the chain's access-key state and a rejection specifically attributable to insufficient key authority, such as `RequiresFullAccess`.

## 04 / NATIVE NEAR × LINUX DEVELOPMENT

Synosis is engineered around **NEAR's own account and access-key model**, not an EVM compatibility layer. The web wallet communicates with NEAR Testnet via `near-api-js`. The separate vault prototype is written in **Rust** for compilation to **WebAssembly** and execution on NEAR.

The project **builds and tests on Ubuntu Linux in GitHub Actions**. The user-facing wallet currently runs in the **browser**; a standalone native Linux desktop binary is **not** claimed or provided.

```bash
# Linux / macOS / compatible Node environment
# Node.js 22 recommended for parity with CI
npm install
npm test
npm run build
npm run preview
```

For the Rust vault prototype:

```bash
rustup target add wasm32-unknown-unknown
cargo test --manifest-path contracts/vault/Cargo.toml
cargo build --manifest-path contracts/vault/Cargo.toml --target wasm32-unknown-unknown --release
```

The automated pipeline runs JavaScript checks and the Vite web build on Linux, alongside Rust vault tests and a WASM build. Source files and CI definitions are reproducible; **deployment and on-chain execution still require their own receipts**.

## 05 / AN EXPERIMENT YOU CAN REPRODUCE

1. Create a fresh, **testnet-only** Synosis wallet. Back up the **private owner** phrase offline.
2. Register and verify a new `.testnet` account; fund **that exact named account** with testnet NEAR.
3. Generate the **separate restricted challenge** phrase and confirm the derived public key has `FunctionCall` permission on-chain.
4. Import only that restricted phrase in an isolated browser session or compatible external wallet.
5. Read the account balance, attempt a minimal native transfer, and capture the exact NEAR rejection reason.
6. Confirm that a genuinely authorised owner can still initiate a legitimate testnet transfer; for the optional contract vault, test its separate withdrawal-authorisation path independently.

The web UI includes a **Test blocked withdrawal on NEAR** action for a restricted key. The CLI provides an independent probe:

```bash
# Configure these in your own secure terminal only; never commit or post them.
export CHALLENGE_ACCOUNT_ID="your-vault.testnet"
export PUBLIC_CHALLENGE_SEED_PHRASE="<restricted phrase only>"
npm run challenge:probe
```

The optional vault deployment and owner-withdrawal instructions live in [scripts/README.md](scripts/README.md). Do **not** supply a full-access phrase to a public test, issue, screenshot, CI secret dump, or challenge participant.

## 06 / THREAT MODEL: MAKE THE CLAIM TESTABLE

**What the protocol is designed to stop:** a restricted function-call key being used to sign a native NEAR transfer, change account keys, or invoke methods outside its approved scope.

**What it does *not* stop:** someone who obtains a genuine full-access owner secret. A full-access key can control its NEAR account, regardless of what the Synosis interface displays. The optional Rust vault's external-owner checks do not magically remove the rights of an existing full-access key on the vault's own account.

**Other risks:** compromised browsers, malicious extensions, clipboard leaks, phishing, weak local passwords, RPC availability, smart-contract vulnerabilities, and operator mistakes. A restricted phrase is intentionally shareable for the experiment; an owner phrase is not.

This is **not a claim of being “hackproof,” unbreakable, audited, or ready to secure real funds**. A serious security project must be precise about what it defends, what remains privileged, and how an outsider can falsify its claims.

## 07 / PROOF OVER PROMISES

| Component | Evidence in this repository | Status |
|---|---|---|
| Browser-based NEAR Testnet wallet | `index.html`, `src/web.js` | Implemented, requires end-to-end user testing |
| Local encryption and permission checking | `src/crypto.js`, `src/permissions.js` | Implemented |
| Restricted challenge-key generation | Web UI and `scripts/create-challenge.mjs` | Implemented; each key must be verified on-chain |
| Rust/WASM vault design | `contracts/vault/` | Prototype; deployment must be separately verified |
| Automated checks on Ubuntu Linux | `.github/workflows/ci.yml` | Configured; confirm latest run |
| Live rejected-withdrawal proof | `scripts/probe-restricted.mjs` and web probe | **Pending a recorded, attributable on-chain result** |
| Production audit and mainnet readiness | — | **Not complete; mainnet is disabled** |
| Chrome extension distribution | `popup.html`, `src/main.js`, `public/manifest.json` | Earlier proof-of-concept; not current release |

### What comes next

Prove the denial against NEAR itself. Preserve testnet explorer evidence. Demonstrate an authorised control transaction. Review the threat model with external testers. Only then consider hardened extension packaging, audits, and broader networks.

---

### SYNOSIS / THE RESEARCH POSITION

**We are not trying to make a wallet *look* secure. We are investigating what it means for authority to be encoded, constrained, and challenged by the blockchain itself.**

*NEAR Testnet only · Experimental security research · No real funds · No “unhackable” claims.*

Built by **Mushee**.
