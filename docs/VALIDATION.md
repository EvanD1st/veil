# Validation evidence and completion checklist

Recorded 23 October 2026. Local environment: Windows, Chrome **155.0.8059.85**, Node **24.15.0**, pnpm **11.25.0**, 8 logical CPUs and approximately 7.9 GiB system RAM. Chrome was launched headlessly by Playwright; mobile checks used viewport emulation.

The public baseline's [GitHub CI run](https://github.com/EvanD1st/veil/actions/runs/39872505423) completed successfully at `b59f5703ee8ef5958426e48efd1732830f785f30`. New branch GitHub results appear on the PR; the evidence below is from local execution.

## Live testnet preparation follow-up

Reviewed main `9853bdc7751ab7a89b2b1c4e55f3c7e71bcab128`: [post-merge run 39884208213](https://github.com/EvanD1st/veil/actions/runs/39884208213) passed every existing step, including browser tests. Follow-up implementation is on `live-testnet-setup`.

| Follow-up check actually run | Result |
| --- | --- |
| `pnpm test` | **37 passed**, 0 failed, 40.3 seconds: prior 23 plus 14 scanner/setup/asset regressions |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed; existing bundle-size/browser crypto-externalization notices |
| `node scripts/test-bundle.mjs` | Passed real seal/signature/reveal |
| `node scripts/test-prover-worker.mjs` | Passed real shipped-runtime proof and fixed-key verification |
| `node scripts/check-production-boundary.mjs` | Passed; expected local-test config rejection |
| Git Bash `bash -n scanner/testnet/build.sh` and `--help` | Passed syntax/help only; NOT a Linux Rust build |
| `node scanner/scan.mjs preflight` with current environment | Correctly failed: missing ZALLET_RPC_URL; no key/RPC/payment details printed |
| Read-only deployed-asset check on existing Site | First WASM request returned HTTP **401**; authenticated integrity validation remains pending |
| Windows external drive | E: FAT32, approximately 3.7 GB free; test temporary files used E:\VEIL-test-artifacts. No live node/wallet stored there |
| Protocol/UI/authentication preservation | No changes to app UI, circuits, encryption, fixed verifier/key, pinned assets, signatures/report verification, service permissions or schema migrations |

The new tests are **synthetic, source-derived response shapes**, including a local HTTP stub for cookie authentication/rotation and error redaction. They are not sanitized actual wallet/node recordings. All existing report signature, replay/output reuse, key rotation, expiry, permission and reorg regressions still pass. No new dependencies or lockfile changes were needed. Browser behavior is unchanged; the follow-up PR CI runs the full browser suite again.

Pinned source comparison found beta.3/current Zallet main using zebra-state 12.0.1/v28, incompatible with Zebra 7's v29 state. The selected NU7 Zallet commit uses zebra-state 16.0.0 like Zebra 7.0.0, but remains in an unmerged upstream PR with failed required audits at inspection. Source compatibility is not live validation or audit acceptance. See [exact pins/setup](../scanner/testnet/README.md) and [live/release gates](LIVE_TESTNET.md).

**Still pending:** Linux candidate build, upstream acceptance decision, actual wallet/node responses/sync, future-round ordinary-flow drand, a separately authorized shielded Testnet transfer, authenticated deployed asset hashes and physical-device tests. No deployment, audience change or funds movement occurred.

## Previous implementation local results

| Check | Result |
| --- | --- |
| Frozen offline installation | Passed; lockfile unchanged by installation |
| TypeScript | Passed |
| Service/crypto/recovery/Worker-failure suite | **23 passed**, 0 failed; 44.5–88.3 seconds across final verification runs |
| Production build | Passed |
| Browser encryption bundle check | Passed; real seal/signature/reveal; no separate dynamic tlock chunk |
| Shipped runtime harness | Passed; a real proof verified with the fixed verifier |
| Production authentication boundary | Passed; test-mode build rejected and no test identity/clock/fixture endpoints in built Worker |
| Pinned public and built assets | Sizes and SHA-256 hashes match the existing manifest |
| Protocol preservation | Circuit, encryption, witness/public-input code, fixed verifier/key, vendored verifier and pinned asset files unchanged |
| Playwright full browser suite | **14 passed**, 0 failed, approximately 4.8 minutes |
| Expanded persisted-flow/authentication rerun | **2 passed**, 0 failed, approximately 1.1 minutes; includes separate seller/bidder/observer contexts and payment follow-up |
| Migration/schema agreement | Drizzle reports no further schema changes; local D1 migration initialization passed |

The 14-case suite covers higher/lower/tied guided offers; real browser encryption, unlock, Worker/WASM proving and verification; persisted tie/empty/reserve-unmet outcomes; wrong/missing/restored keys; self/late/duplicate bids and eight-bid limit; invalid envelope rejection and accepted-malformed-envelope blocking; missing/rejected proof publication; lost response after a committed result with exactly one POST; honest unknown status followed by read-only reconciliation; independent result verification; keyboard focus/escape and mobile layout; cancellation; transient retries; cold/cached assets; worker errors/timeouts; and corrupted network/cache assets. The strengthened persisted-flow case additionally confirms that a bidder context has no seller private key, an unrelated observer cannot read payment metadata, a sent-payment note stays unverified, and overdue discussion leaves the winner unchanged.

The 23-test service suite covers exact invoice/signature/confirmation/freshness checks, seller/winner permissions, replay and output reuse, old/new scanner keys, revocation, expiry, follow-up policy and unchanged results. RPC note/sync/reorg scenarios use representative fixtures, not a connected wallet/node.

## Observed browser timings

| Scenario | Measurement |
| --- | --- |
| Guided reveal/prove/verify phases in the full run | Approximately 24.5–25.9 seconds |
| Synthetic witness, cold assets plus two injected HTTP 503 responses | 23.0 seconds |
| First proof using verified persistent cache | 20.1 seconds |
| Repeated proof using verified persistent cache | 20.7 seconds |
| Expanded independent-context persisted flow | 39.5 seconds for the whole scenario, including key recovery and payment follow-up |

Cached runs were checked against server asset-request counters; no new pinned asset downloads occurred. Cached bytes are still size/hash verified. Corrupt cached content stops the current attempt and is removed; a later explicit retry can fetch a fresh asset. Storage failure falls back to verified network loading.

These are observations from one constrained workstation, not a hardware-independent guarantee. Tests ran sequentially; proof generation requires substantial memory. Earlier development runs exposed missing cache reuse and keyboard focus restoration and were corrected. The final suite passed with source files held stable to avoid dev hot reload interfering with running scenarios. The mobile screenshot was visually inspected at 390×844; focus was visible and the modal fit the viewport. This is **not** physical-mobile performance/accessibility certification.

## Completion checklist

- [x] Dedicated implementation branch and reviewable changes; existing CI extended.
- [x] Actual browser Worker/WASM/proof tests and local-only multi-user setup.
- [x] Local initialization/migrations documented and tested.
- [x] Download/proving progress, verified asset cache, bounded retry and cancellation.
- [x] Publication lost-response regression, conflict/unknown handling and read-only recovery.
- [x] Additive non-payment follow-up with explicit non-enforcement and legacy compatibility.
- [x] Manual scanner retained; signature, rotation, replay, expiry and revocation tests.
- [x] Existing Sites target and trusted-header boundary documented; production mock hooks excluded.
- [x] Architecture, reproducible demo script, public-source/CI status and protocol limitations documented.
- [ ] Live future-round drand/browser validation through ordinary deployment settings.
- [ ] Physical mobile-device proof-time and memory measurements.
- [ ] Actual shielded testnet transfer with synchronized Zallet/Zebra and a real receiving wallet.
- [ ] Independent circuit/verifier security audit and any resulting protocol work.
- [ ] Current event/submission-rule verification and final recorded submission materials.

No deployment, audience change, mainnet/testnet transaction or movement of funds was performed. No live wallet RPC endpoints, scanner signing key file or trusted public key are configured on this workstation; Zallet/Zebra executables were not detected on PATH. Follow `PAYMENTS.md` and `scanner/README.md` for the exact external validation procedure. Do not substitute a synthetic receiver, fixture RPC report, proof success or payment QR for a live transfer.
