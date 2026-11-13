#!/usr/bin/env bash
# Explore combined native desktop and unit-test coverage on macOS.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
# With --no-coverage the script only builds and runs the desktop smoke, without instrumentation.
coverage=1
if [[ "${1:-}" == --no-coverage ]]; then
  coverage=0; output=''
else
  output="${1:?Usage: collect-rust-coverage.sh <output.lcov> | --no-coverage}"
  case "$output" in /*) ;; *) output="$root/$output" ;; esac
fi
[[ "$(uname -s)" == Darwin ]] || { echo 'This exploratory runner requires macOS.' >&2; exit 1; }
cov="${LLVM_COV:-llvm-cov}"
profdata="${LLVM_PROFDATA:-llvm-profdata}"
if (( coverage )); then
compiler_llvm="$(rustc -vV | sed -n 's/^LLVM version: \([0-9]*\).*/\1/p')"
for tool in "$cov" "$profdata"; do
  major="$("$tool" --version | sed -n 's/.*LLVM version \([0-9]*\).*/\1/p' | head -n 1)"
  [[ -n "$compiler_llvm" && "$major" == "$compiler_llvm" ]] || { echo "LLVM tool $tool does not match rustc LLVM major version $compiler_llvm" >&2; exit 1; }
done
fi
node --input-type=module -e '
import net from "node:net";
for (const port of [1420, 4455]) {
 const s = net.createServer();
 await new Promise((resolve, reject) => s.once("error", reject).listen(port, "127.0.0.1", resolve));
 await new Promise((resolve, reject) => s.close(error => error ? reject(error) : resolve()));
}
' || { echo 'Ports 1420 and 4455 must be free.' >&2; exit 1; }
tmp="$(mktemp -d "${TMPDIR:-/tmp}/atus-rust-e2e.XXXXXXXX")"
app_pid=''; vite_pid=''
cleanup() {
  [[ -z "$app_pid" ]] || kill "$app_pid" 2>/dev/null || true
  [[ -z "$vite_pid" ]] || kill "$vite_pid" 2>/dev/null || true
  [[ -z "$app_pid" ]] || wait "$app_pid" 2>/dev/null || true
  [[ -z "$vite_pid" ]] || wait "$vite_pid" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT
mkdir -p "$tmp/projects" "$tmp/profiles"
if (( coverage )); then
mkdir -p "$(dirname "$output")"
export RUSTFLAGS="${RUSTFLAGS:-} -C instrument-coverage"
export LLVM_PROFILE_FILE="$tmp/profiles/%p-%m.profraw"
# Apply link-dead-code only to the application/test targets, not dependencies.
cargo rustc --manifest-path src/desktop/Cargo.toml --features desktop-e2e --bin atus-desktop -- -C link-dead-code
cargo rustc --manifest-path src/desktop/Cargo.toml --tests --message-format=json -- -C link-dead-code > "$tmp/cargo.jsonl"
node - "$tmp/cargo.jsonl" > "$tmp/binary" <<'NODE'
const fs = require('node:fs');
const bins = new Set();
for (const line of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  let item; try { item = JSON.parse(line); } catch { continue; }
  if (item.reason === 'compiler-artifact' && item.profile?.test && item.executable && item.package_id.includes('atus-desktop')) bins.add(item.executable);
}
if (bins.size !== 1) throw new Error(`Expected one test binary; got ${bins.size}`);
process.stdout.write([...bins][0]);
NODE
"$(cat "$tmp/binary")"
else
cargo build --manifest-path src/desktop/Cargo.toml --features desktop-e2e --bin atus-desktop
fi
(cd src/frontend && exec node ./node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 1420 --strictPort) > "$tmp/vite.log" 2>&1 & vite_pid=$!
wait_http() {
  local url="$1" pid="$2" attempt
  for attempt in {1..90}; do
    kill -0 "$pid" 2>/dev/null || { echo "Process stopped before $url was ready" >&2; return 1; }
    if node -e 'fetch(process.argv[1], {signal: AbortSignal.timeout(1000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))' "$url"; then return 0; fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2; return 1
}
wait_http http://127.0.0.1:1420/ "$vite_pid" || { cat "$tmp/vite.log" >&2; exit 1; }
ATUS_DESKTOP_E2E_PROJECT_DIR="$tmp/projects" TAURI_WEBDRIVER_PORT=4455 src/desktop/target/debug/atus-desktop > "$tmp/app.log" 2>&1 & app_pid=$!
wait_http http://127.0.0.1:4455/status "$app_pid" || { cat "$tmp/app.log" >&2; exit 1; }
# Refuse to control a listener belonging to any other process.
verify_listener() {
  local listener
  listener="$(lsof -nP -t -iTCP:4455 -sTCP:LISTEN)" || return 1
  [[ "$listener" == "$app_pid" ]]
}
verify_listener || { echo 'WebDriver listener is not the test application.' >&2; exit 1; }
# Verify that the server on the port is the instance configured for this run.
ATUS_DESKTOP_E2E_PROJECT_DIR="$tmp/projects" node --input-type=module -e '
import { realpathSync } from "node:fs";
const url = "http://127.0.0.1:4455";
const r = await fetch(url + "/session", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({capabilities:{alwaysMatch:{}}})});
const value = (await r.json()).value;
if (!r.ok || !value?.sessionId) throw new Error("Could not create WebDriver session");
const base = `${url}/session/${value.sessionId}`;
try {
  let verified = false;
  for (let attempt = 0; attempt < 80 && !verified; attempt++) {
    const response = await fetch(base + "/execute/sync", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({script:"return window.__TAURI_INTERNALS__?.invoke(\"project_test_directory\")",args:[]})});
    const actual = (await response.json()).value;
    if (response.ok && typeof actual === "string") {
      if (realpathSync(actual) !== realpathSync(process.env.ATUS_DESKTOP_E2E_PROJECT_DIR)) throw new Error("Unexpected application on WebDriver port");
      verified = true;
    } else await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!verified) throw new Error("Test application did not become ready");
} finally { await fetch(base, {method:"DELETE"}); }
'
# The quick analysis test runs second. On CI it also presses the real shortcut through System
# Events; locally that needs Accessibility permission, so it is skipped there.
key_command=''
if [[ -n "${CI:-}" ]]; then
  key_command="osascript -e 'tell application \"System Events\" to key code 11 using {control down, command down}'"
