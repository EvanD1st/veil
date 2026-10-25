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

The live website is still source `1ea44089f9e9c576dd3edca23f116c57333f5489`. New application wording requires a separately reviewed release artifact and deployment approval. No migration is required. Preserve the prior release, take a fresh consistent SQLite/configuration backup and verify integrity before a release; rollback restores that matched set. Do not roll back live payment records to a pre-payment snapshot merely to change wording.

## Experimental status and remaining validation

Zallet remains approved experimental base `0d433b322408c30ee48765a98a81af9001108e7d` plus the minimum-pool patch `2ee7547ced58a97498b93588b8f2c589e0db11c339f3379884c1052b6b0d1206`. Backend SHA-256 remains `27062b951bf0826c7067c57eebcdaab5509bc44dda39ed236d0c12e6408c35ab`. The failed upstream cargo-vet evidence remains unchanged; no Rust rebuild, audit bypass or release approval is implied.

The separate sender's full scan, decrypted balance and capped outgoing transaction remain pending. No new transfer is authorized by this record. Escrow spending remains disabled. Preserve the existing funded sender, backups and payment selector; recovery never sends another payment.

The operator identified an actual **Redmi K30 Pro, Android, Chrome** for physical validation. The operator reports successful use of both authentication forms and a successful phone bid. Whether that bid was on a saved listing or the guided demo, OS/Chrome versions, proof/key recovery, cancellation and timing measurements remain pending. These are operator-reported results, not remote device instrumentation. Desktop/CI emulation is not physical-device evidence. On the real device, record authentication/keyboard/overflow, separate seller/bidder sessions, persisted bid and key backup/restore, pre-close locking, ordinary future-round reveal, cold/cached asset and proof times, cancellation/retry, publication and independent verification. Payment observations can use the existing paid invoice only through an authorized participant; do not disclose its identifiers or send another payment.
