# VEIL — Implementation handoff

## 27 October: judging website deployed; Zingolib isolated trial

PR #20 merged as main13ef1d4 with green post-merge CI. Its source tree equals tested artifactac03212, which is now deployed after a fresh matched backup, migration0007, integrity/count checks and 2.54-second interruption. Hosted authentication, scanner boundary, ten-family catalogue and all six proof hashes passed. Automatic editions and managed funding/Pay remain disabled. Read [exact release, rollback and live Zingolib evidence](docs/ZINGOLIB_TRIAL_2026-10-27.md). The separate SDK trial passed actual private lightwallet connectivity, two new unfunded wallet recoveries, synchronization and restart. It does not validate outgoing spending or activate the website wallet. Existing Zebra/Zallet/scanner and failed Zallet cargo-vet evidence remain unchanged. Earlier undeployed-candidate and compatibility findings below are historical.

## Genesis judging candidate — 26 October 2026

Branch `self-service-judging` starts from merged/deployed main `cb5ab9f` (CI 40368462337 passed). The website inspection confirms this source is live with migration 0006; older release descriptions below are historical. This follow-up prepares selected Genesis previews/private import, bounded normal auctions/editions, a separate supervised automatic-reveal worker and private wallet request/treasury recovery contracts. **Managed wallet provisioning, starter funding and managed checkout remain disabled**, with the exact installed standalone-key/PCZT recovery blocker documented in [self-service judging](docs/SELF_SERVICE_JUDGING.md). Additive migration 0007 is required. No new deployment, wallet/sync/service change or payment occurs. Originals stay outside Git; no synthetic balance or result is a live payment. Exact final CI and candidate hashes belong in the PR.

## Supplied UI references — 26 October 2026

`ui-reference-refresh` starts from merged PR #17 / main `abc2986` and adapts the two supplied HTML designs to the real native authentication and auction workspace. See [visual scope, security and validation](docs/UI_REFERENCE_REFRESH.md). No deployment, database change, payment or wallet/node/scanner change occurs. Existing digital release requirements remain in force; earlier candidate descriptions below are dated observations.

## Digital-goods candidate — 26 October 2026

Branch `digital-goods-delivery` preserves PR #16 head `b50b43f` and current main `5a20843` (upstream merges of PRs #15/#16). PR #17 now targets main. Do not merge or deploy automatically. New private uploads, immutable digital terms, atomic payment entitlements and protected downloads are prepared with migration 0006. The ivory/gold redesign covers authentication and the auction workspace. Legacy listings, proof assets/context, account IDs and scanner checks are preserved; new escrow and execution remain disabled. Read [digital behavior/recovery](docs/DIGITAL_GOODS.md), [candidate release gates](docs/DIGITAL_RELEASE.md) and [judge walkthrough](docs/JUDGING.md) first. Earlier sections below are dated history.

Implementation snapshot `65a8399` passed both CI jobs, including actual file uploads, two real bidder accounts, live future drand, synthetic signed-report delivery, exact-byte winning downloads, losing-bidder/outsider denial and an actual application process restart. The corrected candidate passed the isolated Ubuntu smoke test (349.8 MiB peak under 448 MiB) and migration 0006 on a fresh consistent live-database copy with all 16 original table counts preserved. The exact final candidate and private staging/migration-copy observations are recorded in PR #17; do not equate synthetic report acceptance with a new live payment.

Observed live before changes: two legacy Design/direct listings, two results, one report, zero escrow orders. No production rows were modified. No legacy payment is reused for a digital grant. The current public website remains the previously approved 577c90d artifact. The new hosted payment/download and new phone upload/purchase flow remain pending; earlier phone and incoming-payment evidence must not be relabelled as digital-delivery validation. Node/wallet/scanner configuration and unrelated services stay untouched.

Updated 26 October 2026. Repository: https://github.com/EvanD1st/veil.

Latest approved website release: PR #16's tested merge-tree artifact `577c90dfe566de35aaff7a8d8e4ab99da3233123` is deployed at https://ve-il.duckdns.org. Restart/health took 1.91 seconds; no migration, counts preserved, fresh backup/integrity passed. Public authentication, six proof assets and current automatic confirmation passed afterward. The sender's corrected limits survived reload/stop/start; strict readiness and read-only balance passed. Its bounded trial is complete and the optional sender is intentionally stopped/boot-disabled, with successful integrity and a protected off-host backup. The receiving wallet/node/scanner remain active. No new payment or PR merge occurred. See the dated execution record below; older release descriptions are historical.