fi
(cd src/frontend && ATUS_DESKTOP_E2E_PROJECT_DIR="$tmp/projects" ATUS_DESKTOP_E2E_URL=http://127.0.0.1:4455 node --test tests/desktop/smoke.e2e.mjs)
(cd src/frontend && ATUS_DESKTOP_E2E_PROJECT_DIR="$tmp/projects" ATUS_DESKTOP_E2E_URL=http://127.0.0.1:4455 node --test tests/desktop/smoke.updater.e2e.mjs)
(cd src/frontend && ATUS_E2E_KEY_COMMAND="$key_command" ATUS_DESKTOP_E2E_PROJECT_DIR="$tmp/projects" ATUS_DESKTOP_E2E_URL=http://127.0.0.1:4455 node --test tests/desktop/smoke.quick-analysis.e2e.mjs)
# The desktop tests quit the application through its own quit path, which lets LLVM flush the
# profile. A hidden quick analysis window keeps the process alive after the main window closes, so
# if the tests left it running, ask it to quit the same way instead of closing a window.
if kill -0 "$app_pid" 2>/dev/null; then
verify_listener || { echo 'WebDriver listener changed; refusing to quit.' >&2; exit 1; }
ATUS_DESKTOP_E2E_PROJECT_DIR="$tmp/projects" node --input-type=module -e '
import { realpathSync } from "node:fs";
const url = "http://127.0.0.1:4455";
const r = await fetch(url + "/session", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({capabilities:{alwaysMatch:{}}})});
const value = (await r.json()).value;
if (!r.ok || !value?.sessionId) throw new Error("Could not create WebDriver session");
const base = `${url}/session/${value.sessionId}`;
const run = (script) => fetch(base + "/execute/sync", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({script,args:[]})});
const response = await run("return window.__TAURI_INTERNALS__.invoke(\"project_test_directory\")");
const actual = (await response.json()).value;
if (!response.ok || typeof actual !== "string" || realpathSync(actual) !== realpathSync(process.env.ATUS_DESKTOP_E2E_PROJECT_DIR)) throw new Error("Unexpected application on WebDriver port; refusing to quit");
// The application may exit before it answers.
await run("window.__TAURI_INTERNALS__.invoke(\"app_quit\"); return null").catch(() => {});
'
fi
for attempt in {1..30}; do
  if ! kill -0 "$app_pid" 2>/dev/null; then break; fi
  sleep 1
done
if kill -0 "$app_pid" 2>/dev/null; then echo 'Test application did not exit; no coverage report generated.' >&2; exit 1; fi
wait "$app_pid" || { echo 'Test application did not exit cleanly.' >&2; exit 1; }; app_pid=''
if (( coverage )); then
"$profdata" merge -sparse "$tmp"/profiles/*.profraw -o "$tmp/merged.profdata"
"$cov" export -format=lcov -ignore-filename-regex='/(project/e2e|project/test_support|quick_e2e|update_e2e)\.rs$' -instr-profile="$tmp/merged.profdata" src/desktop/target/debug/atus-desktop -object "$(cat "$tmp/binary")" "$root/src/desktop/src" > "$output"
node .github/scripts/shared/coverage/strip-rust-tests.mjs "$output"
grep -q '^SF:' "$output" || { echo 'Rust coverage report is empty.' >&2; exit 1; }
node .github/scripts/shared/coverage/check-rust-inventory.mjs "$root/src/desktop/src" "$output" .github/scripts/shared/coverage/rust-source-inventory.json
echo 'Exploratory macOS report: other platform cfg paths may be absent; not a multiplatform coverage gate.' >&2
fi
