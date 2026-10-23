# Validation evidence and completion checklist

Recorded 23 October 2026. Local environment: Windows, Chrome **155.0.8059.85**, Node **24.15.0**, pnpm **11.25.0**, 8 logical CPUs and approximately 7.9 GiB system RAM. Chrome was launched headlessly by Playwright; mobile checks used viewport emulation.

The public baseline's [GitHub CI run](https://github.com/EvanD1st/veil/actions/runs/39872505423) completed successfully at `b59f5703ee8ef5958426e48efd1732830f785f30`. New branch GitHub results appear on the PR; the evidence below is from local execution.

## Actual local results

| Check | Result |
| --- | --- |
| Frozen offline installation | Passed; lockfile unchanged by installation |
| TypeScript | Passed |
| Service/crypto/recovery/Worker-failure suite | **23 passed**, 0 failed; approximately 44.5 seconds in the final run |
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
