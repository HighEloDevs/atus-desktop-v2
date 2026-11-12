#!/usr/bin/env bash
# Produce an LCOV report for the current C++ engine using LLVM source coverage.
# Requires clang, clang++, llvm-profdata, and llvm-cov on PATH.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
output="${1:?Usage: cpp-llvm.sh <output.lcov>}"
case "$output" in /*) ;; *) output="$root/$output" ;; esac
mkdir -p "$(dirname "$output")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Fail closed when the engine gains files: extend this harness to exercise them.
count="$(find src/scientific-engine/src -name '*.cpp' -type f | wc -l | tr -d ' ')"
if [[ "$count" != 1 || ! -f src/scientific-engine/src/mock_analysis.cpp ]]; then
  echo 'Update the C++ coverage harness for the changed engine sources.' >&2
  exit 1
fi

flags=(-fprofile-instr-generate -fcoverage-mapping -Isrc/scientific-engine/include)
clang "${flags[@]}" -c src/scientific-engine/tests/mock_analysis_test.c -o "$tmp/test.o"
clang++ "${flags[@]}" -c src/scientific-engine/src/mock_analysis.cpp -o "$tmp/engine.o"
clang++ "${flags[@]}" "$tmp/test.o" "$tmp/engine.o" -o "$tmp/engine-test"
LLVM_PROFILE_FILE="$tmp/engine.profraw" "$tmp/engine-test"
if command -v xcrun >/dev/null 2>&1; then
  profdata="$(xcrun --find llvm-profdata)"
  cov="$(xcrun --find llvm-cov)"
else
  profdata=llvm-profdata
  cov=llvm-cov
fi
"$profdata" merge -sparse "$tmp/engine.profraw" -o "$tmp/engine.profdata"
"$cov" export -format=lcov -instr-profile="$tmp/engine.profdata" "$tmp/engine-test" src/scientific-engine/src/mock_analysis.cpp > "$output"
