# Managed checkout current status — 27 October 2026

PR #22 is merged into `main` at `e6b2076`. The user-approved follow-up website source `7e71a6f0bd03e0dbdec0239790716c7ef52de919` (archive SHA-256 `7f5742d0b1b8a73a5e0e3607c1c0bc19bd0c7fdfc99873be401f5a97307bd8f1`) is deployed at https://ve-il.duckdns.org. Deployment used a fresh consistent SQLite backup, required no migration, passed integrity and foreign-key checks, preserved all existing table counts and interrupted VEIL for 2.89 seconds. The prior release remains at `/srv/veil/releases/936171ef410315c64bc7c23e4521bda9ec6ed844`; current backup is `/srv/veil/shared/backups/approved-managed-7e71a6f`.

The approved TESTNET invoice was broadcast once, confirmed in the active chain, and its automatic signed scanner report was acknowledged. Actual-clock expiry then hid the stale confirmation, preserved the earned download, and refreshed the same output automatically; the download bytes still matched exactly. No replacement transfer was sent.

The bounded funding policy is approved: 200,000 zatoshis per independently backed-up account, no more than 10 accounts, maximum fee 20,000 zatoshis per grant, and daily plus lifetime aggregate limits of 2,200,000 zatoshis including fee allowance. The isolated Zingolib binary hash and funded-restore/prepared-inspection/single-broadcast/scanner/restart evidence match. The database contains the one confirmed, acknowledged purchase and no pending transfer; its integrity and foreign keys pass. The node reported Zcash testnet, NU7 branch `77190ad9`, fresh strict readiness, 3.1 GiB available memory and about 65 GiB free disk.

Activation failed because systemd presents its read-only validation credential as mode `0440`, while `privateJson` rejects every group-readable file. The managed worker is now stopped and disabled at boot, and its runtime switch is `false`. The private tunnel, read-only indexer and health timer remain active and enabled at boot. No grant or additional transaction was made. A follow-up source change will accept only the exact read-only `managed-validation` file inside this unit's `CREDENTIALS_DIRECTORY`, preserve the owner-only requirement for other private JSON, and add regression coverage. Rebuild, CI, isolated worker retest and a concrete replacement artifact are pending; managed funding and Pay stay off until that artifact is approved and re-deployed.

The remainder of this file records the earlier implementation and trial evidence; read it as historical context where it differs from this current status.

---

# Earlier managed Zingolib checkout status — 27 October 2026

## Implementation and release state

PR #22 (`managed-zingolib-checkout`) implements the private Zingolib wallet service, individual encrypted recovery and backup challenges, bounded treasury policy, explicit winner-bound checkout, a durable prepared transaction journal, one-broadcast guard and authenticated scanner-selector outbox. Main has merged the earlier read-only trial as PR #21 (`e1a451b`); this follow-up preserves that work.

The public website has not been updated by this follow-up. Managed funding and Pay remain disabled there and in `/etc/veil-managed/service.json`. The managed service is inactive and disabled at boot. The optional private read-only bridge is active, disabled at boot and restored to its original 25% CPU quota. The original Zallet sender remains stopped. No new transfer, grant, signature or transaction preparation occurred.

## Confirmed staging defect and repair

A legacy host configuration selected a fixed older SDK binary. The release script changed only `binarySha256`, leaving `binary` pointing to that older executable. Consequently the first follow-up restore still ran the old diagnostic code. Commit `987b1468cdc2bcd449bb2cf80ff7bbfe6c05cff2` binds the executable path and actual hash together. The read-only restore now refuses an enabled configuration or a binary/hash mismatch before opening the source wallet. Two synthetic file-based regressions verify replacement of the legacy path and rejection of tampered binaries or an enabled configuration. No recovery material is in those tests.

## Verified provenance and actual funded recovery

