# Managed Zingolib checkout status — 27 October 2026

## Implementation branch

The `managed-zingolib-checkout` branch wires a private Zingolib wallet service to the existing winner-only canonical invoice and signed scanner path. Individual wallet recovery is encrypted and separately challenged; the service has bounded testnet policy, explicit quote review, affirmative Pay, a durable prepared transaction journal, a single-broadcast counter, active-chain reconciliation and a selector outbox. The selector bearer is sent only through the restricted loopback reverse SSH tunnel. An existing private journal receives the broadcast counter additively.

The interface and implementation are staged for review. Managed funding and Pay remain disabled in the public website and on the private service until the validation file and operator switch are explicitly installed. The configured starter grant limits are proposals only; activating them requires a separate decision about the total testnet spending allowance.

## Current live evidence

The latest read-only health snapshot reports Zebra, the receiver wallet and scanner active with strict testnet readiness. The separate sender wallet remains intentionally stopped. The managed wallet service configuration says `enabled: false` and its service is inactive. No managed grant, signed transaction, outgoing transfer or new payment was performed.

One bounded restore attempt imported the backed-up testnet sender into its new isolated Zingolib wallet directory. It failed before signing. The original sender database remained byte-for-byte unchanged; the encrypted recovery directory was retained. Its encrypted error record is only 11 bytes and cannot be classified. The transaction implementation therefore does not yet have passing evidence for funded sync, prepared signatures, fee/change correctness or checkout delivery. These are still required before enabling the public feature.

## Remaining validation sequence

1. Build a pinned diagnostic artifact that retains the encrypted SDK error chain and operation phase without writing private details to logs.
2. Resume the existing restored wallet under the existing memory, runtime and readiness limits. Do not overwrite the source wallet or create another funded wallet.
3. Prepare one exact Sapling testnet invoice transaction and independently inspect its serialized bytes, recipient, memo, change, fee cap and expiry. Do not broadcast it yet.
4. Present the exact testnet network, destination, amount, memo, fee ceiling and purpose for separate approval. After approval only, broadcast once, reconcile without resending, verify active-chain output and confirmations, and test signed report delivery plus restart recovery.
5. Only after those checks, decide whether public managed funding should be enabled and approve a bounded total allowance. Until then, ordinary winners continue using their external-wallet invoice flow.

Zallet 0d433b322408c30ee48765a98a81af9001108e7d remains experimental and its failed cargo-vet evidence remains recorded. This implementation uses the separate pinned Zingolib SDK and does not change the Zallet candidate or the website release already deployed.
