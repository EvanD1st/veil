# Proposed small-host wallet pool fix

**Not installed. Separate operator approval is required.** The existing approval selected the unmodified Zallet commit `0d433b322408c30ee48765a98a81af9001108e7d`. This proposal changes that source; it is not an accepted upstream release and does not resolve the failed dependency-vetting gate. `build.sh` does not apply it.

`zallet-minimum-wallet-pool.patch`, SHA-256 `2ee7547ced58a97498b93588b8f2c589e0db11c339f3379884c1052b6b0d1206`, applies cleanly to that exact commit. It changes only database-pool configuration and adds a focused concurrency regression. Existing source commits, dependencies/locks, cryptography, consensus, wallet backup, RPC authentication and scanner validation are unchanged by the proposal.

## Observed failure and source evidence

On the actual two-vCPU AWS host, authenticated OpenRPC discovery responds, but `getwalletstatus` and `z_listaccounts` timed out before and after a whole-instance reboot. The wallet opened the compatible v29+indexer state and continued scanning; there were zero accounts and no transfer.

The pinned core's `database::connection::pool` uses `deadpool::managed::PoolConfig::default()`. The exact locked deadpool 0.12.3 implementation sizes that pool as `num_cpus::get() * 2`, with no acquisition timeout. The pinned `WalletSyncTasks::spawn` retains four database handles for the batch decryptor, steady-state scan, historical recovery and data-request tasks. A pool of two stalls sync initialization; a pool of four leaves no connection for wallet/keystore RPC work. Increasing this host's quota alone cannot provide more than two actual CPUs.

An EC2 Rust probe linked to the actual pinned build's `num_cpus` library reported:

| Service CPU quota | Visible CPUs | Default pool capacity |
| --- | --- | --- |
| 100% | 1 | 2 |
| 180% | 2 | 4 |

The proposed helper keeps the existing default settings while making capacity at least eight. The regression holds four synthetic background connections and then obtains an RPC connection, using the actual compiled pinned deadpool/Tokio libraries. The CPU-derived baseline failed within its one-second bound at both quotas; the exact proposed helper passed at both quotas. This is a **source-level concurrency regression with dummy connections**, not a full patched-wallet build or proof that actual RPC/payment integration now works.

## Deliberate next step

After explicit approval for the exact base plus this patch, build it separately with the same verified Cargo locks and pinned toolchain; record the patch, new binary hashes and results. Preserve the unmodified installed release and all current backups/state. Stop the wallet cleanly before selecting the new binaries, leaving Zebra's existing state intact. Recheck actual account/status RPC, derive/validate the backed-up new testnet receiver, synchronization, cookie rotation, service restart and whole-host boot recovery. Do not relabel the result audited or approved upstream, relax scanner readiness or send funds to demonstrate a pass. Until those checks succeed, account/address creation and the live-payment gate remain pending.
