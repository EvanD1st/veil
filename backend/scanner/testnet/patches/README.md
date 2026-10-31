# Authorized experimental small-host wallet pool fix

**Built and installed under explicit experimental AWS TESTNET approval.** The operator separately approved the exact base plus the patch hash below on 23 October 2026 after reviewing the demonstrated pool failure. This changes the previously approved unmodified source; it is not an accepted upstream release and does not resolve the failed dependency-vetting gate. `build.sh` does not apply it automatically.

`zallet-minimum-wallet-pool.patch`, SHA-256 `2ee7547ced58a97498b93588b8f2c589e0db11c339f3379884c1052b6b0d1206`, applies cleanly to that exact commit. It changes only database-pool configuration and adds a focused concurrency regression. Existing source commits, dependencies/locks, cryptography, consensus, wallet backup, RPC authentication and scanner validation are unchanged by the proposal.

## Observed failure and source evidence

On the actual two-vCPU AWS host, authenticated OpenRPC discovery responds, but `getwalletstatus` and `z_listaccounts` timed out before and after a whole-instance reboot. The wallet opened the compatible v29+indexer state and continued scanning; there were zero accounts and no transfer.

The pinned core's `database::connection::pool` uses `deadpool::managed::PoolConfig::default()`. The exact locked deadpool 0.12.3 implementation sizes that pool as `num_cpus::get() * 2`, with no acquisition timeout. The pinned `WalletSyncTasks::spawn` retains four database handles for the batch decryptor, steady-state scan, historical recovery and data-request tasks. A pool of two stalls sync initialization; a pool of four leaves no connection for wallet/keystore RPC work. Increasing this host's quota alone cannot provide more than two actual CPUs.

An EC2 Rust probe linked to the actual pinned build's `num_cpus` library reported:

| Service CPU quota | Visible CPUs | Default pool capacity |
| --- | --- | --- |
| 100% | 1 | 2 |
| 180% | 2 | 4 |

The helper keeps the existing default settings while making capacity at least eight. The regression holds four synthetic background connections and then obtains an RPC connection, using the actual compiled pinned deadpool/Tokio libraries. The CPU-derived baseline failed within its one-second bound at both quotas; the exact proposed helper passed at both quotas. Those are **source-level concurrency regressions with dummy connections**, separate from the subsequent actual build/RPC evidence below.

## Actual patched build and integration evidence

The full patched backend build passed at 16:45 UTC, with Rust 1.95.0, one Cargo/CMake job, release debug information disabled and both original Cargo locks verified. Its release build took 28m 44s. Only disposable compilation caches were reused; the unmodified release remains installed separately for investigation/rollback. The workspace's `.cargo/config.toml` supplies required `CXXFLAGS=-include cstdint`; run Cargo from that workspace directory, including when using `--manifest-path`.

Installed backend SHA-256: `27062b951bf0826c7067c57eebcdaab5509bc44dda39ed236d0c12e6408c35ab`. Launcher and Zebra hashes remain unchanged. Build-manifest SHA-256: `99fb53bfbdf8b866ff5ff09476adac5474457645236c796d4213eddbae74c67f`.

After installation and state opening, actual authenticated `getwalletstatus` returned in 31 ms and `z_listaccounts` in 1 ms, replacing the observed timeouts. Discovery returned OpenRPC 1.3.2 with 45 methods. The wallet correctly reported `locked: true` and omitted incomplete scan fields while catching up. One account was created from the operator-confirmed backup, and a real Sapling testnet receiver was derived and accepted by VEIL's checksum/format validator. Identifiers, receiving addresses and recovery material are kept private. This proves partial RPC/state compatibility; it is not current-tip readiness, shielded-output schema, payment or public website integration evidence.

The unmodified wallet did not finish its three-minute SIGINT shutdown and systemd killed it at the configured bound. That failure is recorded rather than called orderly recovery. A fresh Zallet consistent backup passed `quick_check` before selecting the patched release. Patched shutdown and repeat whole-host recovery passed with zero failure restarts and the same account/address. Final synchronization remains pending; see [current execution evidence](../../../../docs/TESTNET_SERVICE.md).

## Build/replacement and remaining checks

The authorized build uses the same verified Cargo locks and pinned toolchain with separate proposed source and output directories. The relevant commands, after exact base/patch verification in a new source directory, are `git apply --check PATCH`, `git apply PATCH`, then (from the Zallet workspace) `cargo +1.95.0 build --locked --release --package zallet` and `cargo +1.95.0 build --locked --release --manifest-path backends/zebra/Cargo.toml --features rpc-cli`. Export `CARGO_BUILD_JOBS=1`, `CMAKE_BUILD_PARALLEL_LEVEL=1` and `CARGO_PROFILE_RELEASE_DEBUG=0`; record distinct source/output/cache directories and actual binary hashes.

Preserve original binaries and all current backups/state. Do not modify a running source/state tree to make a candidate open. Recheck actual account/status RPC, the existing backed-up receiver, synchronization, cookie rotation, service restart and whole-host boot recovery after any replacement. Do not relabel the result audited or approved upstream, relax scanner readiness or send funds to demonstrate a pass. Current synchronization and the live-payment gate remain pending.
