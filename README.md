# SYNOSIS

### THE KEY IS REAL. THE AUTHORITY IS DIFFERENT.

**A new experiment in digital ownership — powered by NEAR, engineered with Linux-based infrastructure.**

What if you could hold a genuine wallet credential, open an account, see its NEAR balance, and still have **no permission to withdraw**?

Not a simulation. Not a frozen button. A different model of access.

**Welcome to Synosis.**

[![NEAR](https://img.shields.io/badge/NEAR-Native%20Testnet-111827?style=for-the-badge)](https://near.org/)
[![Linux](https://img.shields.io/badge/Linux-Engineered-111827?style=for-the-badge)](.github/workflows/ci.yml)
[![Research](https://img.shields.io/badge/Status-Research%20Prototype-6d28d9?style=for-the-badge)](#research-status)

**[Explore Synosis](https://synosis-indol.vercel.app/)** · **[Developed by Mushee](https://mushee.xyz)**

---

## BEYOND THE WALLET

The traditional wallet is built on a simple assumption:

> Whoever controls the key controls the assets.

**Synosis questions the assumption.**

We are exploring an architecture in which **access and authority are distinct**. A person may hold a valid, importable credential for a NEAR account while the network itself limits what that credential can do.

The result is a new kind of interaction: a wallet that can be explored, inspected, and challenged without automatically granting spending power.

**Seeing the funds is not the same as controlling the funds.**

## THE ACCESS PARADOX

**One account. Different levels of authority.**

Synosis distinguishes between a private owner credential, which may authorise asset transfers, and a restricted challenge credential, which is limited to specifically permitted actions.

Both can refer to the *same* NEAR account. This does **not** mean that users need two separate wallets.

- **Private ownership:** Full-access credentials retain control over authorised transfers and account management.
- **Public challenge:** A separate restricted credential allows account inspection and only its permitted interactions, but cannot authorise native NEAR transfers.
- **Network-level enforcement:** The restriction comes from NEAR's permission system rather than relying solely on Synosis's interface.

The research question is simple:

### Can the network enforce the boundary even when a participant takes the restricted credential into another compatible wallet?

That is what the Synosis public challenge is designed to test.

## NEAR-NATIVE. LINUX-ENGINEERED.

Synosis explores programmable account authority **directly on NEAR**, with a web-first experience and a separate experimental smart-contract component.

Its engineering environment uses **Linux-based automated testing**, including Ubuntu runners for wallet checks and Rust/WebAssembly vault builds. The prototype combines browser-based interaction with NEAR-native account permissions and contract research.

**The experience is currently delivered through the web, not as a standalone Linux desktop app.** Linux is part of the project's build-and-validation technology, not a requirement for participants to install an operating system.

This is deliberate: make the experiment accessible while testing its security assumptions against the underlying network.

## THE PUBLIC CHALLENGE

**You have access. Do you have authority?**

The challenge invites participants to investigate the difference between possessing a credential and possessing permission to move assets.

A participant can be given a **restricted challenge recovery phrase**, import it in a compatible NEAR wallet, and inspect the associated account. The interesting moment comes when they try to authorise a native NEAR withdrawal — an action that the restricted key is not permitted to perform.

Synosis is designed to make the security boundary **observable and independently testable**.

A generic wallet error is not sufficient evidence of protection. An actual security claim needs the relevant on-chain key permissions and a specific, attributable transaction rejection.

**Do not share a private owner recovery phrase.** The public challenge uses a different, deliberately restricted credential.

## RESEARCH WITHOUT THE THEATER

We are not building the appearance of a secure wallet.

We are testing a deeper proposition: that permissions can be separated from possession and enforced by a blockchain rather than by interface design alone.

The Synosis prototype currently explores:

- **Permission-aware wallet access** on NEAR Testnet.
- **Restricted challenge credentials** that can be independently examined.
- **Local-first encrypted key handling** for wallet ownership.
- **NEAR smart-contract vault research** with separately authorised withdrawal logic.
- **Linux-based automated builds and testing** for the application and contract prototype.
- **Cross-wallet adversarial testing** to distinguish interface restrictions from network enforcement.

This is a research direction, not a claim to have invented a new cryptographic primitive or to have made wallets invulnerable.

## RESEARCH STATUS

**Synosis is an experimental NEAR Testnet prototype.**

The web wallet and restricted-access flows are implemented. A Rust/WebAssembly vault prototype and Linux CI workflows exist in this repository. Independent live withdrawal-rejection evidence, external security review, and production readiness remain separate validation steps.

The restricted challenge credential **does not** make an exposed full-access owner phrase safe. Anyone with a legitimate full-access key may still exercise that key's permissions. Synosis must never be described as hackproof, fully audited, or suitable for protecting real funds at this stage.

**No real funds. No mainnet guarantees. Proof over promises.**

For researchers who want the implementation, the [source code](https://github.com/mushee-io/synosis), [challenge documentation](scripts/README.md), and [automated workflows](.github/workflows/ci.yml) remain available.

---

### SYNOSIS

**Access is not ownership. Possession is not permission.**

*A NEAR-native security experiment, built by Mushee.*