26 October follow-up: the operator confirmed the actual Redmi phone workflow worked; versions and measured proof timings were not supplied. PR #16's first exact head passed both CI jobs. Fresh hosted authentication/assets and current automatic confirmation passed. The sender's longer batch-100 trial OOMed repeatedly; a bounded no-retry trial with reviewed memory headroom subsequently passed strict synchronization and read-only 1 TAZ balance checks. Stability/outgoing spending remain separate gates. See [dated observations and limitations](docs/PAYMENT_VALIDATION_2026-10-25.md). No new payment or website deployment occurred.

25 October follow-up: see [actual payment evidence, sender memory recovery and physical-device status](docs/PAYMENT_VALIDATION_2026-10-25.md). An exact faucet-funded incoming invoice, automatic signed delivery, expiry and recovery passed. The independent sender is testing a smaller supported history-recovery batch without changing its binary or readiness. Redmi K30 Pro forms/bidding were reported by the operator; proof/device measurements remain pending. New application wording requires a reviewed release; historical deployment and readiness descriptions below are not current status.

24 October code review: `review-auth-payment-escrow` fixes full-origin comparison for supplied API Origin headers, publication-anchored delivery deadlines for new escrow orders, the frozen refund control after disputes/cancelled intents and unauthorized lazy order creation by rejected viewers. No migration or live changes. See [findings, regressions and workstation validation limits](docs/CODE_REVIEW_2026-10-24.md). Escrow creation/spending remain disabled; release and wallet readiness are independent gates.

24 October follow-up: branch `public-signup` / PR #5 adds native public registration, login-first browser entry, preserved API/scanner authentication, administrator-only account lists and compatible existing sessions without a schema migration. See [account access and rollback](docs/ACCOUNTS.md). This follow-up does not deploy, merge, touch synchronization, activate scanner delivery or send funds. The live website remains on its previously approved release until a new exact-artifact approval.

## Experimental escrow implementation (disabled)

Branch `experimental-testnet-escrow` adds additive migration 0005, immutable terms/custody bindings, private fulfillment and disputes, durable deposit claims/observations, atomic release/refund intents and a hard-disabled live executor boundary. See [design, capability evidence and recovery gates](docs/EXPERIMENTAL_ESCROW.md). No deployment, wallet/sync changes or transfer. Synthetic fixtures are not live payment evidence. Preserve every obligation during rollback; do not run an older reader that mislabels escrow auctions as direct payments.

## Current AWS testnet and verification work

Current release: the operator approved website source `59c35c5e2bd8ed6c2cb68caa9ace2be23b937200`, now deployed with queue migration 0004, a fresh integrity-checked backup and preserved account/auction/bid/payment counts. Scanner public settings are staged separately; live queue/delivery configuration remains disabled pending synchronized readiness. Synchronization is explicitly outside this follow-up's mutation scope. See [hosted validation](docs/HOSTED_VALIDATION.md) for current checks and remaining payment/physical-device gates. Older observations below are historical.

Branch `testnet-payment-service` starts from merged main `dfef40e03798129c3041e7b298fbb46db3b4df97`; draft PR #4 contains supervised exact-output payment verification, bounded proof-download fixes, real native authentication/browser checks and isolated testnet service templates. See [current execution evidence](docs/TESTNET_SERVICE.md) for source/binary hashes, failed upstream vetting evidence, actual host resources, CI results and release/rollback preparation. Candidate `e53b9951071280b4a030121365ffe55d968e7b14` passed both jobs in CI run 39971210295. The website remains on its existing deployed source; no release, database change or payment has been authorized by the experimental installation approval.

The operator separately approved and installed the exact minimum-pool patch on the experimental Zallet base. Actual status/account RPC now responds; a backed-up account and real Sapling testnet receiver were derived and validated privately. Repeat whole-host reboot passed with zero node/wallet failure restarts, preserved account/address and clean patched-wallet shutdown. At the latest observation Zebra was at height 4,104,032, reporting about 96.8% initial-download progress; wallet status remained locked with incomplete scan fields. Strict readiness therefore remains pending and the scanner stays disabled. No website release or payment occurred. See the execution record for exact source, patch and binary hashes.

