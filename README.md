# VEIL

**Digital goods. Sealed bids. Verifiable winners. Pay with Zcash testnet.**

VEIL is an experimental digital-goods auction application. Browse [ve-il.duckdns.org](https://ve-il.duckdns.org), create a username/password account and keep your auction-key backup private. Public signup creates ordinary accounts; administrator access is separately allowlisted. Login, logout and safe internal return destinations use native cookie sessions.

## Release status

The inspected live website runs merged main `cb5ab9f3dd285f5b8399836fdd65bdd554ee4c2b` (26 October 2026), with digital-delivery migration 0006 and the restricted seller configuration. This branch prepares **VEIL Genesis — Testnet Editions**, ten selected downloadable AI artworks and bounded automatic demo-seller auctions. [Implementation, source-derived wallet blocker, evidence and approval gates](docs/SELF_SERVICE_JUDGING.md) distinguish prepared code from live activation. Self-service managed wallets, starter funding and managed checkout are **not available** until independent recovery and outgoing transaction validation pass. No deployment or transfer occurs in this implementation task.

One prior **legacy** invoice received an actual shielded testnet payment and automatic signed verification on 25 October. [The dated evidence](docs/PAYMENT_VALIDATION_2026-10-25.md) records its limits. That payment does not fund a new digital listing and does not validate new download delivery. New digital purchases need their own approved live payment/download test. Previous Redmi K30 Pro checks do not validate this new upload/purchase UI.

## Purchase path

1. An eligible seller uploads a still-image preview and a protected deliverable, states the license and provenance, and publishes. New categories are **Digital Art**, **Digital Items** and **Digital Collectibles**. Numbered editions are seller-declared files, not NFTs. Initially accepted deliverables are PNG, JPEG and constrained binary STL; templates/archives, active documents and executables are unsupported.
2. Buyers see the sanitized preview, file format/size and frozen terms before bidding. Eight sealed bids maximum, one final bid per account; sellers cannot bid on their own listings. The Genesis catalogue uses the selected individual artworks. An owner can use the private `seed-all` operator command to securely open one real 35-day auction for every not-yet-listed imported artwork; existing editions are skipped on retry. Guided demo bids are explicitly separate from real auctions.
3. After the real drand deadline the seller restores their private auction key if needed, opens all envelopes, generates the existing highest-bid proof and publishes. Another account can independently verify it.
4. The winner pays the **new canonical testnet invoice once**, then identifies its exact transaction/output. An authenticated scanner checks address, amount, memo, incoming output, active chain and confirmations. A queued scan, transaction ID or payment-sent note grants nothing.
5. A valid trusted confirmation atomically grants the winning account access to the exact frozen original and license. **My purchases** lists grants. Each download checks the current session, entitlement, version and file integrity. Ordinary five-minute report expiry does not erase an earned grant; fresh explicit non-confirmation suspends future downloads pending operator review.

Only operator-approved sellers whose **own** receiver is actually observed by the scanner can publish automatic-delivery auctions. Public registration alone does not establish scanner coverage. Funds are never silently routed to an operator address. Legacy listings retain their original category, terms, results and payment obligations; they have no retroactive file entitlement. New escrow creation and settlement execution are disabled.

See [digital storage, authorization, recovery and limits](docs/DIGITAL_GOODS.md), [judge walkthrough and recording script](docs/JUDGING.md), [account access](docs/ACCOUNTS.md) and [deployment preparation](docs/DIGITAL_RELEASE.md).

## Trust and privacy

The operator can access server-hosted originals, accounts and certain payment/network metadata. Protected downloads are **not end-to-end encryption**. Shielded payment does not make website accounts or connection metadata anonymous. Original filenames and file hashes are not public; sanitized previews, file type/size, license and seller-declared provenance are intentionally visible to authenticated bidders.

The seller can read losing bids after reveal. Private seller keys and openings remain in browser storage/backups, so shared devices or origin compromise can expose them. The proof establishes winner selection within the recorded accepted log, not authorship, copyright, exclusive ownership, file quality or delivery acceptance. The operator could censor a bid; the seller could refuse to reveal. A served download is distinct from an access grant and proves neither opening nor acceptance. Already downloaded files cannot be recalled or made uncopyable. Copyright changes only as the frozen license states.

The trusted scanner signs five-minute attestations; this is not a ZK proof of payment. RPC, viewing material and signing keys remain on the isolated node host; only the trusted public key and service-token verifier belong on the website. The approved experimental Zallet build and its failed upstream cargo-vet evidence remain explicit. No mainnet funds, guaranteed delivery, refunds, escrow activation or NFT transfers are offered.

## Development and validation

Use Node 24.15.0 and the pnpm version pinned in package.json. Preserve the lockfile and existing proof assets.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/test-bundle.mjs
node scripts/test-prover-worker.mjs
node scripts/check-production-boundary.mjs
pnpm test:e2e
pnpm build:ubuntu
node scripts/package-ubuntu.mjs
node scripts/test-ubuntu.mjs
node scripts/test-native-browser.mjs
```

Production builds run in Linux CI, not the workstation or shared website host. The portable Worker browser tests use explicitly synthetic digital metadata; native tests exercise actual uploads, SQLite, filesystem permissions and protected downloads. The production-artifact browser flow uses separate real cookie accounts, ordinary clocks and live future drand; only its signed payment observation is synthetic. It must never be described as a live transfer. Private originals, databases, credentials and wallet material are excluded from release artifacts.

See [current candidate evidence](docs/DIGITAL_RELEASE.md), [historical validation](docs/VALIDATION.md), [scanner](backend/scanner/README.md) and [testnet infrastructure](backend/scanner/testnet/README.md). The native Ubuntu target supports private local storage. The retained Sites/Worker target fails closed for new file-backed publishing and has no production filesystem adapter. Never enable a fixture to make a hosted target pass.

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

## Sources and licenses

- [snarkjs 0.7.6](https://github.com/iden3/snarkjs/tree/v0.7.6), [Circom](https://docs.circom.io/), [circomlib](https://github.com/iden3/circomlib).
- [Zallet RPC source](https://github.com/zcash/zallet/tree/main/zallet-core/src/components/json_rpc/methods), [Zebra](https://zebra.zfnd.org/), [ZIP 321](https://zips.z.cash/zip-0321).
- [tlock-js](https://github.com/drand/tlock-js), [drand](https://docs.drand.love/). The committed beacon fixture is quicknet round 1000.
- The retained legacy sneaker concept is AI-generated; the VEIL mark, golden envelope and other decorative/gallery SVGs are original. Sample concepts are not purchasable deliverables.

Original VEIL source retains its MIT notice in `LICENSE`. The combined application now incorporates GPL-3.0-or-later snarkjs code and runtime; its distribution must comply with GPL-3.0-or-later (`LICENSE-GPL-3.0`). Vendored files retain attribution, and modifications are described in `shared/veil/zk/vendor/README.md`. Dependency licenses remain applicable. Make the corresponding source available when distributing this build. The repository is public and retains the corresponding source and license notices. The hosted review audience is configured separately.

## Source organization

Frontend code and public assets are in `frontend/`; API handlers, authentication, databases and workers are in `backend/`; common protocol code is in `shared/`. Root `app/` files are framework routing adapters only. Commands still run from the repository root, and generated deployment paths remain compatible. See [repository layout](docs/REPOSITORY_LAYOUT.md).
