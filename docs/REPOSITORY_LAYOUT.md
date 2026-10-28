# Repository layout

- `frontend/app/`: views, components and styles for the web UI.
- `frontend/components/`, `frontend/hooks/`, `frontend/lib/`: reusable UI building blocks.
- `frontend/auth/`: native login/signup page presentation.
- `frontend/public/`: public images, fonts and proof worker assets; served at the same URLs.
- `frontend/veil/`: browser crypto, proof workers and publication/recovery UI helpers.
- `backend/routes/`: HTTP API handler implementations.
- `backend/auth/`, `backend/runtime/`: authentication and the standalone Node server.
- `backend/db/`, `backend/drizzle/`: schema and immutable database migrations.
- `backend/scanner/`, `backend/judging/`, `backend/escrow/`: payment verification, wallet/auction workers and experimental escrow services.
- `backend/connectors/`: request-scoped server connector adapters.
- `shared/`: auction/payment types, validation, proof verification and the public artwork catalogue used by both sides.

The root `app/` directory contains only framework routing entrypoints that re-export implementations. Vinext/Next convention requires route discovery there; these files do not implement UI or business logic. Build configuration, CI, deployment tooling, circuits, tests, docs and licenses stay at the root.

Run existing `pnpm` commands from the repository root. Dependency versions are unchanged.

The source tree is organized independently of generated output. `scripts/source-layout.mjs` emits the established flat modules into the Ubuntu artifact and CommonJS test harness. The deployed `runtime/server.mjs` startup command, migration paths, scanner/worker release interfaces, public URLs and private data paths therefore stay compatible. Never place private databases, originals, keys or wallet files in any source directory. No migration or data reassignment is part of this refactor.

New source modules should be placed on the appropriate side. If a new module must also be emitted as a legacy-compatible unbundled release module, add its mapping to `scripts/source-layout.json` and include it in the package list. Bundled application imports use explicit `@/frontend/`, `@/backend/` or `@/shared/` paths.

For an operator-reviewed scanner/worker source archive, run `node scripts/package-service-source.mjs /absolute/path/veil-service-source.tar`. It emits the established `judging/`, `scanner/` and `escrow/` archive roots and embeds the source commit without touching any running service. Do not archive the relocated directories directly for an older installer.
