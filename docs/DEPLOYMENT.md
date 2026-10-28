# Deployment targets

**Digital-goods candidate:** use [the new release/migration/private-storage plan](DIGITAL_RELEASE.md) and [paired file/database recovery](DIGITAL_GOODS.md). Migration 0006 is not applied on production. Default new publishing is paused; no original files belong in releases. No merge/deployment is authorized by the implementation request. The current public username/password signup and Ubuntu release are described in the dated record below; older Sites/audience/account statements are historical.

Current Ubuntu release (26 October 2026): the operator approved and deployed PR #16's tested merge-tree artifact `577c90dfe566de35aaff7a8d8e4ab99da3233123`; archive SHA-256 `ddfcce428e7d420f91deb438aeed3c9a56be7425a2343624a69c2f8b55bd4f8f`. [CI 40277354217](https://github.com/EvanD1st/veil/actions/runs/40277354217), isolated artifact smoke testing and post-release public HTTPS authentication/assets checks passed. No migration; all accounts, auctions, bids and reports were preserved. Only VEIL restarted. Fresh backup/integrity, compatible code rollback and remaining experimental/payment/device limits are recorded in [the dated execution record](PAYMENT_VALIDATION_2026-10-25.md). PR #16 remains unmerged. Deployment descriptions below are historical.

Pending native public-signup release: [accounts and rollback](ACCOUNTS.md) describes the no-migration upgrade, optional private `VEIL_ADMIN_ACCOUNT_IDS` allowlist and code/config rollback that retains newly created records. No deployment or merge is performed by that implementation task.

Current Ubuntu release: operator-approved `59c35c5e2bd8ed6c2cb68caa9ace2be23b937200` with queue migration 0004 is deployed. See [fresh backup, rollback and hosted checks](HOSTED_VALIDATION.md). Existing Sites and unrelated services remain unchanged; older identifiers below record historical deployments.

VEIL remains associated with Site project `appgprj_6ad60ddb6cc08191adf85da59c23c6aa` in `.openai/hosting.json`. The source repository is public; the hosted review audience is a separate setting and remains owner-only unless the operator explicitly changes it.

## Source synchronization

A GitHub push or passing CI does not update the Site. Review the branch/PR, record the chosen source commit, then synchronize that exact source through the existing Sites project workflow. Preserve the Site ID, D1 binding `DB`, runtime profile and migration history. A fresh portable checkout must not upload its local mock identity configuration as a production runtime profile. Build/publish only after an explicitly authorized deployment step. This section describes the retained Sites target; the authorized Ubuntu deployment is recorded separately below.

The build packages schema-only migrations in `dist/.openai/drizzle`. The operator must back up the existing database, inspect unapplied migrations and apply them once to the Site's actual bound D1 database. `wrangler.local.json` contains a local placeholder database ID and is only for the hardcoded local initialization script. It must not be used to deploy or target production. Migration 0003 adds a nullable follow-up window and a private action table; existing auctions, bids and results are preserved.

## Environment

Configure only the operator-trusted Ed25519 public key as `VEIL_SCANNER_PUBLIC_KEY`. Wallet RPC endpoints, cookies, private/viewing keys and scanner signing keys remain on the scanner machine. `.env*`, `.sites-runtime`, `.wrangler` and generated outputs are ignored. Never seed production with browser-test auction keys or fixtures.

`VEIL_LOCAL_TEST=1` is exclusively for the isolated loopback test server. Production builds and the managed hosting profile reject it. The built Worker contains no local clock, fixture or identity endpoints. The ordinary local mock sign-in middleware is also a Vite development-server hook and is not part of the hosted Worker.

## Authentication boundary

`backend/auth/chatgpt-auth.ts` consumes the authenticated-user headers supplied by the trusted Sites gateway. That gateway must authenticate users and strip/overwrite caller-supplied `oai-authenticated-*` headers. This is a hosting capability boundary, not standalone verified authentication.

Do not expose `pnpm start`, the local preview or a raw Worker on a public standalone endpoint that accepts those headers from callers. The preview is loopback-only. Independent hosting requires verified authentication and an equivalent identity boundary. The Ubuntu target below supplies administrator-created accounts and verified cookie sessions; the original header-based adapter remains exclusive to Sites.

