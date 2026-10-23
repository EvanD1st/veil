# Architecture and trust boundaries

| Layer | Responsibility | Boundary |
| --- | --- | --- |
| Browser UI | Seller RSA key backup/import; AES-GCM/RSA-OAEP encryption; tlock envelopes; local reveal | Seller keys and losing openings stay on that browser. Seller can read losing amounts after close. |
| drand quicknet | Pinned chain and round strictly after the bid deadline | Live availability and threshold-network assumptions remain external. |
| API / D1 | Authenticate participants; atomically accept one bid each; fix the complete log and public proof inputs | Host controls acceptance and order; this is not an independently anchored log. |
| Proof Worker | Integrity-check public assets; create eight-slot PLONK proof; terminate on cancellation | Retries cover transient downloads only. Corrupt assets cannot execute or produce a successful proof. |
| Fixed verifier | Check circuit version, complete public inputs, winner/reserve/tie-break and algebra | No caller-supplied verification key. Protocol v1 retains its seller-declared label. |
| Result reconciliation | One publication write, followed by reads and independent result verification | Lost responses do not authorize another publication. Unknown and conflicting status stay visible. |
| Scanner | Read local Zallet/Zebra state and sign an exact incoming testnet output report | Trusted Ed25519 attestation, not a zero-knowledge payment proof. Wallet and signing secrets never reach hosting. |
| Payment follow-up | Record a deadline and private seller/winner discussion actions | No escrow, reassignment, automatic cancellation, refund or delivery enforcement. |

## Proof lifecycle

Downloads report verified/received bytes and retry transient failures at most twice with bounded backoff. Non-transient HTTP and all size/hash failures stop immediately. Verified public bytes are stored in an optional Cache Storage cache keyed by the pinned hash. Every cache hit is size/hash verified again. A corrupt cache entry is removed and the current attempt fails; it is never promoted to a proof. Storage/quota failures fall back to verified network loading. Proving reports the five actual PLONK rounds through fixed labels, without forwarding witness values or raw logs. The outer client has a ten-minute ceiling. Cancellation terminates the Worker and discards the pending result; local verification still must finish before a proof is accepted.

A malformed accepted ciphertext stops the whole tally. It is never removed to make a proof succeed. Ciphertext/commitment consistency is not proved at submission. A consistency proof or explicit dispute/exclusion protocol remains future work.

## Publication recovery

The browser stores the expected auction, full-log fingerprint and proposed public result in session storage before its single POST. Whether the response arrives or is lost, a GET reconciles auction identity/context, immutable auction fields, accepted-log hash/count, winning opening and fixed-key proof. A match is success; a different log/result is a conflict. Missing/unreachable status is unknown and offers **Check publication status**, which sends only GET requests. Reloading and reopening the auction restores that pending record. Do not clear it and blindly publish again when the original request might still be completing. An operator may need to investigate persistent uncertainty.

## Remaining protocol limits

The seller can refuse to reveal, lose keys or disclose losing bids. The host can censor bids or show different logs. There is no proof of acceptance completeness, independent ordering, anonymity, Sybil resistance or delivery. The circuit/verifier are unaudited. The reserve, amount bounds, context binding, fixed key, zero padding, tie-break and v1/v2 interpretation remain unchanged.
