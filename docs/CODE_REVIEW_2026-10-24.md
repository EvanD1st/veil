# Authentication, payments and escrow review — 24 October 2026

Reviewed main `8b2be224acfee844b9ce06210ec6ba00e3ecd78c`, whose latest CI passed. This is a focused source/test review, not a security audit or actual payment validation.

## Confirmed defects and fixes

- **Origin validation (P2):** browser API writes compared only hosts. A supplied `http://veil.test` Origin matched an HTTPS request; malformed origins raised an internal error. Compare a supplied Origin with the full request origin and return JSON 403 for mismatches, opaque, empty or malformed values. Existing non-browser calls without Origin remain compatible; cross-site Fetch Metadata is still rejected. Scanner bearer authentication remains independent.
- **Delivery deadlines (P2):** lazy order creation started the delivery window at first access, allowing late access to postpone an otherwise fixed target. New orders now derive their deadline from the published result timestamp plus the snapshotted delivery days. Invalid timestamps fail before order insertion. Existing stored orders and all direct-payment data remain unchanged.
- **Frozen refund control (P2):** cancelling a requested settlement through a dispute removed the active intent, re-enabling the refund control even though the API/database still forbid changes. The private order response now supplies the frozen state, including disputes and historical intents. The browser disables both field and submission, and the API explicitly enforces the same policy. It does not implement a destination correction workflow.

Regression tests reproduced the three defects before fixes. Added delayed/overdue first access and invalid timestamp tests, scheme/opaque/malformed origin tests and a synthetic production-browser assertion for the disabled refund control.

## Validation and limits

Local focused regressions: 5 passed. Native account/session, public signup, permissions, throttling, redirect and migration tests: 8 passed. Typecheck, script syntax and diff checks passed.

An initial full local run included the intentional failing regressions and the existing Linux-permission outbox restart check, which cannot reopen its protected file on this Windows filesystem. A broader local proof run then exhausted workstation memory. No permission check or proof validation was weakened. Full Linux tests, production builds and browser checks must be verified for the final pushed commit in CI; record the exact run in the PR.

No migration or new configuration is required. No live release, database change, wallet operation, synchronization change, scanner activation or transfer is part of this review. Escrow creation/spending remain disabled. Wallet readiness, live payment/escrow integration and physical-device validation remain separate pending gates. The experimental Zallet candidate and failed upstream vetting status are unchanged.
