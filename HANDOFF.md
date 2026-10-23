# VEIL — Implementation handoff

Updated 23 October 2026. Repository: https://github.com/EvanD1st/veil.

## Ubuntu website deployed

Current baseline: merged PR #2, main `73e1aa4b2c4057481c78b16c16622631268ed4c5`; post-merge CI run 39925988928 passed. Branch `integration-evidence` adds a separate Node/SQLite/session-auth target for the owner-authorized Ubuntu website move. No local build is permitted; build and artifact validation run in CI. The website is deployed at https://ve-il.duckdns.org from `09ca59eaebfda7467ba569369ffa7554245bb169`; both jobs in CI run 39936389121 passed. Existing Sites deployment/data remain intact for rollback. Deployment hashes, isolation checks, backups and remaining live gates are recorded in docs/DEPLOYMENT.md and docs/VALIDATION.md. See `deploy/ubuntu/README.md`. The wallet/node compatibility gate is independent and remains unresolved.

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
