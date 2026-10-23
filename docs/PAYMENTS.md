# Payment follow-up and operator procedure

## Deadline policy

New auctions choose a 24-, 48- or 72-hour follow-up window, or no deadline. The policy is fixed when the auction is created and displayed before bidding. Its clock starts at final result publication, only when a winner and receiving address make an invoice possible. Existing rows receive a nullable column and retain no deadline; migrations never impose one retrospectively.

The deadline is follow-up metadata, not a new proof/circuit input. It does not change commitment or circuit semantics and inherits the existing host trust boundary for auction metadata. After the deadline, the seller or winner may request direct discussion. The winner may record **I sent payment** at any time; that is explicitly unverified and cannot create scanner-confirmed status.

No deadline action changes the accepted log, winner, proof, invoice or published result. There is no automatic next-place award, cancellation, escrow, refund, second payment or delivery enforcement. Seller and winner arrange non-payment, delayed payment and delivery directly.

## Evidence and recovery

The follow-up deadline and scanner expiry are separate clocks. A payment can be overdue without a current report, or a previously confirmed report can need refresh before the deadline. An overdue badge is not proof that payment was not sent. Wait for confirmations and rescan the exact invoice/output before considering another transfer.

Reports expire within five minutes. Expired, invalidated, revoked or untrusted reports never count as current confirmation. API status is rechecked while the payment view is open; a failed status request removes the current-confirmation label. Manual scanner evidence is still required: status polling does not scan the chain.

Rotate `VEIL_SCANNER_PUBLIC_KEY` to invalidate signatures from the old key immediately on status revalidation. The scanner operator keeps the new private key local. To restore confirmation, import a fresh report signed by the newly trusted key for the same exact output with a newer observation timestamp. Removing the key also makes stored confirmations need refresh. A fresh signed `not-confirmed` report revokes confirmation. A wallet/scanner outage cannot be presented as a new confirmation; an existing observation is only evidence until its explicit expiry, not continuous chain monitoring.

## Real shielded testnet validation — external setup required

This workstation has no Zallet/Zebra executables detected on PATH, RPC endpoints, scanner key file or configured trusted scanner public key. No live transfer has been performed. RPC fixtures and browser proof tests are not evidence of a payment.

The operator must provide:

1. A synchronized Zebra **testnet** node and Zallet receiving/viewing wallet, with wallet/node tips checked. Record `zebrad --version` and the wallet's installed version before starting; do not substitute guessed version numbers.
2. A real Sapling testnet receiving address owned/viewable by that wallet, plus a compatible funded **testnet** sending wallet. Synthetic test receivers are not payment destinations.
3. Loopback-only wallet/node RPC endpoints and local credentials/cookies as described in `scanner/README.md`.
4. A locally generated scanner Ed25519 private key. Configure only its public key on the existing Site.
5. Explicit authorization for an operator to make the testnet transfer. This implementation task sends no funds and does not deploy.

Procedure: publish a test auction result, export the exact invoice, send its exact amount and memo, wait for at least three confirmations, scan the specified transaction/output and import the report within five minutes. Verify seller/winner access and rejection for unrelated users, wrong invoice data, stale/untrusted signatures and replay. Refresh the same output, test expiry, and test revocation/reorg using a controlled setup. Record software versions, observation times and pass/fail results in a private operator log. Do not commit real invoice/report files, addresses tied to identities, transaction metadata, viewing keys, RPC cookies or signing keys.
