# VEIL — Codex handoff

Prepared 21 October 2026. Target repository: https://github.com/EvanD1st/veil.git

## Start here

Continue the existing application. Preserve its ivory/sage auction-house design, real encryption, strict result verification, and explicit prototype limitations. Do not rebuild a cosmetic demo or replace real cryptography with simulated success states.

Read this document, `README.md`, and `scanner/README.md`, then reproduce the checks below. First finish real browser and testnet-payment validation. Keep a clear distinction between proof-verified auction selection and trusted-scanner payment confirmation.

## Baseline and evidence

- Deployed source commit: `7243a5f457bb2140f95d5b7bff04520357b0a48c`.
- Review site: https://veil-private-auctions.softball129.chatgpt.site
- Site project: `appgprj_6ad60ddb6cc08191adf85da59c23c6aa`.
- Last successful deployment: `appgdep_6ad88ec3c8e48191bb1e2400dcadde0f`.
- Access remains owner-only. A GitHub push does not change the Site's audience or configure GitHub deployment.
- Prior implementation run: all 16 tests passed; TypeScript and production build passed. The bundled tlock encryption/reveal test and shipped browser-prover runtime harness passed. A real PLONK proof passed both the original snarkjs verifier and VEIL's pure-JavaScript verifier.
- After publishing, the homepage, app bundle, proof worker, snarkjs runtime, WASM and all four proving-key chunks returned HTTP 200. Asset bytes matched the built output.
- Browser automation timed out before interaction. No claim of completed browser click-through or mobile testing.
- No live Zallet/Zebra receiving wallet, trusted scanner public key, or real testnet payment was configured. Scanner tests use RPC fixtures. No money moved.
- Workspace maintenance removed the original local checkout after deployment. This handoff was prepared from the saved source restored at the exact deployed commit. No implementation tests were rerun solely for this documentation/export task.

## Implemented

- Persisted auctions and one final bid per participant; fixed deadline, reserve, seller key and optional Sapling testnet receiver.
- Browser AES-GCM encryption wrapped with seller RSA-OAEP, then tlock encryption to a pinned drand quicknet round strictly after the deadline.
- Seller key backup/import, acceptance receipts, public commitment log and snapshot hashes. Self-bids and late bids are rejected.
- Version 2 Poseidon commitments; an eight-bid Circom/PLONK proof checks every recorded bid, reserve, maximum amount, earliest-acceptance tie-break and no-winner outcome. The server fixes public inputs from its database and rejects invalid proofs.
- Browser-local guided demo with three bidders, actual encryption, time lock, proof generation and proof verification.
- Version 1 auctions keep their original format and explicit seller-declared label.
- ZIP 321 testnet payment QR/link, exact invoice, local read-only scanner, Ed25519 report verification, private seller/winner payment status, expiry/revocation and output-reuse protection.
- Schema-only migrations, protocol/security documentation, original artwork, license notices and reproducible circuit tooling.

## Remaining work, in order

### 1. Reproduce a clean checkout and run actual browser QA

Use Node 24 for the test suite (`node:sqlite`) and the package manager pinned in `package.json`; preserve `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/test-bundle.mjs
node scripts/test-prover-worker.mjs
pnpm dev
```

The clone defaults to the portable execution profile. No `.sites-runtime` contents are required from this session. Tests reconstruct the WASM/key test files from committed public assets. Negative circuit tests intentionally print constraint errors.

Check:

- The guided demo from seal through unlock, proof generation and reveal; lower offer, higher offer and tie.
- Fresh and cached proof-asset downloads, retries after network interruption, worker failure/timeout and absence of false success labels.
- Persisted create/bid/reveal/result using a seller plus distinct bidder identities. Use an appropriate local test identity setup or an explicitly authorized Site audience change; the current owner-only Site cannot supply independent real participants.
- Wrong key, key restore, deadline boundaries, no bids, reserve unmet, eight-bid limit, invalid envelope and proof rejection.
- Result re-verification and exported auction/log/proof data.
- Responsive layout, keyboard navigation and mobile memory/performance. The first proof downloads roughly 80 MB and may be unsuitable for low-memory devices.

Done when: a recorded browser walkthrough completes the happy path, meaningful failures stay recoverable, and actual devices' proof times/memory limits are documented. A JS runtime harness does not satisfy browser QA.

### 2. Complete one real shielded testnet payment

Follow `scanner/README.md`. Run a synchronized Zallet receiving/viewing wallet and Zebra testnet node. Use an actual Sapling testnet receiving address belonging to that wallet.

- Generate the scanner Ed25519 key on the scanner machine. Keep the private key and wallet/viewing keys local.
- Set only `VEIL_SCANNER_PUBLIC_KEY` in the hosted app's environment. This must be the operator-trusted public key, never a bidder-provided key.
- Create and close an auction; download its exact invoice.
- Send the exact testnet amount and memo from a compatible wallet. Do not use mainnet or real funds.
- After at least three confirmations, scan the specified transaction/output and upload the signed report within five minutes.
- Verify seller/winner access, rejection of unrelated users, wrong memo/amount/address, stale report, untrusted signature and replay.
- Verify status expires without refresh. Exercise rescan/reorg behavior against a controlled test setup; never infer that a one-time scan guarantees permanent finality.

Done when: an actual shielded testnet transfer reaches scanner-confirmed status with recorded evidence of the incoming output checks. A txid or QR alone is insufficient.

### 3. Make payment recovery usable

Current limitations are intentional and visible, but need a product decision and implementation:

