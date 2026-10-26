# Payment execution evidence — 25 October 2026

This is an execution record and focused implementation review, not a security audit or upstream dependency approval. No addresses, account identifiers, invoice IDs, transaction IDs, memo contents, report bytes or wallet material belong in this public record.

## Completed live checks

The existing persisted public auction used separate ordinary seller, winner and observer accounts and a real future drand round. Its unchanged direct-payment invoice was paid once through a separately approved free faucet request for exactly **20,000 zatoshis (0.00020000 TAZ)** and its exact custom memo. The faucet funded the transaction and its fee; our separate sender wallet was not used.

Actual receiving Zallet RPC showed one matching Sapling output: explicit incoming/non-change classification, integer `valueZat`, full 512-byte memo and Sapling output index all matched. The node confirmed testnet, active-chain inclusion and matching wallet/node confirmation counts. The existing read-only scanner accepted the exact output with 13 confirmations before registration.

The winner registered that selector through the ordinary authenticated API. The supervised AWS worker delivered a real signed report over outbound HTTPS, and the website returned `scanner-confirmed`. The stored Ed25519 signature was independently checked against the configured public key. A later post-recovery observation had 54 confirmations. These are sampled observations, not permanent finality.

Actual hosted checks also passed:

- Seller/winner access, observer rejection, cross-origin rejection, immutable output binding and session revocation.
- Idempotent selector registration and identical report acknowledgement without extending observation time or expiry.
- Controlled lost-acknowledgement recovery: an unchanged, already acknowledged **actual** report was restored to the private durable outbox, and the supervised worker replayed it after startup. The same outbox inode drained successfully. This intentionally recreated a recovery state; it was not a naturally observed network failure or a second payment.
- During a deliberate scanner-only outage, ordinary clocks passed the actual report expiry. The website returned `needs-refresh` and automation `unavailable`. Replaying the acknowledged expired bytes did not restore confirmation.
- Restarting only the scanner caused a new actual scan/report for the same payment and restored current confirmation. The temporary safety restart timer was cancelled after restoration. The scanner remains enabled at boot.

The installed Linux scanner/outbox suite passed **18/18** tests separately. Its controlled reorg/race fixtures are synthetic; no public testnet reorg was induced. An active process, fixture, QR code or passing preflight was not substituted for payment evidence.

The faucet transaction used Ironwood actions and Sapling outputs, with no transparent inputs/outputs. This is a cross-pool faucet-funded receipt, not validation of same-pool Sapling-to-Sapling spending or an anonymity guarantee. The faucet knows the destination, amount and invoice memo as disclosed in the approval.

## Sender memory recovery

The optional, separately backed-up sender had 232,907 historical scan blocks pending despite its recent account birthday. Its 1,536 MiB soft cap caused severe reclaim stalls; raising only the soft cap while retaining a 1,792 MiB hard cap led to a cgroup OOM and one automatic restart. Retries were stopped; wallet and consistent off-host backup integrity passed. No funds were spent.

The pinned Zallet source already supports `[sync] recover_batch_size`. Its default is 1,000, and its configuration documentation explicitly says a whole batch is held in memory. The recovery loop splits requested ranges using that setting. A sender-only trial uses **100**, retaining the original memory hard cap, CPU/swap limits, wallet, state and approved binary. Scan work must still complete: this does not skip blocks, edit scan queues, change birthdays or relax the scanner's strict readiness.

Initial trial observations showed progress to 231,907 pending blocks, no OOM/failure restarts and sub-one-percent memory pressure. These initial observations are not full synchronization, spending readiness or a permanent capacity guarantee. A later roughly ten-minute sample still had zero cgroup OOM/max events and failure restarts, with a measured peak of about 1,566 MiB. A controlled clean stop passed wallet integrity and preserved scan ranges; restart with the same configuration succeeded. Full synchronization and a longer soak remain pending. The sender is running but intentionally remains disabled at boot until its capacity/readiness work is complete. The already working receiver/node were not restarted or reconfigured. Fresh-lab templates now select the smaller batch for both wallets; never run the initializer over existing wallet material.

