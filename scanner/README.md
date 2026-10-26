# VEIL testnet payment scanner

Read-only Node 24 bridge for a local Zallet receiving/viewing wallet and Zebra Testnet node. The [pinned Linux setup](testnet/README.md) records exact versions, source compatibility and the **unmerged NU7/audit blocker**. The [live runbook](../docs/LIVE_TESTNET.md) covers release, sending and evidence. One actual faucet-funded incoming invoice payment passed the installed scanner, signed delivery and recovery checks on 25 October 2026; see [execution evidence and remaining gates](../docs/PAYMENT_VALIDATION_2026-10-25.md). This does not validate our separate sender, escrow spending or upstream audit acceptance.

## Configuration

Generate `node scanner/scan.mjs keygen /PRIVATE/NEW/scanner.pem`. The file is exclusive, owner-only on Unix. Put only its printed `VEIL_SCANNER_PUBLIC_KEY` on the existing Site; signing/viewing/spending keys stay local.

| Local variable | Purpose |
| --- | --- |
| `VEIL_SCANNER_KEY_FILE` | Ed25519 private key; owner-only regular file |
| `ZALLET_RPC_URL` | Numeric loopback HTTP origin, e.g. `http://127.0.0.1:28232` |
| `ZALLET_COOKIE_FILE` | Wallet datadir's `.cookie`, preferred |
| `ZALLET_RPC_AUTH` | Alternative `username:password`; do not set with cookie variable |
| `ZEBRA_RPC_URL` | Numeric loopback HTTP origin, e.g. `http://127.0.0.1:18232` |
| `ZEBRA_COOKIE_FILE` | Node's configured cookie directory plus `/.cookie`, preferred |
| `ZEBRA_RPC_AUTH` | Alternative `username:password`; do not set with cookie variable |

Authentication is required on both clients. URLs reject credentials, paths, query strings, redirects, remote hosts and DNS names including `localhost`; numeric loopback avoids DNS ambiguity. Cookies are reread before each request for restart/rotation. RPC has a 30-second timeout, no automatic retries and a fixed allowlist containing only read methods. Errors do not print RPC messages, URLs, credentials, wallet keys or payment metadata. On Windows, protect files with account-only ACLs; the live backend procedure itself requires Linux.

```sh
node scanner/scan.mjs preflight
node scanner/scan.mjs preflight PRIVATE_INVOICE.json TXID SAPLING_OUTPUT_INDEX
node scanner/scan.mjs scan PRIVATE_INVOICE.json TXID SAPLING_OUTPUT_INDEX NEW_PRIVATE_REPORT.json
```

Preflight signs and writes nothing. The first form checks config/key type, RPC discovery, node currency and wallet sync; it explicitly leaves transaction/output schema unchecked. The second additionally performs exact output/inclusion checks. A valid exact output can be `not-confirmed` (e.g. fewer than three confirmations); preflight readiness is not a payment-confirmation label. `scan` writes a signed report to a new file, never overwrites an older report. Import within five minutes as seller/winner, then rescan the same output for refresh/revocation. No continuous monitor runs.

## Source-checked assumptions and changes

[Zallet status source](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/zallet-core/src/components/json_rpc/methods/get_wallet_status.rs), [transaction source](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/zallet-core/src/components/json_rpc/methods/view_transaction.rs), [Zebra RPC types](https://github.com/ZcashFoundation/zebra/blob/e8db87eb69254e0d4eedd058eadd48bdfa09065a/zebra-rpc/src/methods.rs):

| Boundary | Required meaning |
| --- | --- |
| `getwalletstatus` | `locked=false` means sync-safe, not spending-key unlocked. Optional wallet tip/scanned height may be omitted during startup/recovery; absence never confirms. No `sync_work_remaining`; both node/wallet tip heights and hashes match the current node. |
| Zebra readiness | `chain="test"`, numeric u32 blocks/headers/estimatedheight, finite progress. A wallet matching a historical node tip is insufficient; check estimated sync and recent `getblockheader` time. Exact limits are documented in setup. |
| `z_viewtransaction` | `mined`, `waiting`, `expiringsoon`, `expired`; integer confirmations may be -1. Block hash is absent for unmined status. Unknown status/schema fails. |
| Sapling selector | `pool="sapling"`, u16 `output` indexes `vShieldedOutput`, not the returned outputs-array position. Transparent/Orchard selectors are different. Duplicate matching indices fail. |
| Incoming/non-change | Require explicit `outgoing=false`, `walletInternal=false`, exact address. Null/missing outgoing or an internal output is not accepted. |
| Units | `valueZat` is a JSON integer in zatoshis. Never substitute decimal `value`, coerce strings, round floats or accept unsafe integers. |
| Memo | Exactly 512 bytes as 1024 hex characters; compare invoice UTF-8 plus zero padding. Optional `memoStr` is presentation only; it cannot substitute for memo bytes. |
| Inclusion/active chain | `getblock HASH 1` returns hash, optional height, signed confirmations and txid strings. Require exact hash, inclusion, active `getblockhash HEIGHT`, and matching node/wallet confirmation count before confirming. A side-chain/reorg or insufficient count gives non-confirmation. Unsupported shapes throw. |
| Race | Repeat readiness and wallet checks, require unchanged best hash/height before signing. An outage produces no fresh evidence. |

The old field names/units match the selected source; no speculative field renaming was made. Confirmed integration gaps fixed here are **missing Zebra cookie-auth support** (enabled by default in Zebra 7), a wallet-only sync check that could accept an old node tip, incomplete schema/integer guards, and weak standalone invoice address validation. Preflight is new. Stricter checks also cover block hash/count consistency and duplicate output selectors.

Invoice validation preserves the exact version/network/ID/address/amount/memo boundary, adds full Bech32 checksum/padding and UUID validation, and rejects extra fields. Signed report bytes, expiry, trusted Ed25519 verification, monotonicity, output reuse and seller/winner permissions remain unchanged in VEIL. **Three confirmations are VEIL's testnet policy, not universal finality.**

## Evidence and limits

`node --test tests/scanner.test.mjs` uses **synthetic source-derived schemas** and a loopback HTTP stub for cookie rotation/redaction. `pnpm test` also covers the actual signing/report verification/service/database paths. Neither is a live wallet/node integration test. There are no sanitized actual RPC fixtures; capture/review those privately during the pending Linux lab run before claiming schema compatibility in operation.

An exact observable output can produce a fresh `not-confirmed` report after a reorg/insufficient confirmations. If it becomes unviewable or either service is resyncing/unavailable, scanning fails; existing evidence expires. Reuse the same invoice/transaction/output; do not send again merely because a report expired. One exact Sapling output only: no split, overpayment or replacement-output workflow. Scanner confirmation is a trusted operator attestation, not a cryptographic proof of payment, escrow or delivery guarantee.
