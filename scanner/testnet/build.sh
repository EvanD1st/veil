#!/usr/bin/env bash
# Explicitly invoked experimental lab build. Does not initialize wallets or start services.
set -euo pipefail
if [[ "${1:-}" == "--help" ]]; then
  printf '%s\n' 'Usage: bash scanner/testnet/build.sh NEW_ABSOLUTE_LAB_DIRECTORY' 'Read scanner/testnet/README.md first: unmerged Zallet source with failed upstream audits.'
  exit 0
fi
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || { printf '%s\n' 'This source-build procedure supports native x86_64 Linux only.' >&2; exit 1; }
[[ "${VEIL_EXPERIMENTAL_PIN_APPROVED:-}" == '0d433b322408c30ee48765a98a81af9001108e7d' ]] || { printf '%s\n' 'Explicit operator approval for the experimental commit is required. Read the recorded failed upstream vetting evidence.' >&2; exit 1; }
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-1}"
[[ "$CARGO_BUILD_JOBS" =~ ^[12]$ ]] || { printf '%s\n' 'Use one or two build jobs on the 8 GiB testnet host.' >&2; exit 1; }
export CMAKE_BUILD_PARALLEL_LEVEL="$CARGO_BUILD_JOBS"
export CARGO_PROFILE_RELEASE_DEBUG=0
[[ $# == 1 && "$1" == /* && "$1" != / && ! -e "$1" ]] || { printf '%s\n' 'Choose a new absolute lab directory; existing directories are never overwritten.' >&2; exit 1; }
for program in node git cargo rustup cc c++ cmake clang pkg-config protoc; do command -v "$program" >/dev/null || { printf 'Missing build prerequisite: %s\n' "$program" >&2; exit 1; }; done
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
versions="$script_dir/versions.json"
# Pins come from the tracked manifest, never a moving branch or latest-release URL.
pin() { node --input-type=module -e 'import fs from "node:fs";let v=JSON.parse(fs.readFileSync(process.argv[1]));for(const k of process.argv[2].split("."))v=v[k];process.stdout.write(v);' "$versions" "$1"; }
lab_root="$1"
umask 077
mkdir -m 700 -- "$lab_root"
mkdir -- "$lab_root/src" "$lab_root/bin"
for project in zebra zallet; do
  git init -q "$lab_root/src/$project"
  git -C "$lab_root/src/$project" fetch --depth 1 "$(pin "$project.repository")" "$(pin "$project.commit")"
  git -C "$lab_root/src/$project" checkout --detach FETCH_HEAD
  [[ "$(git -C "$lab_root/src/$project" rev-parse HEAD)" == "$(pin "$project.commit")" ]] || exit 1
  rustup toolchain install "$(pin "$project.rust")" --profile minimal
 done
df -h "$lab_root" > "$lab_root/build-resources.txt"
free -h >> "$lab_root/build-resources.txt"
date -u >> "$lab_root/build-resources.txt"
node --input-type=module -e 'import fs from "node:fs";import{createHash}from"node:crypto";const v=JSON.parse(fs.readFileSync(process.argv[1]));for(const [file,expected]of [["zebra/Cargo.lock",v.zebra.lockSha256],["zallet/Cargo.lock",v.zallet.lockSha256],["zallet/backends/zebra/Cargo.lock",v.zallet.backendLockSha256]])if(createHash("sha256").update(fs.readFileSync(process.argv[2]+"/src/"+file)).digest("hex")!==expected)throw Error("Pinned source lock hash mismatch");' "$versions" "$lab_root"
(
 cd -- "$lab_root/src/zebra"
 cargo +"$(pin zebra.rust)" build --locked --release --package zebrad --features indexer
)
(
 cd -- "$lab_root/src/zallet"
 cargo +"$(pin zallet.rust)" build --locked --release --package zallet
 cargo +"$(pin zallet.rust)" build --locked --release --manifest-path backends/zebra/Cargo.toml --features rpc-cli
)
install -m 700 "$lab_root/src/zebra/target/release/zebrad" "$lab_root/bin/zebrad"
install -m 700 "$lab_root/src/zallet/target/release/zallet" "$lab_root/bin/zallet"
install -m 700 "$lab_root/src/zallet/backends/zebra/target/release/zallet-zebra" "$lab_root/bin/zallet-zebra"
node --input-type=module -e 'import fs from "node:fs";import{createHash}from"node:crypto";const v=JSON.parse(fs.readFileSync(process.argv[1]));v.binaries=Object.fromEntries(["zebrad","zallet","zallet-zebra"].map(n=>[n,createHash("sha256").update(fs.readFileSync(process.argv[2]+"/bin/"+n)).digest("hex")]));fs.writeFileSync(process.argv[2]+"/build-manifest.json",JSON.stringify(v,null,2)+"\n",{flag:"wx",mode:0o600});' "$versions" "$lab_root"
printf '%s\n' 'Built pinned experimental binaries; no services started. Review build-manifest.json and the setup guide.'
