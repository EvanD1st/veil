# Live testnet auction and payment runbook

Prepared 23 October 2026 from reviewed `main` **9853bdc7751ab7a89b2b1c4e55f3c7e71bcab128**. [Its post-merge CI passed](https://github.com/EvanD1st/veil/actions/runs/39884208213). Implementation is on `live-testnet-setup`; the PR identifies the exact new head. **No deployment, Site audience change, wallet initialization, funding or payment is performed by this task.**

## Current release gates

- [x] Inspect latest main and post-merge CI; retain UI, cryptography, pinned proof assets and permissions.
- [x] Select immutable source pins; identify the v28/v29 conflict, indexer requirement and co-located database constraint.
- [x] Prepare Linux source-build/config scripts, read-only preflight, exact payment preparation and regression coverage.
- [ ] Upstream Zallet NU7 integration/audit acceptance: selected PR 898 remains unmerged with failed required audit checks at inspection.
- [ ] Build selected binaries on the documented Linux host; record binary hashes, successful Testnet sync and actual RPC response evidence.
- [ ] Authorized release of an exact VEIL commit to the existing Site, deliberate D1 migration and authenticated deployed-asset checks.
- [ ] Ordinary separate-account auction with future-round live drand, followed by an actual shielded Testnet payment, report import/expiry/refresh.
- [ ] Physical-device measurements and accessibility checks.

Do not fill these unchecked boxes from synthetic tests or upstream CI. [The setup guide](../backend/scanner/testnet/README.md) documents the source-compatible experimental pair and why the published Zallet beta.3 artifact cannot be used with Zebra 7's state. This Windows workstation has no configured live RPC endpoints/signing key and no synchronized node. Its external drive has only about 3.7 GB free on FAT32. A sufficiently provisioned Linux lab and the upstream acceptance decision are external blockers.

## Release preparation — operator actions, not executed here

1. Select the reviewed PR/merged commit and verify green CI **for that exact SHA**. Record `git rev-parse HEAD`, clean `git status`, Node/pnpm versions and build command in a private release log. Preserve the frozen lockfile. Run `pnpm typecheck`, `pnpm test`, `pnpm build`, the bundle/prover and production-boundary checks; browser CI remains required. Keep an integrity hash of the build artifact, source SHA and `shared/veil/zk/assets.json` together. Do not mix an older artifact with a newer release label.
2. Preserve `.openai/hosting.json`, Site project `appgprj_6ad60ddb6cc08191adf85da59c23c6aa`, D1 binding `DB`, and its existing migration history. In the authorized Sites workflow, identify the actual bound D1 database, export a backup and verify it is readable before applying schema changes. Inspect unapplied migrations in order, including **0003_payment_followup.sql**: nullable `payment_window_hours` plus private `payment_followups`, with existing auction/bid/result rows retained. Apply each once through that actual database's migration mechanism; record the migration ledger and pre/post row counts. A failed migration stops release. Never target production with the placeholder ID in `wrangler.local.json` or the hardcoded local migration script.
3. Synchronize/build the selected source through the **existing** Sites project only after separate deployment authorization. GitHub push/CI does not deploy or migrate it. Preserve its audience. A genuine two-account hosted test needs both intended identities to have already-authorized access; owner-only access is a blocker, not permission to change audience. An ordinary loopback dev server may be used for live drand timing, but its single mock user is not multi-user production-auth evidence.
4. Confirm the trusted gateway authenticates users and strips/overwrites caller-supplied `oai-authenticated-*` headers. Verify unsigned/forged identity requests do not gain seller/winner access. Never expose a standalone raw Worker/preview relying on those headers. Keep `VEIL_LOCAL_TEST` unset; production must reject that flag and exclude test identities, clock, old beacon fixture endpoints and local mock sign-in. No synthetic receiver, fixture invoice/report, auction private key or test database may be seeded into the release.
5. Generate the Ed25519 scanner key locally on the lab host. Configure **only its public key** as `VEIL_SCANNER_PUBLIC_KEY` using the existing Site's secret/environment workflow when separately authorized. Keep RPC credentials, viewing/spending keys and signing key off the Site. Record the public-key fingerprint and intended operator privately.
6. Check each deployed WASM/zkey/runtime part against the exact tracked size and SHA-256, then check Worker cancellation/retry and independent result verification in the authenticated browser. `node scripts/check-deployed-assets.mjs https://veil-private-auctions.softball129.chatgpt.site` streams/hashes without saving assets. Its unauthenticated check here stopped at **HTTP 401** on the first asset; that is an access blocker, not a successful integrity check or a reason to change audience. For protected assets, the authorized operator must use their authenticated Site session and the same manifest; do not put browser cookies in the repo/console or bypass the gateway.

The last documented hosted source remains `7243a5f457bb2140f95d5b7bff04520357b0a48c`. This task does not infer a new deployment from CI or a GitHub merge. See [DEPLOYMENT.md](DEPLOYMENT.md).

## One complete demonstration

Keep a private log with exact source/build/pins, actor roles, UTC observation times, actual wallet/node schemas, tip synchronization, outcomes and elapsed times. Raw wallet responses, invoices, reports, transaction metadata and addresses tied to identities are private. Record public pass/fail summaries only after reviewing them. There are currently **no sanitized actual RPC captures** in the repository; `tests/scanner.test.mjs` is explicitly synthetic and source-derived.

1. **Prepare the lab.** Follow the pinned Linux guide; resolve the upstream gate, build/record hashes, start Zebra with indexer and the two separately backed-up Zallet datadirs. Verify explicit testnet on both, current consensus and stable sync. Obtain testnet sending funds through an operator-approved channel separately; this runbook does not make a faucet request. Confirm sufficient spendable funds for invoice plus network fee. Sender spendability may require more confirmations than VEIL's incoming-payment threshold.
2. **Create as seller.** In the ordinary authenticated release, use the real receiving wallet's **Sapling testnet** address and a small reserve. Set a close several minutes in the future and a deliberate follow-up policy. Download and privately verify the auction-key backup. It is different from the wallet and scanner keys. Record the auction's close/unlock round.
3. **Seal as bidder.** Use a separate browser profile/account with no seller key. Submit a real bid before close; optionally use a second bidder for a lower amount or tie. Show the accepted sealed log/order. The seller cannot bid on their own persisted listing. Neither isolated test identities nor simulated guided-demo bidders satisfy this live two-account step.
4. **Observe live drand.** Before close/unlock, reveal must be unavailable. Wait naturally for that future quicknet round and obtain/verify its pinned-network signature through the normal API/browser path. Keep wall clock ordinary; do not use `VEIL_LOCAL_TEST`, round-1000 fixtures, intercepted responses or clock overrides. Record actual round and timing.
5. **Reveal/prove/publish.** Seller opens every accepted envelope with the backed-up key. Show asset download/proving progress and successful local verification; publish once. Refresh in the bidder profile and independently verify the stored full-log result. Stop on any malformed accepted bid or proof failure; never omit a bid. If publication response is lost, use its read-only status reconciliation instead of another POST. The auction proof verifies winner selection for the recorded log, not completeness against all attempted submissions.
6. **Prepare invoice and payment.** Winner exports the actual invoice. Seller/winner privately compare invoice, displayed address/amount/memo and wallet ownership. Run the offline preparation command below. Decide which separately authorized operator will make the testnet payment. The scanner never sends it. Until an actual transfer is mined and scanned, the UI stays unverified; a QR or sent-payment note cannot confirm it.
7. **Wait and inspect.** In the receiver, `z_viewtransaction` must expose the exact incoming Sapling output. Its `output` is the index in `vShieldedOutput`, not the position in the returned filtered outputs array, an Orchard `action` or transparent `vout`. Check exact integer `valueZat`, address, outgoing=false, walletInternal=false, full 512-byte hex memo, mined status and active inclusion. Keep raw output private. Wait for **at least three active-chain confirmations: VEIL's testnet policy**, not a universal Zcash finality/spendability guarantee.
8. **Read-only preflight, then sign.** With the receiver's local scanner environment loaded, run `preflight invoice.json TXID OUTPUT_INDEX`. It must pass without signing or writing. Then run `scan` to a **new** private report filename. It rereads wallet/node status before and after, checks active-chain height/hash and both confirmation counts, and refuses a changing tip. Retry a failed read later; do not send another payment because a scan failed.
9. **Import and refresh.** Seller or winner imports the report within five minutes. Confirm scanner-confirmed status is visible only to those roles. Wait beyond `expiresAt`; the view must show needs refresh, not current confirmation. Rescan the **same** invoice/transaction/output to a new file, import the newer report and regain current status. Report generation may take longer than expected; an expired report must be regenerated. This is manual observation, not continuous chain monitoring or a proof of payment.
10. **Negative and recovery checks.** Using private copies, try altered invoice/address/amount/memo/output/confirmations, stale report, modified signature, unrelated auction and unrelated account; reject each. Same/older observation replay and using an output on another invoice must fail. Test configured-key rotation/removal and newer non-confirmation revocation in a controlled authorized staging environment. Do not disrupt the shared testnet to force a reorg; automated fixtures cover controlled reorg/race cases, while an observed live reorg requires actual private evidence. Follow-up notes/deadlines must never change the winner, proof or invoice.

## Sending path and ZIP 321

[Current ZIP 321](https://zips.z.cash/zip-0321) uses decimal **ZEC** with at most eight fractional digits, and shielded memo bytes as **unpadded base64url** in the URI (`-` and `_`; no `+`, `/` or `=`). A short memo is zero-filled to 512 bytes in the transaction. The UI already follows that format; no UI or protocol change is needed. `backend/scanner/invoice.mjs` independently verifies the offline path and preserves the existing stricter 1..100,000,000,000,000-zatoshi application bound.

A source-verified testnet-capable sending path is the **same pinned Zallet build**, separate `sender` datadir and explicit testnet config. It supports `z_sendmany` with a Sapling recipient, decimal-ZEC amount and hexadecimal memo. [Pinned payment parser](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/zallet-core/src/components/json_rpc/payments.rs) and [send implementation](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/zallet-core/src/components/json_rpc/methods/z_send_many.rs). **This sending path has not been executed here.** No mobile-wallet QR compatibility is claimed.

Offline preparation (does not contact a wallet):

```sh
umask 077
node backend/scanner/prepare-send.mjs "$VEIL_LAB_ROOT/private/invoice.json" "$VEIL_LAB_ROOT/private/recipients.json"
```

It creates recipients JSON plus `recipients.json.uri`, both private and exclusive. Decimal literals are built with integer arithmetic; memo hex is made from the same UTF-8 invoice memo. Review all three values against the original invoice. Do not put base64url URI memo text into the RPC's hexadecimal `memo` field, add a trailing newline to memo text, round the amount or subtract the fee from the recipient amount.

The following is **the operator's explicit funds-moving step**, shown for later authorized manual execution only; it is not in any executable VEIL script:

```sh
# Requires a separately funded, backed-up and synchronized TESTNET sender.
# Replace the quoted placeholder with that wallet's real Sapling testnet source.
zallet -d "$VEIL_LAB_ROOT/sender" rpc z_sendmany '"SENDER_SAPLING_ADDRESS"' "$(cat "$VEIL_LAB_ROOT/private/recipients.json")"
# Keep returned operation ID private. Inspect this same operation; do not submit again.
zallet -d "$VEIL_LAB_ROOT/sender" rpc z_getoperationstatus '["OPERATION_ID"]'
zallet -d "$VEIL_LAB_ROOT/sender" rpc z_getoperationresult '["OPERATION_ID"]'
```

Use a private trusted terminal: arguments contain payment metadata, though no RPC credentials or wallet key. On failure/pending/response loss, inspect the original operation and receiver history before deciding whether anything should be retried. Fees are handled by the wallet in addition to the requested output. To scan after mining:

```sh
. "$VEIL_LAB_ROOT/scanner.env"
node backend/scanner/scan.mjs preflight "$VEIL_LAB_ROOT/private/invoice.json" TXID SAPLING_OUTPUT_INDEX
node backend/scanner/scan.mjs scan "$VEIL_LAB_ROOT/private/invoice.json" TXID SAPLING_OUTPUT_INDEX "$VEIL_LAB_ROOT/private/report-001.json"
```

VEIL remains **Sapling testnet only**. These instructions add no Unified Address/Orchard destinations, split/overpayment matching, automatic payment, escrow, refunds, delivery enforcement or background monitoring.

## Physical-device checklist and short demo

On an actual target phone/tablet, record model, OS/browser versions, network, available memory, cold asset download time, proof time, cache reuse, battery/thermal behavior and any Worker/OOM failure. Test portrait/landscape, zoom, screen reader/keyboard, visible focus, modal closure/restoration, progress/cancel/retry and reload recovery. Confirm payment URI review preserves the three values in the chosen wallet before any authorized send. Record failures; desktop viewport emulation is not a substitute.

Suggested narration: “The bidder seals an offer locally. After the future beacon round the seller opens every recorded bid; this proof verifies the highest eligible winner. We independently verify the published result. Payment is a separate exact Testnet invoice. This report is a trusted scanner's five-minute observation of an incoming output with three confirmations, not a zero-knowledge payment proof. The seller sees losing bids after close; the host controls acceptance; there is no escrow or delivery enforcement.” Only show the last payment sentence with actual scan evidence; otherwise state that the payment leg is pending.
