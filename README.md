# VEIL

**Bid privately. Prove the winner. Pay with Zcash.**

An experimental private auction house for Zecathon. Browser encryption and drand keep bids sealed until close. New auctions use a zero-knowledge highest-bid proof. A separate read-only wallet scanner can attest to an exact shielded testnet payment. Gallery objects are fictional sample lots.

## Try it

1. Choose **Try a sealed auction**, enter an offer, and seal three bids. The two other bidders are simulated locally; the encryption and proof are real.
2. Wait about 20 seconds for the drand unlock time, then **Open as seller**. The browser decrypts all envelopes, generates a PLONK proof, and verifies it. Only the winning amount is displayed. The first proof downloads about 80 MB of integrity-checked assets; a desktop browser is recommended. Local measured proving time was about 27 seconds, not a device-independent guarantee.
3. Create a test auction and keep its downloaded private auction-key backup. It is not a wallet key. New auctions allow eight bids, one final bid per signed-in participant.
4. After close, open every envelope in Seller studio. Publishing sends the proof and winning opening. The server derives the expected inputs from its complete accepted log and verifies the proof before storing a result. Anyone in the workspace can verify that result again.
5. A winner can prepare a ZIP 321 payment link/QR for the seller's Sapling testnet address. Seller and winner can download the invoice and import a signed scanner report. **No live wallet scanner is configured in this deployment; payment remains unverified until one is connected.**

The hosted workspace remains owner-only. Sellers cannot bid on their own persisted listings; use the browser-local demo to review both roles. Sharing with other participants requires a separate audience change.

## Proof protocol

Version 2 uses Circom 2.2.2, circomlib 2.0.5, and snarkjs 0.7.6 PLONK on BN254. The circuit is `circuits/auction.circom` (8 slots, 21 public inputs). It verifies:

- Every active bid's Poseidon commitment to auction context, bid UUID, amount and random field salt.
- Integer zatoshi amounts in 1..100,000,000,000,000; the same bound for the reserve.
- Zero padding for unused slots and the full active count.
- Highest eligible amount; first accepted bid wins ties. No eligible bid gives winner index and price zero.

Public inputs, in order: context, reserve, count, one-based winner index (or zero), winning amount (or zero), eight UUID integers, eight commitment field elements. The server fixes the list in acceptance order. Amounts and salts are private witnesses. The context hashes the version/circuit identifier, auction ID, reserve, deadline, drand round, seller public key, payment address and testnet domain. The normal result exposes only the winning opening and proof.

The prover runs in a dedicated browser worker. The shipped WASM, proving key chunks and snarkjs runtime are checked against pinned SHA-256 hashes before use. The server never accepts a caller-supplied verification key. Server and client verification use the snarkjs 0.7.6 PLONK algebra with a pure-JavaScript @noble/curves BN254 adapter, avoiding runtime WASM compilation in Cloudflare Workers. A real proof was cross-checked with the unmodified snarkjs verifier. The adapter and circuit are experimental and unaudited.

The key uses the public Hermez/Perpetual Powers of Tau power-15 ceremony, not a locally generated trusted setup. The downloaded public mirror is accepted only if its BLAKE2b-512 equals the hash published by snarkjs:

```
982372c867d229c236091f767e703253249a9b432c1710b4f326306bfa2428a17b06240359606cfe4d580b10a5a1f63fbed499527069c18ae17060472969ae6e
```

Reproduce with `node scripts/build-circuit.mjs`. The O1 circuit compilation produces 11,757 PLONK constraints (domain 16,384). No additional circuit-specific secret ceremony is used. Soundness still relies on the universal ceremony's assumptions. Proof assets and the fixed verification key are committed so ordinary app builds do not need the compiler or ceremony download.

Legacy version-1 auctions keep SHA-256 commitments and explicitly **seller-declared** results; they are never relabelled as proof verified.

## Payment scanner

See [scanner/README.md](scanner/README.md), the [pinned Linux testnet lab](scanner/testnet/README.md), and [live demonstration/release gates](docs/LIVE_TESTNET.md). The local Node bridge uses Zallet `getwalletstatus` / `z_viewtransaction` and Zebra's active-chain RPC. The receiving wallet must have viewing access to the seller's Sapling address and be fully synchronized. The bridge checks the incoming output's exact address, integer amount, 512-byte memo, block inclusion, active block hash and at least three confirmations. It refuses an unsynchronized/locked wallet or a changing tip.

A separate Ed25519 key signs a five-minute report. Configure only its **public key** as the Site environment variable `VEIL_SCANNER_PUBLIC_KEY`. Wallet/viewing keys, signing private key and local RPC credentials stay off the Site. Seller/winner upload the signed report; the server checks its trusted signature, invoice binding, confirmations, clock, expiry, monotonic timestamp and output reuse. Payment metadata is visible only to those two roles. A stale report becomes **needs refresh**; a fresh non-confirmation report revokes the prior confirmation. This is a manual rescan flow, not a continuous chain monitor. Each invoice tracks one selected Sapling output; replacing it with a different output is not supported in this prototype.

