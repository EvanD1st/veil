# Paid seller enrollment (testnet)

Seller Studio accepts one checksum-valid Sapling testnet receiving address per signed-in account. A request is not approval, wallet provisioning, payment or a download entitlement. The form accepts no keys, recovery phrases, roles or readiness flags. The private operator map remains the paid-publishing authority.

## Seller experience

Choose Digital download in Create auction, enter a **dedicated** receiving address and select Request seller setup. The status becomes pending; practice auctions and bidding remain available. Arrange the viewing-key handoff privately with the operator, never through this form or ordinary chat/support. The brief setup text explains that the scanner can view account activity but cannot spend using a viewing key.

After approval, Check setup status enables uploads and paid publishing. Existing enrolled sellers do not need a new request. Ready describes enrollment approval, not current synchronization or a payment. Downloads still require the existing signed report, exact Sapling output and active-chain confirmation checks.

## Operator procedure

Run `node backend/runtime/digital-admin.mjs seller-requests` locally using the configured native database/private-file environment. This lists at most 200 private account IDs, usernames, requested addresses and states. Keep its output private. The command does not approve requests, import keys or change services.

1. Authenticate the seller and verify control of the dedicated account and consent to view-only scanning. Use an authenticated private handoff to the scanner operator. Never obtain a seed or spending key; do not put viewing keys in website storage, allowlists, logs, issue comments or ordinary chat.
2. Follow the pinned wallet's supported viewing-key import procedure. Import only the dedicated Sapling extended full viewing key into a view-only account. Use its verified birthday or full account history if unknown; never advance the birthday merely to pass readiness. Confirm the account derives/owns the exact requested receiver and finishes rescanning and strict synchronization.
3. Add the exact address to the scanner's private `VEIL_SCANNER_RECEIVERS_FILE` array, preserving existing entries. It allows at most 100 distinct receivers. Apply the reviewed scanner configuration using the existing release procedure and verify the running scanner loaded it; a file edit alone is insufficient.
4. **Last**, add the matching stable account ID/address pair to the website's `VEIL_DIGITAL_SELLERS_FILE`, preserving existing sellers. Reject cross-account receiver reuse. Compare the request, website map and scanner list exactly. Never substitute an operator receiver. The website reads its config dynamically and rejects a map that disagrees with a seller's pending request.
5. Have the seller refresh setup. Exercise a separate buyer through the existing auction, invoice, scanner and protected-download flow. Setup approval does not authorize a transfer or validate a sale.

This is operator-assisted enrollment, not unattended wallet import. The UI does not fabricate scan progress. The scanner operator can inspect the enrolled account's activity; public shielded-payment privacy must not be described as privacy from that operator.

## Bounds, release and rollback

Additive migration `0009_digital_seller_setup.sql` adds the request table/indexes. Apply it offline after a matched database/private-files backup through the existing migration procedure. Accounts, sessions, auctions, destinations, reports and entitlements are preserved. Web requests never migrate the database or reconfigure services.

Requests are unique by account and receiver, capped at 200 stored accounts, and use the bounded 40-operation/10-minute throttle. Unapproved address changes have a 10-minute cooldown; identical retries are idempotent within the throttle. Approved destinations cannot be changed through the endpoint. Exact Origin and native session checks remain mandatory; scanner bearer credentials confer no seller access.

Pause publishing with the existing switch or remove the seller from the private map. Retain scanner coverage for outstanding invoices and keep frozen destinations and earned downloads. Roll back only to a schema-compatible artifact, retaining this additive table and current payment records. Never restore a database from before a completed purchase.

## Existing owner Test wallet

The owner collection uses the same independently backed-up Test wallet receiver,
not a separately pasted address. Follow [OWNER_COLLECTION_RELEASE.md](OWNER_COLLECTION_RELEASE.md)
for the private read-only viewing-key companion, import/rescan and exact native
account binding. Ordinary pending requests are not automatically approved by this
owner-only operator tool. Never bypass receiver coverage by merely adding a UI flag.
