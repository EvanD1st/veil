# Ubuntu deployment target

This target runs the existing VEIL UI, auction protocol, fixed verifier and proof assets on Node 24.15.0. Builds run in GitHub Actions, not on the Windows workstation or the shared Ubuntu host. The normal Cloudflare/Sites build remains available and retains its original authentication/D1 integration.

`pnpm build:ubuntu` selects the separate Vite target. `scripts/package-ubuntu.mjs` packages Vinext's supported standalone Node output, the explicit schema migrations, operator commands and exact source provenance. CI tests the built artifact over HTTP before uploading it.

The Node target maps only its server-side database and identity adapters. Auction/payment SQL and report validation remain unchanged. Its persistent SQLite database enables foreign keys, WAL, full synchronization and the existing unique indexes. Database creation is an explicit exclusive operator command, not a startup migration. The dedicated account/session tables exist only on Ubuntu. No database or data in Sites is modified by this target.

Accounts are administrator-created using `runtime/admin.mjs account`; there is no public registration or sample password. Passwords use salted scrypt; opaque random session tokens are stored only as SHA-256 hashes, expire after 12 hours, and are revoked on logout. Cookies are Secure, HttpOnly, host-only and SameSite=Strict. Sign-in/out POSTs require the configured HTTPS origin. Sign-in concurrency and attempts are bounded. Caller-supplied `oai-authenticated-*` headers cannot authenticate the Node target. The existing UI's sign-in/out paths are handled by the standalone server.

Use `/srv/veil/releases/COMMIT`, `/srv/veil/shared` and `/srv/veil/runtime` under a dedicated `veil` service account. The systemd template binds only 127.0.0.1:8092, applies resource limits and gives writes only to the shared state directory. Caddy gets a separate hostname block and forwards HTTPS to that loopback listener. Keep the Mintly configuration and containers unchanged. Do not reuse the removed VESSEL directories or service account.

Before activating a release:

1. Record the reviewed source SHA and green CI/artifact digest. Check downloaded archive paths and SHA-256 before extraction into a new release directory.
2. Choose a hostname controlled by the owner; configure its DNS and `VEIL_PUBLIC_ORIGIN`. Do not expose the raw Node port or use a development server.
3. Export the existing Sites data privately and preserve actor IDs if migrating its auctions. Keep an operator-reviewed backup and validate row counts, IDs and full auction/bid/result bytes. Never silently overwrite an existing SQLite database or assume a new account ID owns old records.
4. Initialize the new database deliberately and create the owner's account via hidden stdin. Keep credentials, sessions, SQLite files, RPC settings and scanner keys out of artifacts/source. `VEIL_SCANNER_PUBLIC_KEY` is the only optional payment setting on the website.
5. Start only the new VEIL service; verify loopback login/logout, forged-header rejection, persistence, role separation and proof asset hashes. Validate the Caddy config before a graceful reload, and check Mintly and Smart Attendance still return their expected status.
6. Test the real future drand flow and independent result verification with ordinary clocks. Payment and physical-device validation remain separate operator gates; this deployment initializes or funds no wallet.

The inspected shared server has two CPUs, approximately 1.9 GiB RAM and 6.8 GB free disk after removing VESSEL. This can be evaluated for the bounded website runtime. It does **not** have capacity for a Zebra/Zallet source build and synchronized testnet node. The upstream NU7 dependency-vetting gate remains unresolved; this web target does not bypass or resolve it.

## Current instance

The owner-authorized hostname is https://ve-il.duckdns.org. Source `09ca59eaebfda7467ba569369ffa7554245bb169` is deployed with the CI artifact, explicit database initialization, private owner account and separate Caddy import. The source Site is retained unchanged. See [deployment provenance and rollback](../../docs/DEPLOYMENT.md) and [actual validation evidence](../../docs/VALIDATION.md).
