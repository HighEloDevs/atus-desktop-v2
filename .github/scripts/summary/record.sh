#!/usr/bin/env bash
# Run a command, mirror its output to the console and keep a copy for the run summary.
# Usage: record.sh <suite> <command> [args...]   (writes $RUNNER_TEMP/test-logs/<suite>.log)
set -o pipefail
suite="${1:?Usage: record.sh <suite> <command> [args...]}"; shift
dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/test-logs"
mkdir -p "$dir"
"$@" 2>&1 | tee -a "$dir/$suite.log"
exit "${PIPESTATUS[0]}"
