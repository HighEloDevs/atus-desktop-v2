#!/usr/bin/env bash
# Generate an exploratory Rust LCOV report, excluding test-only files and inline test modules.
# LLVM_COV and LLVM_PROFDATA must match rustc's LLVM major version.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
output="${1:?Usage: rust-llvm.sh <output.lcov>}"
case "$output" in /*) ;; *) output="$root/$output" ;; esac
cov="${LLVM_COV:-llvm-cov}"
profdata="${LLVM_PROFDATA:-llvm-profdata}"
compiler_llvm="$(rustc -vV | sed -n 's/^LLVM version: \([0-9]*\).*/\1/p')"
for tool in "$cov" "$profdata"; do
  tool_llvm="$("$tool" --version | sed -n 's/.*LLVM version \([0-9]*\).*/\1/p' | head -n 1)"
  if [[ -z "$compiler_llvm" || "$compiler_llvm" != "$tool_llvm" ]]; then
    echo "LLVM tool $tool does not match rustc LLVM major version $compiler_llvm" >&2
    exit 1
  fi
done
mkdir -p "$(dirname "$output")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# Isolate profiles from other test runs while allowing compiled objects to be cached.
export RUSTFLAGS="${RUSTFLAGS:-} -C instrument-coverage"
export LLVM_PROFILE_FILE="$tmp/%p-%m.profraw"
cargo test --manifest-path src/desktop/Cargo.toml --message-format=json > "$tmp/cargo.jsonl"
node - "$tmp/cargo.jsonl" > "$tmp/binaries" <<'NODE'
const fs = require('node:fs');
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const bins = new Set();
for (const line of lines) {
  let item; try { item = JSON.parse(line); } catch { continue; }
  if (item.reason === 'compiler-artifact' && item.profile?.test && item.executable && item.package_id.includes('atus-desktop')) bins.add(item.executable);
}
if (bins.size !== 1) throw new Error(`Expected exactly one instrumented application test binary; found ${bins.size}`);
process.stdout.write([...bins][0] + '\n');
NODE
binary="$(cat "$tmp/binaries")"
"$profdata" merge -sparse "$tmp"/*.profraw -o "$tmp/merged.profdata"
"$cov" export -format=lcov -ignore-filename-regex='/(project/e2e|project/test_support)\.rs$' -instr-profile="$tmp/merged.profdata" "$binary" "$root/src/desktop/src" > "$output"
node .github/scripts/coverage/rust-strip-tests.mjs "$output"
if ! grep -q '^SF:' "$output"; then
  echo 'Rust coverage report is empty' >&2
  exit 1
fi
echo 'Exploratory report excludes test-only files and inline test modules; platform cfg paths and unlinked code may be absent. Not a production coverage gate.' >&2
