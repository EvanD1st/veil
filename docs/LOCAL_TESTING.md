# Local development and browser tests

Use Node 24 and the pnpm version pinned in `package.json`. Install with `pnpm install --frozen-lockfile`.

## Ordinary local workspace

```sh
pnpm db:local
pnpm dev
```

The app listens on `http://127.0.0.1:5173`. The database is local D1 state under `.wrangler/state`. The schema-only SQL migrations in `drizzle/` are applied by the initialization command, which hardcodes `--local`. Re-running it applies only unapplied migrations. No production data or seeds are copied. Use `/signin-with-chatgpt` for the single local preview identity.

## Isolated multi-user test workspace

```sh
node scripts/db-local.mjs --e2e
pnpm dev:test
```

Open `http://127.0.0.1:5174/__veil/identity?as=seller`. Use separate browser profiles/contexts and replace `seller` with `bidder-1` through `bidder-10`, or `observer`. A cookie chooses the test identity. This is deliberate local impersonation, not an authentication system.

This mode binds to loopback, checks the socket and Host header, strips supplied authenticated-user headers, rejects cross-site requests and requires `VEIL_LOCAL_TEST=1`. It cannot run with the managed hosting profile or a production build. The test cookie and clock routes are absent from the production Worker.

The D1 state is separate: `.sites-runtime/e2e/state`. Migrations are identical to the ordinary workspace. Do not point these tools at a hosted database. All generated keys, reports, downloads, screenshots and test state stay in ignored runtime directories or browser memory.

### Deterministic timing and drand fixture

The isolated Worker starts at `1692806243999` milliseconds, just over two minutes before quicknet round 1000. `POST /__veil/clock` with `{ "now": 1692806364100 }` advances its test clock. This endpoint exists only in the explicitly enabled local test runtime. Browser tests set their browser clock separately through Playwright.

`/api/drand/public/1000` returns the committed, signed quicknet fixture with `X-VEIL-Test-Fixture: quicknet-round-1000`. Its signature is still verified by the production tlock code. This deliberately makes the old beacon available to deterministic tests; it does **not** test live future drand availability or threshold secrecy. Ordinary development and hosting use the live fixed drand upstreams.

New test auctions created two minutes before this round close immediately before round 1000. The guided demo begins twenty seconds before the round. Test clocks affect timing, not the circuit, commitments, winner selection or verification keys.

## Browser suite

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

On this Windows workstation the configuration uses installed Chrome (`channel: chrome`). CI uses Playwright Chromium and installs it with `--with-deps`. Set `CI=1` to use that downloaded Chromium locally. The suite starts its own server on port 5174, initializes local migrations and runs one browser worker at a time. Close a manually started test server first.

Tests exercise actual browser Workers, pinned WASM/runtime/zkey files, encryption and PLONK verification. They include guided lower/higher/tied bids, persisted auctions, no-winner proofs, wrong/restored keys, self/late bids, bid limits, malformed envelopes, rejected proofs, lost publication responses, network/integrity failures, cancellation, keyboard focus and a mobile viewport. Transport faults are labelled injections; cryptographic success is never substituted.

Results are written to `.sites-runtime/e2e/results.json`. Screenshots are saved only on failures; traces are disabled to avoid recording private auction keys or openings. Viewport emulation checks layout and keyboard behavior; it is not a physical-device memory/performance measurement.

## All verification commands

```sh
pnpm typecheck
pnpm test
pnpm build
node scripts/test-bundle.mjs
node scripts/test-prover-worker.mjs
node scripts/check-production-boundary.mjs
pnpm test:e2e
```

Negative circuit tests print expected constraint errors. Proof generation needs substantial memory and downloads about 80 MB on a cold browser cache. Run the suites sequentially on constrained machines. Keep enough disk space for dependencies, local D1 state and production assets.