Upstream PR #898 remains open at newer head `8c5a93ba9d68ad78d199c3624413c0139781b837`. Its backend dependency-vetting job still fails: seven versions lack safe-to-deploy coverage. It does not include the local pool fix. The installed approved base/patch has not been silently replaced. CI at `2da776371de04d5c62ba2988d5f436aee27fdc5b` passed, including four startup-barrier and two monitoring regressions. Remaining live gates are full synchronization/preflight, separately approved website release, hosted separate-account auction, approved shielded transfer/output verification, and actual physical-device testing.
## Ubuntu website deployed

Current baseline: merged PR #2, main `73e1aa4b2c4057481c78b16c16622631268ed4c5`; post-merge CI run 39925988928 passed. Branch `integration-evidence` adds a separate Node/SQLite/session-auth target for the owner-authorized Ubuntu website move. No local build is permitted; build and artifact validation run in CI. The website is deployed at https://ve-il.duckdns.org from `09ca59eaebfda7467ba569369ffa7554245bb169`; both jobs in CI run 39936389121 passed. Existing Sites deployment/data remain intact for rollback. Deployment hashes, isolation checks, backups and remaining live gates are recorded in docs/DEPLOYMENT.md and docs/VALIDATION.md. See `deploy/ubuntu/README.md`. A fresh guided browser demo passed live future-round drand, proof generation and independent verification with ordinary clocks; its sample bidders do not establish separate-account publication. Initial cold download timed out; the fresh cached demo passed. The wallet/node compatibility gate is independent and remains unresolved.

## Previous live testnet preparation follow-up

Reviewed main `9853bdc7751ab7a89b2b1c4e55f3c7e71bcab128`; its post-merge CI passed (run 39884208213). Historical merged work used `live-testnet-setup` (do not continue it) with pinned experimental Linux lab scripts, read-only scanner preflight, Zebra cookie authentication and stricter node/invoice/schema checks. See [LIVE_TESTNET.md](docs/LIVE_TESTNET.md) and [scanner/testnet/README.md](scanner/testnet/README.md) for exact pins and gates. The Zallet NU7 source is an unmerged upstream PR with failed required audit checks at inspection; published beta.3 must not be paired with Zebra 7’s v29 state. No live build/sync/payment or deployment is claimed. Existing UI/crypto/assets/authentication/report trust remain unchanged.

## Previous implementation scope

Baseline `main` is `b59f5703ee8ef5958426e48efd1732830f785f30`. Its GitHub CI passed frozen installation, typecheck, all 16 original tests, production build, bundle encryption checks and the shipped prover harness. The source repository is public. The existing hosted Site audience is a separate owner-only setting.

Implementation continues on branch `finish-hackathon`. Do not recover/recreate the source or rebuild the UI as a cosmetic demonstration. Keep the ivory/sage design, real encryption, v1/v2 compatibility, pinned assets and fixed verification key. The circuit, commitments, full-log public inputs, amount/reserve bounds and tie-break semantics are unchanged.

## Changes in this branch

- Playwright end-to-end tests using actual Chrome/Chromium Workers, WASM, runtime and proving keys. Tests use a clearly labelled signed quicknet round-1000 fixture and separate local seller/bidder identities.
- Loopback-only, explicitly enabled isolated test server and local D1 migration commands. Production rejects test mode and excludes the test identity, clock and fixture endpoints.
- Download byte progress, two bounded transient retries, integrity checks on every asset and actual PLONK round progress. Cancellation terminates the Worker and leaves the UI usable. No raw witness/prover logs are exposed.
- Single-attempt publication and read-only reconciliation after lost responses. Stored auction/context/log/result and the fixed-key proof must match. Conflict and unknown states remain visible; status checks never repeat publication. Pending attempts survive page reload within the browser session.
- Additive migration 0003: optional payment follow-up window and private follow-up actions. Existing auctions retain no deadline. New auctions may choose 24/48/72 hours or none. Reporting that payment was sent is unverified; an overdue follow-up never changes the winner or result.
- Tests for response loss after a server commit, invalid publication labels, scanner key rotation/revocation, role permissions and failure handling. CI extends the existing workflow with browser and production-boundary checks.
- Local setup, architecture, deployment, manual scanner validation procedure, demo script and current validation checklist under `docs/`.

See [validation evidence](docs/VALIDATION.md) for exact completed checks and remaining external validation. Do not turn harness/fixture results into claims of live drand, physical-device or live-payment validation.

## Run locally

Use Node 24 and the pnpm version pinned in `package.json`; preserve the lockfile.