## Release checks

Follow the [exact-commit release and live-demo checklist](LIVE_TESTNET.md). It requires backup and deliberate migration 0003, existing Sites identity/authentication, test-hook exclusion, and deployed asset hashes. `node scripts/check-deployed-assets.mjs https://veil-private-auctions.softball129.chatgpt.site` is read-only; the unauthenticated attempt on 23 October stopped at HTTP 401 on the first asset. The authorized operator must finish integrity verification in their authenticated session without changing audience.

Run the documented verification sequence and production-boundary check. Confirm the configured Site identity/audience, trusted scanner public key and migration status. Check that every pinned proof asset is available and byte-identical after deployment. Perform live drand/browser and real shielded testnet payment validation before claiming the corresponding integrations complete.

## Ubuntu website - 23 October 2026

The owner authorized moving the website to **https://ve-il.duckdns.org**. The deployed source is `09ca59eaebfda7467ba569369ffa7554245bb169`, built and tested in [CI run 39936389121](https://github.com/EvanD1st/veil/actions/runs/39936389121). Both the existing verification job and the new Ubuntu artifact job passed. No build ran on the workstation or shared Ubuntu server.

Artifact `12493334137` was downloaded directly to Ubuntu, its ZIP digest checked against the Actions metadata, its inner archive checked against the CI-generated checksum, and extraction confined to a fresh release directory. Release archive SHA-256: `16a80c55ea85375a6a0dea157b69228537d4e392b56abc11430caeef56af619d`. The source/Node/asset-manifest provenance is included in `release.json`; private deployment records remain under `/srv/veil/shared`.

The dedicated `veil` account runs `/srv/veil/current/runtime/server.mjs` with Node **24.15.0**, installed from the official Linux x64 archive. The archive SHA-256 is `472655581fb851559730c48763e0c9d3bc25975c59d518003fc0849d3e4ba0f6`; installed Node binary SHA-256 is `d1de76d8edf2fededf6f8b30d244e2c0529ac607923a018283b77e9c74bd932c`. The runtime binds **127.0.0.1:8092**, with a 448 MiB memory ceiling and 25% CPU quota. Caddy imports one new `/etc/caddy/veil.caddy` file; the prior routes and Mintly fragment were retained. HTTPS certificate validation succeeded.

Read-only Sites inspection found **zero rows** in each of `auctions`, `bids` and `payment_reports`, with no truncated results. No source rows needed copying. The original Site, its audience, DB and environment remain unchanged as rollback references. The new SQLite database was explicitly initialized with all four existing migrations plus the standalone account/session tables. An initial consistent SQLite backup and pre-migration service/configuration snapshot were saved privately. No wallet was initialized or funded, no scanner signing key was configured, and no payment occurred.

Owner access is administrator-provisioned; there is no public registration. Credentials are delivered privately, never included in release archives or source. Additional real participants need separate administrator-created accounts. Preserve each account ID when restoring auctions. See [the Ubuntu target guide](../deploy/ubuntu/README.md).

Before a later release or database change, take a consistent SQLite backup using the SQLite backup API (including while WAL is active), verify `PRAGMA integrity_check`, save the runtime environment and current release link privately, and record pre-change row counts/migration hashes. Compare unapplied migration hashes and review SQL before executing anything; startup never migrates an existing database. Stage/test a new release before switching `current` and restarting **only** `veil.service`. A code rollback selects the previous release; a schema rollback requires restoring its matching backup while VEIL is stopped. Do not restore over an active database or discard post-backup writes without operator review. Caddy's pre-VEIL configuration is retained privately for route rollback; validate before every reload.

A fresh guided demo at the Ubuntu origin subsequently completed ordinary future-round drand unlock, real proof generation and independent browser verification. Initial cold asset downloading timed out on the browser connection; a fresh cached demo passed. This is guided-demo evidence only. Genuine separate-account persisted publication, actual wallet/payment and physical-device checks remain pending; details are in [VALIDATION.md](VALIDATION.md).
