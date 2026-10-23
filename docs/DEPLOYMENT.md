# Existing Sites deployment

VEIL remains associated with Site project `appgprj_6ad60ddb6cc08191adf85da59c23c6aa` in `.openai/hosting.json`. The source repository is public; the hosted review audience is a separate setting and remains owner-only unless the operator explicitly changes it.

## Source synchronization

A GitHub push or passing CI does not update the Site. Review the branch/PR, record the chosen source commit, then synchronize that exact source through the existing Sites project workflow. Preserve the Site ID, D1 binding `DB`, runtime profile and migration history. A fresh portable checkout must not upload its local mock identity configuration as a production runtime profile. Build/publish only after an explicitly authorized deployment step. No deployment was performed for this change.

The build packages schema-only migrations in `dist/.openai/drizzle`. The operator must back up the existing database, inspect unapplied migrations and apply them once to the Site's actual bound D1 database. `wrangler.local.json` contains a local placeholder database ID and is only for the hardcoded local initialization script. It must not be used to deploy or target production. Migration 0003 adds a nullable follow-up window and a private action table; existing auctions, bids and results are preserved.

## Environment

Configure only the operator-trusted Ed25519 public key as `VEIL_SCANNER_PUBLIC_KEY`. Wallet RPC endpoints, cookies, private/viewing keys and scanner signing keys remain on the scanner machine. `.env*`, `.sites-runtime`, `.wrangler` and generated outputs are ignored. Never seed production with browser-test auction keys or fixtures.

`VEIL_LOCAL_TEST=1` is exclusively for the isolated loopback test server. Production builds and the managed hosting profile reject it. The built Worker contains no local clock, fixture or identity endpoints. The ordinary local mock sign-in middleware is also a Vite development-server hook and is not part of the hosted Worker.

## Authentication boundary

`app/chatgpt-auth.ts` consumes the authenticated-user headers supplied by the trusted Sites gateway. That gateway must authenticate users and strip/overwrite caller-supplied `oai-authenticated-*` headers. This is a hosting capability boundary, not standalone verified authentication.

Do not expose `pnpm start`, the local preview or a raw Worker on a public standalone endpoint that accepts those headers from callers. The preview is loopback-only. Independent hosting requires verified authentication and an equivalent trusted identity boundary first; it is outside this change. No public standalone endpoint was created.

## Release checks

Run the documented verification sequence and production-boundary check. Confirm the configured Site identity/audience, trusted scanner public key and migration status. Check that every pinned proof asset is available and byte-identical after deployment. Perform live drand/browser and real shielded testnet payment validation before claiming the corresponding integrations complete.
