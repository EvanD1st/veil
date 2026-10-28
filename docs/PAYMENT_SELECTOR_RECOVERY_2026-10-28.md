# Managed payment notification recovery — 28 October 2026

A confirmed managed purchase could remain unpaid on the website because its private reverse-tunnel callback used the loopback Host header. Native website authentication correctly rejected that host before the selector endpoint ran.

The managed callback now sends the canonical website Host through the same fixed loopback tunnel. It uses Node's HTTP request transport, since fetch can discard a custom Host header. The bearer remains restricted to the exact private endpoint; redirects are not followed and responses are limited to 16 KiB. Website Host validation is unchanged.

The affected purchase also had an earlier, unverified manual selector for a different transaction/output. Recovery first independently checked the retained purchase against the canonical winner's invoice, the receiving Sapling note, exact amount/memo/output, active-chain inclusion and confirmations. After a consistent database backup and private audit snapshot, only that unverified queue entry was corrected. Normal scanner signing and delivery then created the winner's active entitlement. No payment report or entitlement was manually fabricated, and no transaction was resent.

The deployed managed component has an immutable source path, database/configuration backup and prior-entrypoint rollback. Website code, auction results, bids, invoice amounts, signing capability and funding policy were unchanged. The protected original's hash and entitlement bindings were checked after recovery.

Validation: all 15 managed-wallet, managed-evidence and scanner-service tests passed on Linux, including a new real HTTP test through the native Host guard and durable outbox recovery tests. The standalone scanner tests also passed locally. Windows cannot exercise the scanner outbox's POSIX owner-only file mode, so that check was run on Linux.
