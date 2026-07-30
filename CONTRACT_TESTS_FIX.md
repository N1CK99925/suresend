# Contract tests failed to compile — troubleshooting

Summary
-------

When running `cargo test` in `contracts/suresend`, the build fails while compiling dependencies with an error similar to:

```
error[E0277]: the trait bound `ChaCha20Rng: ed25519_dalek::rand_core::CryptoRng` is not satisfied
  --> .../soroban-env-host/src/builtin_contracts/testutils.rs:26:58
note: required by a bound in `ed25519_dalek::SigningKey::generate`
error: could not compile `soroban-env-host` (lib) due to 1 previous error
```

What this means
----------------

This is not an error in our contract code. The failure happens while compiling a dependency (`soroban-env-host` / `ed25519-dalek` / `rand_chacha`) due to a mismatch in versions or the Rust toolchain on the machine. In short: the local Rust environment and the dependency versions are incompatible.

Fastest fixes (recommended)
--------------------------

1. Update the Rust toolchain to the latest stable release and retry the tests. On developers' machines and CI, run:

```bash
rustup update stable
rustup default stable
cd contracts/suresend
cargo clean
cargo test
```

2. If the error persists, run `cargo update` at the workspace root to refresh the lockfile with compatible dependency resolutions, then `cargo test` again:

```bash
cd contracts
cargo update -p ed25519-dalek --precise 3.0.0 || cargo update
cd suresend
cargo test
```

Notes and cautions
------------------
- Avoid making ad-hoc changes to pinned dependency versions in `Cargo.toml` without CI verification; Soroban SDK and the host have tight compatibility boundaries.
- If `rustup update` and `cargo update` do not resolve the problem, the safer path is to reproduce the exact toolchain used by your CI (or by Soroban SDK) and use `rust-toolchain.toml` to pin it.

If you want me to try repository-side fixes
-----------------------------------------

I can attempt one of the following (tell me which):

- A: Try adding a `rust-toolchain.toml` with a recent stable toolchain (I will pick the latest stable) and re-run `cargo test` here.
- B: Apply conservative `patch.crates-io` entries in the workspace `Cargo.toml` to pin `ed25519-dalek` / `rand_chacha` to versions known compatible with the Soroban SDK used here, then re-run tests and iterate until green. This may require a few attempts.

What I changed for the frontend (already pushed)
------------------------------------------------

- Sanitised low-level HostError/VM trace display to avoid exposing internal errors to users.
- Added `getSUSDBalance` to the frontend and a SUSD balance display in the Sender review flow.
- These frontend fixes are committed and pushed to `main` so Netlify will rebuild the site automatically.

How testers should proceed now (quick checklist)
-----------------------------------------------

1. Connect wallet in the site deployed by Netlify.
2. Click “Enable SUSD” (create trustline) and confirm transaction success.
3. Ensure your wallet has some SUSD (faucet/swap/mint on testnet).
4. Click “Approve SUSD for SureSend” and confirm success.
5. On the Review step verify the SUSD balance shown is >= requested lock amount.
6. Click “Lock … SUSD”. If it fails, check browser console for details (the UI logs the full host error there).

If you'd like me to proceed to attempt an automatic repo-side fix for the contract tests, reply with **A** (add rust-toolchain) or **B** (try dependency patches). If you want me to only prepare a PR and notes for your CI team instead, reply with **Notes only**.
