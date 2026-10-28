# Digital listings and private delivery

This implementation requires the native Ubuntu runtime and additive migration `0006_digital_delivery.sql`. It does not change circuits, proof assets, drand timing, bid encryption, native authentication, canonical invoices or scanner validation. The frozen digital metadata is a server/database binding, **not an additional assertion of the existing ZK circuit**.

## Product and eligibility

Seller Studio now supports an address-only setup request and refreshable pending/ready state. Paid publishing remains operator-approved after view-only import/rescan. See [seller enrollment and release procedure](SELLER_SETUP.md); this adds migration `0009_digital_seller_setup.sql`.

New listings require validated files, license and seller-declared provenance. Categories are Digital Art, Digital Items and Digital Collectibles; edition information is optional and seller-declared. Files/editions are not NFTs. No minting, blockchain asset transfer, exclusive-copy enforcement or copyright verification exists. New physical/escrow listings and unknown privilege/fulfillment fields are rejected. Historical NULL-draft auctions retain category, context, terms, result and payment data. No legacy entitlement is manufactured.

`VEIL_DIGITAL_PUBLISHING_ENABLED=1` opts into new uploads/publication. Default is paused. Earned downloads and existing auctions remain usable when publishing is paused. `VEIL_DIGITAL_ROOT` must be an absolute canonical native path outside releases/static directories, proposed `/srv/veil/shared/digital-store`. Use a dedicated service-owned mode-0700 directory and mode-0600 files. Never configure a public Caddy alias to this directory. Persistent storage is a requirement; releases must not own the originals.

`VEIL_DIGITAL_SELLERS_FILE` names a small private operator-controlled JSON object mapping stable account IDs to each approved seller's **own** checksum-valid Sapling testnet receiver. Proposed location: `/etc/veil/digital-sellers.json`, root-owned, mode 0640, group veil, non-writable by the application. No role/address supplied in a browser can override it. The scanner now accepts a bounded list of up to 100 explicitly configured receiver addresses via `VEIL_SCANNER_RECEIVERS_FILE`; each address must be backed by an imported and fully rescanned Sapling viewing account in that scanner wallet. The website seller map and scanner receiver list must be kept in exact agreement. Publishing remains unavailable unless the seller is in the private map, and the scanner rejects invoices for addresses outside its own list.

Viewing keys are sensitive: a Sapling extended full viewing key lets the wallet operator inspect the associated account's incoming and outgoing activity. If a judge opts into paid selling, use a dedicated receiving account with no unrelated history, and import its **viewing key only** into the trusted scanner through a private operator procedure. Never submit a recovery phrase or spending key to the website, scanner API, chat, or ordinary support channel. Zallet imports Sapling extended full viewing keys as view-only accounts; see the [pinned import implementation](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/zallet-core/src/components/json_rpc/methods/import_viewing_key.rs). Judges who do not want this viewing disclosure can still bid and create no-payment practice auctions. A viewing-key import and completed rescan are prerequisites, not evidence of a paid sale. Removing a seller-map entry stops new publishing; existing obligations and downloads remain.

## Bounded files and decoding

- Deliverable: up to 10 MiB; PNG/JPEG still raster or uncolored binary STL.
- Preview input/output: up to 2 MiB, PNG/JPEG input; re-encoded PNG output with metadata removed, at most 1200x1200.
- Raster decode: at most 4,194,304 pixels, full decode, no animated images; pinned Sharp 0.35.4, concurrency 1 and 16 MiB decode cache.
- STL: exact binary length, at most 200,000 triangles, finite coordinates and no vendor/color attributes. No archive extraction, embedded-resource fetching or arbitrary URLs.
- Per account: 48 MiB reserved/complete storage and 32 objects. Global: 256 MiB. Reservation uses the maximum allowed object size until validation finishes, then actual size.
- Free-space reserve: 1 GiB after pending reservations and the new upload limit. A reserve failure returns 507. A quota failure returns 429. Swap is not a storage solution.
- Two concurrent uploads globally, one per account. Six file responses globally, at most two protected transfers per account; preview allowance six. Forty upload/draft/download/control operations and 240 preview reads per account per ten minutes. Tracking is capped at 200 bucket entries; 429 with Retry-After is retryable. Limits reset on process restart; this is bounded application protection, not a DDoS claim.

Streaming writes enforce declared Content-Length and hard size limits without buffering the original. Decoder memory is bounded by dimensions/concurrency. Thirty-second native request limit; the UI shows progress, cancellation, validation and honest interruption errors. Filenames are discarded, random server IDs are used, O_EXCL/O_NOFOLLOW and canonical non-symlink directories prevent traversal, symlink reads and overwrites on the Linux target. Validation includes content structure and full image decoding, not extension alone. No antivirus or independent security audit is claimed. Only the sanitized preview/type/size/license/provenance are intentionally public to authenticated bidders. Original hashes stay private because known-file hashes can identify content. Originals may contain their own embedded metadata; sellers should remove sensitive material before uploading, and entitled buyers receive those exact bytes.

