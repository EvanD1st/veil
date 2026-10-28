# Website release and isolated Zingolib evidence — 27 October 2026

## Website deployed

The operator approved deployment before this trial. PR #20 was merged as main **13ef1d4ade85a849aaf2c24d6cbd7c3aa9883e5f**; post-merge [CI 40454808336](https://github.com/EvanD1st/veil/actions/runs/40454808336) passed. Its Git tree `dd3a448e84fa13956e5908ff8835084992ab16f9` is identical to previously tested candidate **ac032121299ce8e6ccda4e97eaec5981198e52b5**. That exact candidate artifact was activated, not falsely relabelled as a separately rebuilt merged-commit artifact.

Archive SHA-256 `03e9b9724e0bb7399eb3d4c72fd8438c658ed27b487cdf5cc05b6cd29bf1dfe1`. Every extracted file was compared to the archive before selection. A fresh consistent SQLite/private-file backup and configuration snapshot preceded migration **0007_judging.sql**, SHA-256 `4161524fc322ea0996ba3d0a9631541c3e95e427275833af8dc0eab872776f8c`. Integrity and all original table counts passed (migration ledger increased by one). Interruption was **2.54 seconds**. Current code is `/srv/veil/releases/ac032121299ce8e6ccda4e97eaec5981198e52b5`.

Actual HTTPS checks passed: anonymous page redirect; login; authenticated auction API; logout/session revocation; wrong-origin logout and spoofed-header rejection; scanner bearer rejection; all six proof-asset hashes and lengths; ten-family catalogue with `demoActive=false`. Caddy and Docker stayed active; no unrelated service was restarted. Managed wallet balance/grants/Pay and automatic editions stay disabled. The catalogue is not evidence of live seeded editions or purchases.

Matched backup: `/srv/veil/shared/backups/judging-deploy-20261027T055209Z`. Compatible rollback reader: `/srv/veil/releases/cb5ab9f-compatible-0007` (previous application plus reviewed migration recognition). That reader passed the earlier migrated-copy authentication rehearsal. After public writes resume, retain the current database/private files and select that reader; never restore a stale pre-purchase database. Node/wallet changes are not part of website rollback.

## Actual interface checks

Pinned SSH and read-only inspection confirmed Zebra gRPC exposes `zebra.indexer.rpc.Indexer`; calling `cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLightdInfo` returned **gRPC 12 UNIMPLEMENTED**, despite HTTP 200. Zingolib cannot connect directly to that endpoint. Existing Zebra JSON-RPC succeeded for node info, tip, raw block, Sapling/Orchard subtree roots, mempool and tree state. At inspection the node was testnet height 4,546,481, estimated height 4,546,482, branch 77190ad9. These are node observations, not an independently observed network tip.

## Isolated implementation and CI

Branch `zingolib-testnet-trial` starts from merged main 13ef1d4. A pinned-source `lightwalletd` bridge and an SDK-based `veil-trial` binary are separate from the application, receiving wallet and scanner. [Implementation and boundaries](../backend/scanner/zingolib/README.md) describe the sources, locked builds, memory limits, encryption and rollback.

At implementation commit **1022a22d01455d44133d90f6d26fe84814e0aae1**, [binary CI 40466060402](https://github.com/EvanD1st/veil/actions/runs/40466060402) passed both jobs and [application CI 40466060391](https://github.com/EvanD1st/veil/actions/runs/40466060391) passed. The binary build did not run on the workstation, website host or node host. Bridge parser/frontend/common/CLI tests passed. Offline SDK tests created two independent ephemeral test wallets, restored their keys from encrypted individual backups, reopened encrypted wallet serialization and rejected overwrite/unsupported operations. CI wallet secrets were not uploaded.

Installed artifact provenance:

| Component | Source | Binary SHA-256 |
| --- | --- | --- |
| lightwalletd v0.6.0 | e7436d2adb9ab5828eb8a27de534e16218841fc2 | bfb7ff48e8af8ac927782df69716b901f65144f3c60956fbcb70fef0c66cce9d |
| Zingolib v7.0.0 plus VEIL trial entry point | bfb0a2156819ea7f75a9b09b1724abfd06c8925e; entry point 1022a22 | dea2d330966ee64f5061e78f28f9960dc23a3d1f7559f826e81834743ffd3605 |

The existing experimental Zallet and its failed upstream cargo-vet evidence remain unchanged. New pinned releases are not asserted to be externally audited. The lightwalletd release workflow's Docker publication failure was inspected separately from its passing build. Zingolib retains its pinned prerelease NU7 dependencies; no checks or consensus code were bypassed.

## Actual TESTNET execution

A new unprivileged `veil-zingolib` account and private trial directories were installed. Existing state, cookie permissions and binaries were preserved. The bridge uses a protected node-cookie credential, private loopback endpoints and an HTTP proxy that rejects all mutation RPCs. Actual requests to that proxy for `sendrawtransaction`, `z_sendmany` and `stop` were rejected before forwarding. No transaction was submitted to Zebra.

The first `create` run completed successfully in **10.06 seconds**, independently restoring and synchronizing two **new unfunded** testnet wallets to **4,546,710**, scanning 118 blocks each. Wallet process-group peak **17,928,192 bytes**; bridge observed peak **53,448,704 bytes**. Minimum MemAvailable during the run was **3,194,310,656 bytes**. These are new/empty-wallet figures, not funded proving or concurrent user capacity.

Stopping the bridge closed ports 19067/19068/19069 and left Zebra/receiver/scanner active. Restarting it reloaded the protected credential. A separate explicit wallet `resume` process then reopened retained encrypted state, repeated independent recovery checks and synchronized successfully in **10.07 seconds**, reaching **4,546,712** after scanning two additional blocks per wallet. No existing service restarted: Zebra counter 1, receiving wallet counter 2, scanner counter 0 stayed unchanged. Historical counters are not new failures. The old optional sender stayed stopped.

Both trial processes are finite, Restart=no, without boot enablement. Rollback stops only the optional services and retains encrypted wallet/recovery material. This was exercised during the trial. At final inspection the bridge had reached its planned 1,800-second runtime and systemd recorded `Result=timeout`; ports were already closed. That termination evidence was retained before clearing only the trial failure marker. Final state is inactive/success, static (no boot enablement), Restart=no, with all three ports closed. The completed transient wallet unit was already unloaded; rollback now explicitly tolerates that normal state. Existing service restart counters remained unchanged.

## Still unvalidated / disabled

This proves actual private-indexer connectivity, independent keys/recovery, encrypted persistence and process restart with **empty** wallets. It does not prove a funded restore, signing/proving, change/fee/expiry validation, a transaction broadcast, post-payment recovery, sustained concurrency or an integrated judge checkout. No new payment, faucet request, treasury grant or mainnet operation was authorized/performed. No full-chain resync was started.

The existing synthetic treasury contract remains synthetic-only and its production gate stays closed. Funded signing must be implemented and inspected with an exact approved testnet payment before enabling managed Pay/grants. New-flow physical-device checks are also pending; previous Redmi form/bid reports remain historical evidence for those screens only.

Local bridge regression tests: seven passed, covering denied mutation/batch/malformed/oversized requests, authentication, authenticated read forwarding, field filtering and suppressed upstream diagnostics. These HTTP tests use a mocked node transport and are separate from actual host observations above.