```sh
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

See [local testing](docs/LOCAL_TESTING.md) for isolated identities, clock, migration state and browser tests. Tests must use the isolated local database, never production. Generated keys, scanner reports, cookies and local database state must not be committed.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/test-bundle.mjs
node scripts/test-prover-worker.mjs
node scripts/check-production-boundary.mjs
pnpm test:e2e
```

Expected negative circuit tests print constraint errors. The prover harness is a JS runtime harness, separate from browser click-through tests. Browser viewport emulation is separate from physical-device performance testing.

## Deployment boundary

The deployed source baseline remains `7243a5f457bb2140f95d5b7bff04520357b0a48c`; this branch does not deploy.

- Existing Site: https://veil-private-auctions.softball129.chatgpt.site
- Site project: `appgprj_6ad60ddb6cc08191adf85da59c23c6aa`
- Last documented deployment: `appgdep_6ad88ec3c8e48191bb1e2400dcadde0f`

Preserve `.openai/hosting.json`, Site identity, D1 `DB` binding, private audience and migration history. GitHub CI/push does not synchronize source, deploy the Site or migrate its data. Follow [deployment instructions](docs/DEPLOYMENT.md). The Sites gateway must authenticate users and overwrite caller-supplied authenticated-user headers. Do not expose a raw standalone server trusting those headers.

## External work remaining

1. Validate future-round/live drand availability through the ordinary hosted/local flow. The deterministic suite verifies a real old signature but intentionally controls availability and clock.
2. Measure actual mobile-device proof time, memory and keyboard/accessibility behavior. Viewport checks alone do not satisfy this.
3. Complete one actual shielded testnet payment with synchronized Zallet/Zebra, a real receiving address, compatible sending wallet and trusted scanner key. This workstation has no such RPC/key configuration or executables detected on PATH. Follow [the private operator procedure](docs/PAYMENTS.md) and `scanner/README.md`; record actual software versions and do not commit sensitive payment data. No funds are moved by this implementation task.
4. Independently review/audit the circuit and adapted PLONK verifier before adversarial use. Existing comparison fixtures and passing tests are not an audit.
5. Confirm the current hackathon's rules/category/submission requirements before submission. Record a demo video and the actual external test evidence. No final submission is made here.

## Protocol and product limitations to retain

- Seller can see losing bids after close, refuse reveal, lose keys or disclose amounts.
- A malformed accepted ciphertext blocks tally. Never drop an accepted bid to manufacture a successful proof; submission-time consistency is not proved.
- Host controls acceptance/order and can censor/equivocate. Proofs cover the complete recorded log, not an independently anchored complete submission set.
- Scanner confirmation trusts the configured wallet/operator's attestation. Reports expire, key rotation invalidates old signatures, and fresh non-confirmation reports revoke confirmation. There is no continuous chain monitor.
- One exact Sapling testnet output per invoice. No split/overpayment/replacement-output workflow, mainnet or Unified Addresses.
- No escrow, automatic transfer, second-place award, cancellation/refund, anonymity guarantee or delivery enforcement.
- New circuit/commitment semantics require explicit protocol versioning and migration planning.

## Source and license map

UI: `app/veil-app.tsx`, `app/payment-status.tsx`, `app/globals.css`. Service/permissions: `lib/veil/server.ts`, `app/chatgpt-auth.ts`. Recovery: `lib/veil/publication.ts`. Proof: `lib/veil/zk/`, `public/zk/prover-worker.js`, `circuits/auction.circom`. Scanner: `scanner/scan.mjs`. Database: `db/schema.ts`, `drizzle/`. Tests: `tests/`, `scripts/test*.mjs`.

Public proving-key chunks, verification key and WASM are deliberately committed public artifacts. Keep their size/hash checks and pinned public ceremony. Do not replace them with a new trusted setup under the old circuit ID.

Preserve the original MIT notice, GPL-3.0-or-later snarkjs runtime/source notices, `LICENSE-GPL-3.0`, vendored attributions and corresponding-source availability. Never commit environment secrets, auction private keys, wallet/viewing keys, scanner signing keys, RPC credentials or real payment reports.


Escrow PCZT follow-up: a default-closed isolated-account preparation/recovery adapter now exists with source-derived tests and read-only live RPC-discovery evidence. Shared-account note selection remains unsupported; live funding/signing/broadcast and authenticated intent-worker activation remain pending a separately approved isolated trial. Merge/deploy may ship only the disabled website workflow, not activate custody or spending. See `docs/EXPERIMENTAL_ESCROW.md`.