Publishing rehashes both files, then one SQL insert atomically freezes the version, receiver, category, terms, provenance, size and private integrity hash. Database triggers prevent replacement/deletion of referenced drafts/assets or frozen metadata. Changes require another listing. Unattached uploads are not automatically auctions and no payment obligation exists for them.

## Payment-to-entitlement boundary

Existing canonical invoice/signature validation executes unchanged. It checks the trusted Ed25519 key, testnet Sapling output, exact receiver/amount/memo, invoice, confirmation arithmetic, active-chain attestation, freshness/monotonic timestamps and output reuse. Only the accepted report SQL statement can reach entitlement triggers through the application. Direct DB access remains trusted operational access.

Migration triggers create the entitlement in the **same SQLite transaction** as report INSERT/UPDATE. It binds auction, complete published result JSON, winner account, exact invoice/output, frozen version/file and license. Retries are idempotent; an ACK failure can leave both report and grant committed, never a half grant. The existing durable scanner outbox and lease/duplicate-delivery protocol repair that case without resending payment. No schema fields or scanner claims are weakened. A queued scan, submitted txid, browser paid flag, payment-sent note, stale/invalid/mismatched signature or synthetic unsigned claim cannot grant access.

Ordinary report expiry marks current payment evidence stale but retains the earned entitlement. Fresh accepted `not-confirmed` evidence for its exact output conservatively suspends future downloads and records history; this includes uncertainty and is not automatically a proven reorg. Later confirmations do not silently reactivate. An operator must inspect current chain/invoice evidence and use the offline review command with a current trusted signed confirmation. Already downloaded files cannot be recalled. Disabling a compromised scanner key affects future report trust; review existing grants and suspend those affected instead of pretending revocation recalls files.

## Download authorization and errors

Every GET/HEAD revalidates the native cookie session and seller/winner binding. Losing bidders, other accounts, anonymous callers and scanner bearer tokens have no download privilege. A URL is not a credential. Seller access is distinguished from buyer entitlement. Result/version/file/license mismatch suspends buyer access. Range is explicitly unsupported (416 after authorization); HEAD uses the same integrity and permission checks, sends no bytes and records no served event.

The opened file descriptor must be regular, match frozen size/hash and remain private. Responses use generated attachment names, no-store/private, nosniff, no-referrer and sandbox CSP. No public redirect/original path is emitted. Listing metadata checks availability for authorized participants; missing/corrupt originals produce an unavailable state and generic operator error, no success. Exact-byte restoration keeps the entitlement. Access-granted, download-served, incomplete and unavailable events are distinct. Server completion does not prove receipt/opening/acceptance.

My purchases contains only that account's grants and frozen public terms, not reports, memos or output identifiers. Existing payment endpoints remain seller/winner-only; scanner service-token authentication is independent. Auction list/details now withhold receiver addresses from unrelated accounts while preserving recorded proof context and independent verification. Seller keys/openings remain browser-local; no private filenames, originals, hashes or credentials are included in HTML/build archives. This is a focused code review and regression exercise, not an independent audit.

## Cleanup, backup and operator recovery

Run operator commands with the service's private environment loaded outside shell history/logs; never print the environment. Use the packaged Node runtime and private paths. Commands operate only on VEIL.

```sh
node runtime/digital-admin.mjs audit
node runtime/digital-admin.mjs cleanup
node runtime/digital-admin.mjs backup /absolute/new/private-backup-directory
node runtime/digital-admin.mjs suspend AUCTION_UUID
# After independent review of the exact chain/invoice and current signed confirmation:
VEIL_DIGITAL_REVIEW_CONFIRM='I reviewed current chain evidence and the exact frozen purchase' node runtime/digital-admin.mjs review-resume AUCTION_UUID
```

Stop only VEIL before cleanup/review/backup during release operations. Cleanup expires unbound drafts older than 24 hours, then removes only old generated regular orphan files. Frozen listings/paid assets remain retained, even if suspended. Quotas never justify deleting a sold original. Monitor the quota/reserve and pause new publishing before storage exhaustion.

Backup uses SQLite's consistent backup API, checks integrity, copies every complete asset, checks each private hash and writes `complete.json` only after success. An incomplete backup directory is **not** a recovery set. Backups include original content, account hashes and payment metadata; protect them like the live store. Retain the runtime environment/trusted seller map privately alongside the matching set. Backups also consume space: reserve capacity before starting.

Restore only while VEIL is stopped, into new private paths: verify the backup DB digest against `complete.json`, `PRAGMA integrity_check`, all referenced object sizes/hashes and account/auction/bid/report/entitlement counts. Populate `objects/` without overwriting an active store; make a private empty `tmp/`, run the packaged audit using the restored DB/root, then select the new matching set. Do not change object IDs/bytes, invoice bindings or account IDs. Keep the original failed set for diagnosis. Test authenticated access and integrity before serving traffic. Never restore a pre-purchase DB over newer entitlements. See the release-specific rollback rules.
