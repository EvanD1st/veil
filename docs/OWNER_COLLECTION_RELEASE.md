# Owner collection: one real auction per artwork

The ten public previews are not auctions until publication succeeds. Publish as the
existing native `owner` account, using its existing backed-up Test wallet. No new
seed, substitute receiver, mainnet transfer or starter-funding increase is allowed.

## Prepare and verify receiver coverage

Build `veil-seller-view` with the pinned Zingolib workflow. It is a separate,
read-only executable: do not replace the validated `veil-managed` signing binary,
its hash, capability evidence or treasury configuration. The companion reads the
encrypted individual wallet and returns only its Sapling extended full viewing key,
original birthday and bound address through a private pipe. Never run it with an
interactive stdout or save/log its raw output. The upstream experimental status
and failed cargo-vet evidence still apply.

On the wallet host, create an owner-only JSON configuration with `ownerUsername`
set to `owner`, `ownerAccountId` resolved from the website's actual native account,
`serviceConfig` pointing to the existing private managed-service JSON,
`exportBinary` and its reviewed `exportBinarySha256`, a private `journalRoot`, and
`rpcEnvironment` containing the existing numeric-loopback Zallet/Zebra RPC URLs and
cookie-file paths. No credentials belong in argv, source, public assets or logs.

Run `node judging/owner-enrollment.mjs PRIVATE_CONFIG`. This derives the receiver
from the private managed-wallet journal, checks the backup checkpoint, imports only
the viewing key with its actual birthday, then requires two consecutive strict
readiness observations. Existing node/wallet configuration is not reset or
restarted. A diversified receiver can differ from the import RPC's default
address: both are checked against the same exported key. An uncertain import is
resumed with that same key; it never creates another wallet. The private
`owner-receiver.json` receipt contains no viewing/spending key or recovery phrase.

Only a ready receipt may be used to add that receiver to the scanner allowlist and
the native owner's private seller map. Preserve every previous receiver and its
outstanding invoice coverage. Reconcile the owner's pending manual setup request
to this same managed address; never change any published invoice destination.
Confirm strict readiness and the running scanner's effective receiver list before
allowing publication. Do not mark coverage ready merely because a process runs.

## Publish and supervise

1. Take a consistent matched database/private-files backup, plus private operator
   configuration and auction-key journal backups. Verify hashes and integrity.
2. Install the exact green website artifact. No new database migration is needed.
   Set `VEIL_DEMO_SELLER_ID` to the resolved owner ID, `VEIL_DEMO_ENABLED=1`,
   `VEIL_GENESIS_RECURRING=0`, and the reviewed private original import manifest.
3. Configure the separate bounded proof worker with the native owner's private
   login, `ownerUsername: "owner"`, `enabled: true`, `recurring: false`, the private
   originals and durable journal directories. It needs auction keys and its own
   native login only, never wallet/signing/scanner credentials. Use the existing
   memory admission, kernel flock and systemd resource caps; run no prover on the
   small website host. Trial the worker on isolated test data first.
4. Run `node judging/run.mjs seed-all PRIVATE_WORKER_CONFIG` under the worker's
   identity. It preflights all ten original hashes before uploads, verifies the
   authenticated owner and exact managed receiver, and fixes each reservation to
   3,024,000 seconds and 1,000,000 zatoshis (0.01 TAZ). Recovery keys precede
   publication. Resume retained journals after uncertainty; never replace keys,
   recreate an existing auction or extend its reserved closing time.
5. Verify exactly ten distinct published IDs with `owner` as their actual account
   owner, matching frozen originals, correct starting amounts and 35-day windows.
   Back up the resulting private recovery journals before enabling the worker.
6. Start the separately admitted proof worker with `recurring: false`. It reveals
   closed auctions and publishes only verifier-accepted results. Its native login
   is renewed each iteration. Failed or uncertain results retain bids and keys
   for private review. The server independently rejects replacement editions by
   default, including old queued demand or direct reserve calls.

Featured cards open the actual auction directly and show its seller, starting bid,
countdown and final winning amount. Only the winning buyer receives the canonical
invoice; only independently verified payment grants the protected original.
Existing self-bid, CSRF, scanner bearer authentication, exact-output and entitlement
checks remain in force. A 0.002 TAZ starter grant is **not enough** to pay a 0.01 TAZ
winning invoice plus fees; this release does not silently increase funding caps.
Any real testnet transfer needs separate exact approval.

## Rollback and evidence

Stop new seeding and the proof worker independently if checks fail. Keep the
matched backup, existing database, protected originals, accepted bids, keys,
coverage for outstanding invoices and earned downloads. Select a schema-compatible
website artifact; never restore a database from before a purchase. Retain the
viewing-only account after enrollment rather than deleting historical coverage.

Record exact commit/artifact hashes, CI runs, worker admission/resource evidence,
private backup location and the ten ID/deadline bindings in the deployment record.
Short deadlines and synthetic signed payment observations are isolated tests,
not evidence that the live 35-day auctions closed or received payment.