The authenticated GitHub connector downloaded the artifact from [pinned build 40519424159](https://github.com/EvanD1st/veil/actions/runs/40519424159) directly to the external E: drive. Archive SHA-256: `0ea5b6c4cd2c8fa534bd510fc43d4775923d48f6221e877ee688ab89392b976b`. The extracted `veil-managed` matched its manifest: `acf66f00ee846f8b03051b027abd98829fdef80d1951a2d71bdb144c54545941`. Its Rust entry point is from `31a5c3673081b9ad8cb3756bc90158925c350419`, unchanged through the staging repair. The host selected source `987b1468cdc2bcd449bb2cf80ff7bbfe6c05cff2`, source archive SHA-256 `b40349bfdd5c92527bcafb5acc3ef7a9050d9a59527731b6fd44034ea812d21e`, and verified the actual configured binary/hash pairing. No local or live-host build occurred.

The corrected binary retained an encrypted SDK cause chain identifying an HTTP/2 stream cancellation. Filtered bridge metrics showed block-range errors, and its cgroup recorded CPU throttling. Pinned SDK source applies a 20-second deadline to these streams. This is consistent with historical fetching exhausting the CPU-limited bridge's stream budget; it is not evidence of wallet corruption or a memory-cap failure.

One bounded diagnostic trial temporarily increased only `veil-managed-indexer.service` from 25% to 75% CPU. Its original quota was restored in a `finally` block. No node/receiver/scanner configuration, readiness validation, SDK deadline, consensus support, original birthday or memory cap changed.

Actual read-only results:

| Check | Result |
| --- | --- |
| Funded historical recovery | Passed in 20.22 seconds; strict SDK synchronization at height 4,548,317, independent recovery true, confirmed 100,000,000 zatoshis (1 TAZ). |
| Resource guard | Minimum MemAvailable 3,167,567,872 bytes; sampled wallet peak 16,891,904 bytes. Sampling is not a sustained-capacity benchmark. |
| Restart recovery | Stopped/restarted only the optional read-only bridge; a fresh wallet process reopened retained encrypted state and passed in 5.07 seconds at height 4,548,319 with the same balance and independent recovery true. Bridge quota was 25%. |
| Preservation | Original sender database hash unchanged in both trials; original birthday 4,541,034 retained; node/receiver/scanner remained active with unchanged restart counters. |
| Transfers | None prepared, signed or broadcast; managed spending stayed disabled. |

Protected evidence remains on AWS at `/var/lib/veil-managed/funded-restore-evidence-1793125941.json` and `funded-restore-evidence-1793125984.json`. These private records are not repository fixtures. Do not copy wallet addresses, raw reports or recovery material into public evidence.

## Automated checks

For repair commit `987b146`, [CI 40559931985](https://github.com/EvanD1st/veil/actions/runs/40559931985) passed both jobs, including production builds, native authentication, managed/browser checks, proof-asset checks and regressions. Local typecheck, focused JavaScript lint, 11 checkout/evidence tests, eight read-only bridge tests and two provenance regressions passed with scratch files on E:. Synthetic wallet/browser fixtures remain distinct from the actual funded read-only observations above. Browser emulation is not physical-device validation.

## Remaining activation sequence

1. Prepare one exact new unpaid Sapling testnet invoice transaction and independently inspect serialized bytes, destination, amount, memo, change, fee and expiry; do not broadcast yet.
2. Present the exact transfer and fee ceiling for separate operator approval. Broadcast once only after approval. Reconcile uncertain outcomes without resending and validate actual output, active-chain confirmations, signed scanner delivery, expiry, restart recovery and protected download entitlement.
3. Record valid funded-signing/checkout evidence for the exact binary. Review the concrete website artifact/configuration and rollback before requesting release approval.
4. Before opening public funding, approve a bounded total testnet allowance. Current proposed caps (0.002 TAZ per grant, 0.0002 TAZ maximum fee, ten users, 0.022 TAZ daily/total) are not approved spending authority. The cold historical-recovery CPU trial does not prove sustained multi-user capacity.

Zallet `0d433b322408c30ee48765a98a81af9001108e7d` plus its separately approved patch remains experimental; failed upstream cargo-vet evidence remains recorded. No audit is implied by these tests. Ordinary external-wallet invoices remain the currently deployed payment path.