The fixed read-only monitor includes the sender's service state so a second-wallet failure is visible without exposing RPC, wallet keys or payment data. An intentionally inactive optional sender is different from a failed sender.

## Application review and changes

The payment implementation already enforces seller/winner privacy, a canonical invoice, immutable queued selector, trusted signature, five-minute report expiry, atomic monotonic report updates, global output-reuse protection, bounded leases/backoff and an owner-only durable outbox. Browser sessions cannot act as the scanner. No validation boundary was loosened.

Two misleading messages are corrected: opening a QR request must not categorically claim that no payment has been verified, and expired automatic verification should explain retries rather than require manual report import. A production-artifact browser regression checks the request panel's confirmation and no-resend guidance.

At initial review the live website was source `1ea44089f9e9c576dd3edca23f116c57333f5489`. The 26 October approved activation below records the later wording release. No migration is required. Preserve the prior release, take a fresh consistent SQLite/configuration backup and verify integrity before a release; rollback restores compatible code/configuration without discarding current payment records. Do not roll back live payment records to a pre-payment snapshot merely to change wording.

## Experimental status and remaining validation

Zallet remains approved experimental base `0d433b322408c30ee48765a98a81af9001108e7d` plus the minimum-pool patch `2ee7547ced58a97498b93588b8f2c589e0db11c339f3379884c1052b6b0d1206`. Backend SHA-256 remains `27062b951bf0826c7067c57eebcdaab5509bc44dda39ed236d0c12e6408c35ab`. The failed upstream cargo-vet evidence remains unchanged; no Rust rebuild, audit bypass or release approval is implied.

At the 25 October cutoff the separate sender's scan and balance remained pending; the 26 October follow-up below records later successful read-only checks. Sustained sender capacity and a capped outgoing transaction remain unvalidated. No new transfer is authorized by this record. Escrow spending remains disabled. Preserve the existing funded sender, backups and payment selector; recovery never sends another payment.

The operator identified an actual **Redmi K30 Pro, Android, Chrome** for physical validation and reported successful authentication forms and bidding. On 26 October the operator additionally confirmed that the requested phone workflow worked. Record that as operator-confirmed functional phone validation; it is not browser emulation or remotely instrumented evidence. Individual proof/download timings, Android/Chrome versions and a step-by-step device capture were not supplied, so no measured phone performance claim follows. No additional payment was authorized by this confirmation.

## 26 October follow-up

