# VEIL

**Bid privately. Reveal the winning price. Pay with Zcash.**

VEIL is an experimental sealed-bid auction house for Zecathon's **Private Markets** track. This first review build combines browser-side bid encryption, a drand time lock, persistent acceptance records, local seller tallying, and Zcash testnet payment requests. The objects shown in the gallery are fictional sample lots.

## Try the review build

1. Choose **Try a sealed auction**. Enter an amount and seal three example bids. This uses actual encryption; the other two bidders are simulated locally.
2. Wait about 20 seconds, then choose **Open as seller**. The browser verifies the published drand beacon and decrypts the envelopes. Only the winning amount is displayed.
3. Choose **Create auction** to create a persisted test listing. Keep the downloaded auction-key backup. It is a private auction key, not a wallet seed.
4. In **Seller studio**, reopen a listing or import its key backup. After the deadline, open all accepted envelopes and publish a seller-declared result.
5. An accepted winner can prepare a ZIP 321 payment link and QR if the seller provided a Sapling testnet receiving address. No payment is sent or confirmed by VEIL.

The hosted review workspace is owner-only. Persisted auctions reject self-bids; use the local guided demo to review both roles alone. A multi-person test needs an explicitly authorized audience change. This build does not initiate that change.

## What works

- Persistent auctions and one irrevocable bid per signed-in participant per auction; 32-bid cap.
- Exact integer zatoshi amounts, immutable deadline/key/reserve, and server rejection of late bids.
- Randomized SHA-256 bid commitments bound to the auction, bid ID, amount, and a 256-bit nonce.
- AES-256-GCM encryption with auction/bid context, with the AES key wrapped to a seller RSA-OAEP-2048 public key.
- An outer `tlock-js` envelope locked to the first drand quicknet round strictly after close. The pinned chain, public key and signature are verified; additional AGE recipients and wrong rounds are rejected.
- Local auction keys, downloadable backup/import, bid receipts, and an exportable acceptance-log fingerprint.
- Seller-only retrieval of envelopes after unlock; the browser decrypts and validates every opening before tallying. Highest amount above reserve wins; earlier acceptance breaks a tie.
- A result bound to the full stored snapshot and a matching winning commitment. The public response contains no account identifiers or losing openings.
- ZIP 321 requests with an exact amount and base64url memo. The address check validates testnet Sapling Bech32 encoding/checksum; it is not a wallet ownership or receiver-validity proof.

## What this version does not prove

**A result is a seller declaration, not a zero-knowledge proof that the highest bid won.** The server verifies the published winning opening and log fingerprint, but it cannot verify that every private bid was lower. A dishonest seller can choose a different eligible bid, claim no winner, refuse to reveal, or disclose losing bids after opening. The count supplied with a result is not cryptographic evidence of opening every envelope.

**Payment requests are not settlement.** There is no escrow, deposit, wallet connection, chain monitor, payment confirmation, refund, delivery guarantee, or financial enforcement. No real funds should be used in this build. Only testnet Sapling addresses are accepted; Unified Addresses are not supported yet.

**The operator is not anonymous to everyone.** Sites authentication and the database associate a participant's account with their bid. Hosting providers may observe IP addresses, timing and metadata. This is not an anonymity network or a Sybil-resistant market. Public bid IDs are random pseudonyms, not zero-knowledge identity proofs.

**The accepted log is not externally anchored.** Receipts and snapshot hashes help compare records, but a malicious host can omit, reorder or present different logs. They do not establish that every submitted bid was accepted. The UI labels these limits.

## Threat assumptions and recovery

The time lock assumes drand's threshold network does not release a future round secret early. Even after that round is public, the inner layer needs the seller's private key. The seller can read all amounts after close; the normal UI publishes only the winner. drand availability is required to open bids.

A browser/device/origin compromise can read private keys and unencrypted openings, or modify delivered JavaScript. Auction keys are plaintext in local browser storage and in their exported backups. They never leave the browser in normal use. Clear storage only after backing up; a lost key has no server recovery. This prototype is not independently audited.

The server checks envelope structure but cannot prove that a submitted envelope encrypts a valid opening matching its commitment. A malicious malformed bid can prevent tallying. The app stops on any invalid envelope and does not silently drop it. A consistency proof or explicitly specified exclusion/dispute mechanism is required before adversarial use.

If a submit response is interrupted, the client keeps the opening locally and checks the accepted log before reporting failure. If a create response is interrupted, it checks the new auction ID before reporting failure. A retry must not be interpreted as a new accepted bid.

## Next protocol milestone

A complete highest-bid proof must bind the auction terms, an independently fixed accepted set, every commitment/opening, the reserve and tie-break rule, and the public winner/price. It must address malformed encrypted bids and the seller's ability to abort. Selecting a proving backend is not enough: its zero-knowledge mode and verifier need independent review. This repository does not contain that circuit or verifier.

Zcash completion requires a tested shielded testnet payment with a wallet and transaction observation, plus an explicit non-payment policy. The current QR/link alone is not sufficient evidence of Zcash settlement for a final hackathon submission. Source should be made public under the intended license before submitting; the private hosted source is not yet a public open-source release.

## Development

Requires Node 22.13+ and pnpm. The committed lockfile is authoritative.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/test-bundle.mjs
```

The app uses React, TypeScript, Vinext/Vite and a Cloudflare Worker with D1. `.openai/hosting.json` declares the database binding. The schema is in `db/schema.ts`; `pnpm db:generate` creates schema-only migrations under `drizzle/`. The hosting pipeline applies them when publishing. Never seed production with demonstration bids or private test keys.

The tests execute production crypto and service functions against an in-memory SQLite adapter. They cover exact amounts, deadline boundaries, context binding, tampering, a verified drand fixture, permission boundaries, persistent acceptance, duplicate/late bids, result validation, request limits and payment encoding. The fixture is the real quicknet round 1000 retrieved from:

`https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/1000`

These are programmatic checks, not a browser interaction audit or a security audit.

## Sources and assets

- [tlock-js](https://github.com/drand/tlock-js) and [drand](https://docs.drand.love/).
- [Zcash ZIP 321 payment URIs](https://zips.z.cash/zip-0321).
- [Zcash address encoding](https://zips.z.cash/protocol/protocol.pdf).
- The unbranded sneaker image was AI-generated for this project: an ivory/sage sculptural high-top shoe on a warm minimal stone plinth. It represents no real product or seller. The orbital print, sculptural form, and VEIL mark are original code-native SVG artwork. No remote image service, analytics script or external font is loaded.

Project code is offered under the MIT license; dependencies retain their own licenses. This prototype is provided without warranty.