**Scanner-confirmed means a trusted scanner attestation, not a zero-knowledge proof of payment.** A compromised scanner key or dishonest scanner can lie. No real testnet transfer or live wallet RPC integration was available in this environment; tests use representative RPC fixtures and exercise the actual scanner/signature/database code. Real-wallet validation remains required before treating the integration as complete.

New auctions can set an explicit payment follow-up window. Overdue follow-up and expired scanner evidence are separate; neither changes the winner or implies escrow/refund. See [the payment workflow](docs/PAYMENTS.md).

## Boundaries and recovery

- The proof establishes highest-bid selection within the **recorded log**. It does not establish that every attempted submission was accepted, stop host censorship/equivocation, or independently anchor acceptance order.
- The seller can read every amount after close, disclose losing bids, lose their key, or refuse to publish. The proof does not force availability.
- A malformed encrypted bid can block the tally. Submit-time encryption/commitment consistency is not proved. The app stops rather than dropping an invalid envelope.
- drand's pinned quicknet threshold network must remain honest and available. An outer tlock envelope unlocks strictly after close; a seller RSA-OAEP key is still needed for the AES-GCM inner envelope.
- Private auction keys are stored in browser local storage and downloaded backups. Device/origin compromise can reveal them and openings. No server recovery exists. Keep backups private.
- Hosting authentication associates accounts with bids; connection metadata is not hidden. This is not an anonymity network or Sybil-resistant market.
- There is no escrow, deposit, automatic transfer, refund, delivery guarantee or payment enforcement. Only testnet Sapling requests are supported, not Unified Addresses. Do not use real funds.
- An interrupted create/bid request is reconciled against the same record ID before reporting failure.

## Development and verification

Start with [local setup and browser testing](docs/LOCAL_TESTING.md). See the [architecture](docs/ARCHITECTURE.md), [payment follow-up](docs/PAYMENTS.md), [Sites deployment procedure](docs/DEPLOYMENT.md), [short demo script](docs/DEMO.md) and [validation evidence/checklist](docs/VALIDATION.md).

Baseline GitHub CI at `b59f5703ee8ef5958426e48efd1732830f785f30` passed installation, TypeScript, all 16 original tests, production build, encryption bundle and prover harness. The current branch extends that workflow with browser and production-boundary checks.

Requires Node 24 (Node SQLite is used in tests) and pnpm. The lockfile is authoritative.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/test-bundle.mjs
node scripts/test-prover-worker.mjs
```

Tests run production crypto and service code against SQLite: encryption and drand, permissions, atomic bid acceptance, legacy results, real proof generation, wrong winner/tie/amount/context/omission rejection, empty and no-eligible auctions, signature/report validation, payment expiry/revocation and RPC note/reorg checks. Expected circuit-constraint errors are printed during negative proof tests. `test-prover-worker.mjs` exercises the shipped browser runtime in a JS web-API harness; it is not browser click-through QA. Real Chromium browser coverage, deterministic timing fixtures and limitations are documented in [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md) and [docs/VALIDATION.md](docs/VALIDATION.md).

React/TypeScript/Vinext runs on a Cloudflare Worker with D1. `.openai/hosting.json` preserves the Site ID/database binding. `db/schema.ts` and schema-only migrations under `drizzle/` add proof metadata and payment reports without modifying old auctions. Never seed production with test bids or private test keys.

## Sources and licenses

- [snarkjs 0.7.6](https://github.com/iden3/snarkjs/tree/v0.7.6), [Circom](https://docs.circom.io/), [circomlib](https://github.com/iden3/circomlib).
- [Zallet RPC source](https://github.com/zcash/zallet/tree/main/zallet-core/src/components/json_rpc/methods), [Zebra](https://zebra.zfnd.org/), [ZIP 321](https://zips.z.cash/zip-0321).
- [tlock-js](https://github.com/drand/tlock-js), [drand](https://docs.drand.love/). The committed beacon fixture is quicknet round 1000.
- The sneaker concept is AI-generated; the VEIL mark and other gallery artwork are original SVGs. No real product or seller is represented.

Original VEIL source retains its MIT notice in `LICENSE`. The combined application now incorporates GPL-3.0-or-later snarkjs code and runtime; its distribution must comply with GPL-3.0-or-later (`LICENSE-GPL-3.0`). Vendored files retain attribution, and modifications are described in `lib/veil/zk/vendor/README.md`. Dependency licenses remain applicable. Make the corresponding source available when distributing this build. The repository is public and retains the corresponding source and license notices. The hosted review audience is configured separately.