CI [40228782310](https://github.com/EvanD1st/veil/actions/runs/40228782310) passed both jobs for PR #16 head `5426d1b1c623f6f975b124a3524f2f08ee8121cd`, including unit/authentication/scanner checks, typechecking, both production targets, native/browser proof/payment regressions, authentication scenes and escrow browser checks. Those automated fixtures remain separate from the actual receipt above.

A fresh ordinary HTTPS session still returned a correctly bound, unexpired automatic confirmation for the existing paid invoice, sampled at **1,827 confirmations**. Authenticated HTTPS checks passed all six proof-asset sizes/hashes, API authorization, forged-identity rejection, scanner-token rejection and logout revocation. No transfer, queue re-registration or report import was needed.

The longer sender trial **failed**: the kernel recorded 12 sender-cgroup OOM events overnight. The 100-block batch helped historical progress but did not establish stable capacity under the old 1,536/1,792 MiB caps. RPC timed out with about 93% reclaim pressure. A stop exceeded the existing 180-second orderly-shutdown window and systemd terminated the sender; subsequent SQLite `quick_check` passed and a fresh consistent private backup was taken. Saved ranges showed historical scanning through height 4,542,910. Do not describe the initial ten-minute sample as a permanent fix. Other overnight OOM records also exist; the current node/receiver health checks alone do not establish their cause.

One new sender-only **bounded** trial keeps the same approved binary, wallet, batch and readiness logic. Effective limits are 1,792 MiB soft / 2,048 MiB hard, 512 MiB swap and 75% CPU. `Restart=no`, disabled boot startup and a 20-minute maximum runtime prevent another unattended retry loop. Effective properties must be checked after reload and restart: a lexically later existing `resources.conf` overrode both the new trial drop-in and persisted `50-*.conf` property files. Live `systemctl set-property` temporarily applied the intended limits, but that alone did not prove restart persistence. The existing sender resource file was backed up and corrected; read-back before and after startup then matched. The reusable [trial drop-in](../scanner/testnet/systemd/sender-validation.conf) documents bounded supervision; inspect actual resource limits separately.

At a subsequent sample both wallets matched node height **4,543,025**, the sender was sync-safe with no pending work, sender memory was about 973 MiB, cgroup OOM/max counters and memory-pressure averages were zero, and host available memory was about 2.26 GiB. The unchanged strict scanner preflight then passed against the sender. Read-only `z_getbalanceforaccount` returned **100,000,000 Sapling zatoshis (1 TAZ)** at three minimum confirmations. This establishes sampled synchronization and a funded balance; it does not validate outgoing transaction construction, fees or spending. Sustained stability and the bounded trial's final result remain pending. The node, receiver and scanner were not restarted or reconfigured during this follow-up.

The first bounded run levelled near 1.75 GiB for the remaining sample with zero OOM/max events, no failure restarts and near-zero reclaim pressure. A clean stop took 0.803 seconds, SQLite integrity passed and the scan ranges were preserved. After restart the strict preflight initially rejected a lagging wallet, then passed once it reached the real tip; readiness was not weakened. A second clean stop took 0.114 seconds and another consistent private backup passed integrity. This short trial/restart evidence is not a continuous-capacity guarantee or outgoing-spend evidence.

The tested read-only monitor was installed with the sender's fixed service fields and exercised through the restricted SSH account. The hourly monitor distinguishes optional sender trials from the live receiving/scanning service. It cannot run wallet RPC, restart services or read keys. No new wallet, Rust build, database migration, escrow execution or payment was performed. Reviewed PR head `d6ec281` passed both jobs in [CI 40277354217](https://github.com/EvanD1st/veil/actions/runs/40277354217). Its tested merge-tree artifact `577c90dfe566de35aaff7a8d8e4ab99da3233123`, archive SHA-256 `ddfcce428e7d420f91deb438aeed3c9a56be7425a2343624a69c2f8b55bd4f8f`, passed an isolated loopback smoke test against a private database copy. Later commits document operations; application/runtime/migration/script contents match this tested artifact.

After repairing the persistent override, the intended limits were read back before startup, while running and after another clean stop. Strict preflight recovered at the real tip, with zero OOM/max/failure-restart events. Final shutdown took 0.114 seconds; SQLite integrity and a new consistent backup passed, and its protected off-host copy's checksum matched. The optional sender is intentionally inactive/success and boot-disabled after this bounded validation. Node, receiver and scanner remain supervised. Longer capacity and outgoing construction/fees/spending remain unvalidated; another transfer needs a new unpaid invoice and exact approval.

## Approved website activation — 26 October

The operator separately approved the exact `577c90d` artifact and archive hash above. It was activated at 06:12 UTC with a fresh consistent SQLite/configuration backup and no migration. Backup integrity passed; SHA-256 `1a3993d14563321a0c81076133931f8d0821917fea84759167908114b47b7d5b`. Counts remained **7 accounts / 2 auctions / 2 bids / 1 payment report**. Only VEIL restarted; local health passed in **1.91 seconds**. The preceding release remains available for compatible code/configuration rollback. Preserve the current database and post-backup writes because no schema rollback is needed.

Post-release ordinary HTTPS login/logout, authorization, scanner rejection and all six proof-asset hashes/sizes passed. The existing paid invoice still returned fresh, correctly bound automatic confirmation, sampled at **1,882 confirmations**. No new registration or payment was submitted. PR #16 remains open/unmerged. This deployment does not enable escrow spending or validate outgoing payment construction or measured phone proof performance.
