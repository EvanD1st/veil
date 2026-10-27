# Isolated Zingolib TESTNET trial

This is a **read-only wallet recovery and synchronization trial**, not a live managed-payment adapter. No grant, proposal, signature, transaction broadcast or website-wallet activation command exists in the trial binary. Existing receiver, sender, node and scanner configuration stay unchanged. The production managed-wallet gate stays closed.

## Sources and boundaries

* Zingolib v7.0.0: `bfb0a2156819ea7f75a9b09b1724abfd06c8925e`, Rust 1.99.0, lock SHA-256 `8b24d60c8a531a30ba1c334d35a682f924b1a2069a1a4fecaab00eece500f58f`. Its NU7 dependencies include prereleases; publication is not an audit. The added `veil-trial` binary uses the SDK with its default feature set, a fixed local indexer and explicit Testnet. No CLI test-only network-consent override or consensus patch is used.
* lightwalletd v0.6.0: `e7436d2adb9ab5828eb8a27de534e16218841fc2`, Go 1.27.3, readonly module build. Upstream release workflow 39494059938 failed its Docker publish step; its build succeeded. Do not call it an audit pass. Its README explicitly disclaims thorough external security review. Our separate source build runs parser/frontend/common/CLI tests before upload.
* Existing Zebra's `zebra.indexer.rpc.Indexer` does not implement the wallet's `CompactTxStreamer`: actual GetLightdInfo returned gRPC 12. The existing authenticated JSON-RPC passed block/tree/subtree tests. This bridge reuses it without a second node, database reader or full-chain synchronization.

The bridge preserves node cookie authentication. A systemd credential supplies a protected snapshot of the cookie at each start; the read-only proxy uses it internally. Cookie rotation makes reads unavailable until this optional bridge is explicitly restarted; it never reconfigures or restarts Zebra. A separate ephemeral password authenticates lightwalletd to that proxy. Neither secret is an argument, printed value or repository file. Read RPCs are allowlisted, request size/concurrency/time/response size are bounded, and broadcasting is rejected before reaching Zebra. gRPC/HTTP listeners bind loopback only; network policy denies other destinations. No-cache mode avoids a full compact-block cache rebuild but still puts bounded query load on the node.

## Binary behavior

`veil-trial offline NEW_ABSOLUTE_PRIVATE_DIRECTORY HEIGHT` generates two **new unfunded** Testnet seeds, encrypts each recovery bundle and wallet with age, restores them independently and verifies distinct addresses and encrypted reopen. It refuses an existing directory, unsupported commands, paths with symlink components, insecure permissions and wrong network. Secrets travel only through memory/private pipes, never stdout, argv or an unencrypted wallet file. The encryption identity is mode 0600 inside a mode 0700 directory; it must accompany a protected operator backup. This technical restore check is not a user's manual backup confirmation and must not be represented as one.

`create` adds real local-indexer synchronization with the SDK's low-memory mode and a three-minute sync deadline per wallet. `resume` loads the retained encrypted wallets, restores independently from their original birthdays again and tests synchronization after a process restart. New-wallet birthdays come from the current node height minus the SDK's safety window; never use this to restore historical funds. Only sanitized heights, counts and booleans are emitted. An exception retains encrypted files and exits without retry. The SDK has plaintext secrets in process memory; encryption at rest does not make this noncustodial or protect against host administrators.

CI builds away from the workstation and live servers, preserves upstream lockfiles and uploads only the two executable artifacts, provenance and sanitized evidence. CI wallets/identities are ephemeral and never artifacts. Actual host sync/resource/restart evidence must be recorded separately; offline restore is not outgoing-payment evidence.

## Reversible host trial

Install verified binaries/scripts in a new root-owned `/opt/veil-zingolib-trial/releases/COMMIT`, with an explicit `current` symlink. Use dedicated `veil-zingolib` and new `/var/lib/veil-zingolib-trial` only. The receiving wallet and scanner credentials are never available to it. Preserve the original node cookie permissions. Do not grant direct access to Zebra state or another wallet's directory.

Before admission, require at least 3 GiB MemAvailable and 15 GiB free disk, active node/receiver/scanner, and strict scanner readiness. The optional sender remains stopped. Bridge cap 384 MiB, wallet cap 1 GiB, bounded CPU, swap and finite runtime; no retry/boot enablement. Stop only trial processes if available memory falls below 1 GiB or existing strict readiness/services regress. Spare memory and swap are not sustained capacity proof.

Rollback is **stop only `veil-zingolib-trial.service` and `veil-lightwallet-trial.service`**, leaving their encrypted new-wallet files and evidence intact. Both have Restart=no and no boot activation. Do not delete wallets, touch the working receiver/scanner or revert the deployed website database. The website has a separately verified compatible previous-reader rollback; these two rollbacks are independent.

Before any managed spending implementation can be activated: independently recover actual funded test identities, validate proposal fee/output/change/expiry/network binding, persist prepared bytes/txid before a single broadcast, reconcile uncertain outcomes without resending, validate restart/capacity, review source dependencies and get separate approval for the exact testnet transfer. Nothing in this trial silently activates starter funding or Pay.