- Reports are manually generated/imported and valid for five minutes; there is no automatic polling service.
- Each invoice tracks one selected Sapling output. Different replacement outputs, split payments and overpayments are unsupported.
- Define a non-payment timeout and seller/winner next step. There is no escrow, deposit, refund or automatic second-place award.
- If adding a hosted scanner/report-delivery service, keep wallet RPC private, protect the signing key, authenticate submissions, preserve invoice/output binding, and support revocation/key rotation. Do not turn a scanner outage into a paid state.

Done when: users can tell whether to wait, rescan, retry or resolve non-payment, and confirmation cannot silently remain current after its evidence expires.

### 4. Review the auction protocol before adversarial use

A real highest-bid proof is implemented, but the application is unaudited. Review the circuit and the adapted PLONK verifier independently, with reproducible fixtures and reference-verifier comparisons.

Known limits to resolve or explicitly retain:

- Malformed ciphertext can prevent the tally: submit-time consistency between ciphertext and commitment is not proved. Never silently discard an accepted bid. Design a consistency proof or a specified exclusion/dispute protocol before changing this behavior.
- The seller can refuse to reveal, lose their key or disclose losing bids. Highest-bid correctness does not provide availability or privacy from the seller after close.
- The host can censor submissions or present different logs. The proof covers the recorded list; it does not independently establish acceptance completeness or order. Consider an external log anchor/receipt mechanism if that is a project requirement.
- Preserve the reserve, amount bounds, tie-break, context binding, zero padding, fixed verification key and full-log public input derivation.
- Circuit/commitment changes need a new protocol/circuit version and migration plan. Never reinterpret existing sealed bids using a changed circuit.

Done when: review findings are addressed or documented with precise scope; do not call the system audited merely because tests pass.

### 5. Establish GitHub CI and deployment ownership

- Add CI for typecheck, the real tests, production build and the existing bundle/prover checks. Use Node 24; preserve lockfile installation. Avoid publishing private data in logs or artifacts.
- Decide whether deployment remains on Sites or moves elsewhere. Pushing to GitHub does not migrate D1 data, user identities, environment variables or the live site.
- If retaining Sites, preserve `.openai/hosting.json`, Site identity, private audience and schema migration history; explicitly coordinate source synchronization.
- If deploying independently, replace/secure the Sites-specific identity boundary in `app/chatgpt-auth.ts`. Do not trust client-supplied `oai-authenticated-*` headers on a public server. Keep mock authentication local-only, configure D1 and scanner public key, and apply migrations deliberately.
- Confirm clean-clone development and document database initialization and multi-user local testing for the chosen environment.

### 6. Finish the hackathon submission package

- Confirm the current event's category, rules and submission requirements directly before final submission; do not rely on the earlier category label as current verification.
- Prepare a concise problem/solution pitch, architecture explanation, demo video, repo link and reproducible testnet demo instructions.
- Clearly distinguish: real ZK winner proof; losing bids visible to seller after close; trusted scanner payment attestation; no escrow or delivery enforcement.
- Confirm intended repository visibility and corresponding-source availability. Original source retains its MIT notice, while the combined app includes GPL-3.0-or-later snarkjs code/runtime. Preserve `LICENSE-GPL-3.0`, vendored notices and source references; resolve distribution obligations before submission.

## Source map

| Area | Files |
| --- | --- |
| Main UI and guided demo | `app/veil-app.tsx`, `app/globals.css` |
| Payment UI | `app/payment-status.tsx` |
| Amounts, commitments, context, ZIP 321 | `lib/veil/core.ts` |
| Seller encryption and drand envelopes | `lib/veil/crypto.ts` |
| Auth, API rules, SQL and result/payment persistence | `lib/veil/server.ts`, `app/chatgpt-auth.ts`, `app/api/` |
| Circuit | `circuits/auction.circom` |
| Witness/public inputs and verifier | `lib/veil/zk/protocol.ts`, `verify.ts`, `vendor/` |
| Browser prover and pinned assets | `lib/veil/zk/client.ts`, `assets.json`, `public/zk/` |
| Payment report validation | `lib/veil/payment.ts` |
| Local scanner and operator guide | `scanner/scan.mjs`, `scanner/README.md` |
| Database | `db/schema.ts`, `drizzle/` |
| Tests and circuit reproduction | `tests/veil.test.cjs`, `scripts/test*.mjs`, `scripts/build-circuit.mjs`, `scripts/zk-assets.mjs` |

## Cryptographic assets and secrets

Proving-key chunks, the verification key and circuit WASM are public artifacts, not private wallet keys. They are deliberately committed (each chunk under 25 MB). Do not remove them without implementing a reliable integrity-checked distribution path. Rebuild using the pinned public ceremony and `scripts/build-circuit.mjs`, not a new local trusted setup disguised as the same protocol.

Do not commit `.env` files, signing/private auction keys, wallet/viewing keys, RPC cookies, credentials, local database state or real payment reports. The repository excludes checkout-local runtime and output directories. Production auction keys belong to the user's browser/backups and are not in the source repository.

## Suggested first instruction to Codex

Continue VEIL from this repository. Read HANDOFF.md, README.md and scanner/README.md. Reproduce the current checks, then complete real browser QA and a shielded testnet payment using the existing scanner. Preserve the UI, v1/v2 compatibility, full-log proof checks and honest status labels. Report actual verification evidence and any external setup still needed. Do not introduce fake payment success or silently drop malformed bids.
