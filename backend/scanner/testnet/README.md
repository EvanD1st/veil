# Pinned testnet lab

Prepared 23 October 2026. All three explicitly authorized experimental binaries built successfully on the isolated AWS host. The separately approved [minimum-pool patch](patches/README.md) is installed: actual wallet status/account RPC responds and a backed-up testnet account/Sapling receiver has been derived. Both services passed a repeat whole-host reboot with zero failure restarts and clean patched-wallet shutdown. Zebra and wallet synchronization remain pending. See [actual execution evidence](../../../docs/TESTNET_SERVICE.md). This is an experimental setup candidate, not a release-certified integration. Use the [live runbook](../../../docs/LIVE_TESTNET.md) to track the remaining gates.

## Version decision and blocker

[versions.json](versions.json) is authoritative; build.sh fetches exact commits, checks the backend lock SHA-256 and uses `--locked`. It never fetches a moving branch for the build.

| Component | Selected source | Evidence |
| --- | --- | --- |
| Zebra | 7.0.0, `e8db87eb69254e0d4eedd058eadd48bdfa09065a` | [release](https://github.com/ZcashFoundation/zebra/releases/tag/v7.0.0), [state format](https://github.com/ZcashFoundation/zebra/blob/e8db87eb69254e0d4eedd058eadd48bdfa09065a/zebra-state/src/constants.rs) |
| Zallet | `0d433b322408c30ee48765a98a81af9001108e7d`, upstream PR 898 | [unmerged NU7 update](https://github.com/zcash/zallet/pull/898), [backend manifest](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/backends/zebra/Cargo.toml), [locked dependencies](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/backends/zebra/Cargo.lock) |
| Toolchains | Rust 1.91.0 for Zebra; 1.95.0 for Zallet | Each pinned repository's `rust-toolchain.toml` |

Both selected sources use **zebra-state 16.0.0**, state **29.0.0 with indexer**. The Zallet backend enables its `indexer` feature; `zebrad` must also be compiled with `--features indexer`. Its indexer gRPC port serves the non-finalized tip; Zallet also opens the same host's finalized RocksDB state read-only. JSON-RPC alone is insufficient.

The latest published Zallet release is beta.3, commit `987382f67e622915228686e9f956c6a9c9a7514c`. Inspected Zallet `main` at `d29642929488685dd14e033e001b2dc9d3b28701` still locks zebra-state 12.0.1/v28. Neither is the selected NU7 build. Zebra 7 writes v29; do not combine it with the beta.3 binary, rename database directories, or downgrade Zebra to make an old reader open the database. Testnet NU7 activates at 4,465,026. [Zebra's upgrade notes](https://github.com/ZcashFoundation/zebra/releases/tag/v7.0.0-rc.0) require upgrading direct readers with the node.

At inspection, PR 898's required status/lint checks passed, but **required audits failed** because of the dependency-vetting backlog; its description also records an integration-test expectation still needing attention. This is an explicit release gate. Do not describe this pair as fully supported or audited. An operator may evaluate the pinned source in a disposable testnet lab; an approved upstream version and actual response/sync evidence are still required for a complete demonstration. Re-review upstream status and update the entire pin set deliberately when that gate clears. Do not silently substitute a release or skip failed audits.

## Supported procedure environment

The preparation procedure targets **native x86_64 Linux**, with Ubuntu 24.04 LTS as the operator baseline, one trusted OS account and a local ext4/XFS filesystem. The exact build has not been run on that OS here. Zallet's current backend is Linux-only; see [platform support](https://zcash.github.io/zallet/guide/platform-support.html) and the pinned [installation source](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/book/src/guide/installation/README.md). No Docker recipe is offered.

Use at least 4 cores and preferably 16 GB RAM. Zebra documents roughly 10 GB of Testnet state, growing over time; Rust/RocksDB builds and backup copies need considerably more. Reserve **100 GB of free SSD space as a lab planning budget**, monitor actual usage, and increase it if needed. This budget is not a measured requirement. See [Zebra requirements](https://github.com/ZcashFoundation/zebra/blob/e8db87eb69254e0d4eedd058eadd48bdfa09065a/book/src/user/requirements.md). Sync can take hours and must finish before the demo. Never treat reaching an old local tip as current sync.

The development workstation is Windows. Its external `E:` drive is FAT32 with about 3.7 GB free: usable for small test temporary files, unsuitable for this live RocksDB lab. Do not put the state on FAT32, an NTFS mount, a network share or a Windows-mounted WSL directory. A Linux VM needs its own native Linux virtual disk with enough space; that route has not been tested here.

## Build and configuration

Install Node 24 and Git, Rustup, a C/C++ toolchain, CMake, Clang/libclang, pkg-config, OpenSSL development headers, protobuf compiler and CA certificates through the host's package manager. On the chosen Ubuntu baseline:

```sh
sudo apt-get update
sudo apt-get install build-essential clang libclang-dev cmake pkg-config libssl-dev protobuf-compiler git ca-certificates
```

OS package versions are host-managed; the Rust versions, source commits and Cargo locks are pinned. This is a reproducible source selection and recorded binary hashes, not a claim of bit-for-bit reproducible binaries across OS/compiler packages. Record those package versions with the private build log. Build only after reviewing the upstream blocker above:

```sh
# Run from the VEIL checkout. Choose a NEW directory under an existing private parent.
export VEIL_LAB_ROOT="$HOME/veil-testnet-lab"
umask 077
bash backend/scanner/testnet/build.sh "$VEIL_LAB_ROOT"
node backend/scanner/testnet/configure.mjs "$VEIL_LAB_ROOT"
export PATH="$VEIL_LAB_ROOT/bin:$PATH"
zebrad --version
zallet --version
zallet-zebra --version
```

Builds do not start services, initialize a wallet, deploy VEIL or send funds. `build-manifest.json` records source pins and actual binary SHA-256 hashes. Keep it with the private evidence. Keep launcher and backend from the same build. A failed build leaves its lab directory intact for inspection; choose a new directory for a clean attempt instead of overwriting it.

The generator writes `zebrad.toml`, separate `receiver/zallet.toml` and `sender/zallet.toml`, and scanner configs. It refuses existing configs or nonempty wallet/state directories. `service.env` points to an owner-only `private/scanner-receivers.json` file. That file must contain a JSON array of the exact seller Sapling receivers the receiver wallet has imported; keep it in sync with the website's `VEIL_DIGITAL_SELLERS_FILE`. The scanner accepts at most 100 distinct checksum-valid testnet receivers and fails closed on malformed config. Add a receiver only after importing its dedicated viewing account and waiting for the wallet rescan to finish. Review the generated files before startup:

| Service | Binding/config |
| --- | --- |
| Zebra P2P | testnet, `127.0.0.1:18233`; outbound peers still required |
| Zebra JSON-RPC | `127.0.0.1:18232`, cookie auth enabled, cookie in `node-auth/.cookie` |
| Zebra indexer gRPC | `127.0.0.1:18230`; loopback only |
| Receiving Zallet | `127.0.0.1:28232`, `receiver/.cookie` |
| Sending Zallet | `127.0.0.1:28233`, `sender/.cookie` |
| Shared state | `$VEIL_LAB_ROOT/state`; identical absolute `cache_dir` / `zebra_state_path` |

Both wallet configs explicitly select `backend = "zebra"`, consensus `network = "test"`, the node's cookie and gRPC port, and require mnemonic backups. There are no RPC passwords or keys in the tracked templates. All RPC and indexer ports stay loopback-only; do not forward/publish them. Processes on the lab host can still access local services: use a trusted account/host. [Zallet's RPC transport is plaintext](https://zcash.github.io/zallet/guide/setup.html); Basic authentication is not encryption.

## Start and initialize a NEW receiving wallet

In a dedicated terminal, run the exact configured node in the foreground:

```sh
zebrad -c "$VEIL_LAB_ROOT/zebrad.toml" start
```

Wait for initial node sync, checking private node logs and RPC; `getblockchaininfo` must identify `test`, current blocks/estimated height, and the expected NU7 consensus. Do not enable `debug_force_finished_sync`. The scanner later checks tip age, progress and wallet agreement too.

For a **new testnet wallet only**, in another terminal:

```sh
zallet -d "$VEIL_LAB_ROOT/receiver" generate-encryption-identity
zallet -d "$VEIL_LAB_ROOT/receiver" init-wallet-encryption
zallet -d "$VEIL_LAB_ROOT/receiver" generate-mnemonic
zallet -d "$VEIL_LAB_ROOT/receiver" confirm-backup
```

The default identity is an owner-only **unencrypted age identity file**. Reading it permits spending; protect the account/disk and back it up separately. This avoids placing an unlock passphrase in command arguments. A passphrase-encrypted identity is supported upstream but requires a separate private unlock workflow; do not paste a passphrase into shell history. See [identity initialization](https://zcash.github.io/zallet/cli/init-wallet-encryption.html).

`generate-mnemonic` outputs a fingerprint, not a recovery phrase. `confirm-backup` walks through export/decryption and verifies selected words. Obtain age tooling through a reviewed installation before this step, and follow the pinned [backup-confirmation instructions](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/book/src/cli/confirm-backup.md); do not disable `require_backup`. Preserve the encrypted export and verified offline recovery copy privately. Never regenerate a mnemonic for an existing wallet or delete/replace an identity.

Now start the receiver in its own foreground terminal:

```sh
zallet -d "$VEIL_LAB_ROOT/receiver" start
```

From an operator terminal (the quoted strings are JSON arguments):

```sh
zallet -d "$VEIL_LAB_ROOT/receiver" rpc getwalletstatus
zallet -d "$VEIL_LAB_ROOT/receiver" rpc z_getnewaccount '"VEIL receiving testnet"'
# Replace ACCOUNT_UUID with the returned account_uuid.
zallet -d "$VEIL_LAB_ROOT/receiver" rpc z_getaddressforaccount '"ACCOUNT_UUID"' '["sapling","p2pkh"]'
zallet -d "$VEIL_LAB_ROOT/receiver" rpc z_listunifiedreceivers '"RETURNED_UNIFIED_ADDRESS"'
```

Use only the returned **`sapling`** receiver (`ztestsapling1…`) in VEIL. The UA above is an intermediate wallet derivation format, not an accepted VEIL payment destination. Save/confirm that actual address locally; a checksum-valid synthetic test address is not a destination. A wallet without an account may omit scan heights; create the account, then wait for full scan completion before preflight.

For a separate viewing-only receiver, export the **Sapling** extended full viewing key from the owning wallet and import into a new configured receiving wallet. The selected RPC supports `z_exportviewingkey '"SAPLING_ADDRESS"'` and `z_importviewingkey '"SAPLING_EXTENDED_FULL_VIEWING_KEY"' '"yes"' START_HEIGHT`. Use an accurate birthday no later than the payment; omitted height defaults to 0 and rescans full history. These are schema descriptions: substitute secrets through a private RPC client, not shell command arguments/history. The scanner's client intentionally does not allow import/export methods. Check the imported address and completed rescan; do not assume an incoming-only or Unified viewing key is accepted by `z_importviewingkey`. [Pinned import source](https://github.com/zcash/zallet/blob/0d433b322408c30ee48765a98a81af9001108e7d/zallet-core/src/components/json_rpc/methods/import_viewing_key.rs).

Repeat the new-wallet initialization/account/address process for `sender` if using the Zallet sending path. Its wallet is distinct and must be independently backed up and funded with testnet coins before the demo. Keep sender and receiver keys/identities separate. Do not fund anything under the implementation task.

## Scanner readiness and restart

```sh
# From VEIL checkout. Creates a NEW Ed25519 file; never overwrites.
node backend/scanner/scan.mjs keygen "$VEIL_LAB_ROOT/scanner.pem"
. "$VEIL_LAB_ROOT/scanner.env"
node backend/scanner/scan.mjs preflight
```

Only the printed `VEIL_SCANNER_PUBLIC_KEY` belongs in VEIL's existing Site environment. The private key, age identities, wallet databases, cookies, RPC endpoints and reports stay local. Preflight reads the signing key type, RPC discovery, current node tip/header and wallet sync. It signs nothing, writes nothing and prints no addresses, txids, memos, credentials, key material or private file paths. Without a transaction it does **not** validate transaction/output schema. Add `preflight PRIVATE_INVOICE.json TXID SAPLING_OUTPUT` for the same read-only output checks as a scan; it still produces no report.

Readiness limits are conservative VEIL policies: progress at least 0.999, estimated height at most three blocks ahead, matching headers/blocks, tip no older than 20 minutes or over two minutes in the future. Wallet must be unlocked for **sync purposes**, have no remaining sync work, and match both node-tip height/hash and fully scanned height. Zallet's `getwalletstatus.locked` describes sync safety, not whether spending keys are decrypted. A stopped/testnet-stalled network can fail these readiness gates; investigate, never manufacture a confirmation or relax the checks to get a demo pass.

Stop receiver and sender first using their terminal's Ctrl+C; wait for exit. Then stop Zebra with Ctrl+C and wait for cleanup. SIGINT/SIGTERM are supported. Avoid forced termination. For restart, run the same node config first, then each wallet with its original datadir; do not rerun initialization. Cookie files rotate on restart; the scanner rereads each cookie before every request. Use a new private report filename on each scan.

Back up a wallet with `zallet -d "$VEIL_LAB_ROOT/receiver" backup NEW_PRIVATE_BACKUP_PATH` (repeat for sender), and preserve the age identity separately. An uncleanly stopped wallet may need one start/clean stop before backup. Before binary/state upgrades, stop all readers and the node, back up wallets and state, and review reader/state compatibility as a set. Zebra 7 moves v28 to v29 in place; setting old-database cleanup off does not preserve the original v28 directory. Never perform an upgrade against existing data as an incidental test.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| State v29 not found | Confirm exact binaries/pins, indexer feature and shared absolute state root. Do not rename a v28 database. |
| gRPC connection refused | Check the node is running with `indexer_listen_addr`; a default build omits indexer support. |
| HTTP 401 / cookie unreadable | Check the matching service/datadir and owner-only cookie path; do not print cookie contents or disable authentication. |
| RPC schema unsupported / missing method | Compare installed binary hashes and pinned OpenRPC/source. Capture privately and review; do not cast strings or treat missing fields as confirmation. |
| Wallet locked, heights absent or diverging | Finish account creation/import and historical scans, check peers/node sync, then retry. |
| Stale tip / wrong clock | Check time synchronization, peers, current Testnet consensus and node logs. |
| Proving/send operation slow | Inspect its existing operation ID; never resubmit merely because the response is slow. |
| Disk full / RocksDB error | Cleanly stop services and expand native Linux storage; preserve wallet identity/backups and state. |

Actual authenticated discovery, startup wallet status, account/address derivation and node status were captured privately on AWS. These establish partial RPC compatibility, not synchronized readiness or shielded-output/payment evidence. Source-derived synthetic test cases remain labeled as such; no sensitive actual captures are published.


## Bounded recovery batches on constrained hosts

The pinned experimental Zallet supports `[sync] recover_batch_size = 100`. Fresh-lab templates select this instead of its 1,000-block default because whole recovery batches are held in memory. It changes scheduling, not scan coverage, consensus or strict readiness. Do not override `lock_threshold` to make a partial wallet appear ready.

For an existing wallet, stop only the affected optional sender, take an integrity-checked private backup, review its existing configuration and add the supported sync setting once. Preserve state, birthday and account identity; never rerun the initializer over it. Start it with existing resource caps and observe actual scan advancement, cgroup OOM/reclaim counters and reserve for the working node/receiver/scanner. A smaller batch is not proof that every host can run two wallets. Record a clean restart and soak; pause the sender if capacity or existing-service readiness degrades. See [the actual host trial and outstanding limits](../../../docs/PAYMENT_VALIDATION_2026-10-25.md).

The longer 25 October sender trial did OOM repeatedly. Subsequent diagnostics must use a bounded one-shot profile such as [sender-validation.conf](systemd/sender-validation.conf): no automatic restart, a finite runtime and no boot activation. Review headroom first, then read back actual `MemoryHigh`, `MemoryMax`, `MemorySwapMax`, CPU, restart and runtime properties after reload and after stop/start. Inspect `DropInPaths`: a later `resources.conf` can override persisted `50-*.conf` property files, even when a live `systemctl set-property` temporarily applied new values. Back up and reconcile the affected sender's settings; do not change receiver/template limits. The 26 October trial reached strict synchronization and a funded read-only balance and recovered readiness after a clean restart; this is not outgoing-payment or sustained-capacity evidence.
