#!/usr/bin/env bash
# Runs the opt-in desktop smoke on an existing X11 display; for CI use xvfb-run.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
app="$root/src/desktop/target/debug/atus-desktop"
frontend="$root/src/frontend"
if [[ "$(uname -s)" != Linux || -z "${DISPLAY:-}" ]]; then
  echo 'This runner requires Linux and an X11 display (for example xvfb-run).' >&2
  exit 1
fi
if [[ ! -x "$app" || ! -f "$frontend/node_modules/vite/bin/vite.js" ]]; then
  echo 'Build the desktop-e2e debug binary and install frontend dependencies first.' >&2
  exit 1
fi
node --input-type=module -e '
import net from "node:net";
for (const port of [1420, 4455]) {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve));
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
' || { echo 'Test ports 1420 and 4455 must be available.' >&2; exit 1; }

test_dir="$(mktemp -d "${TMPDIR:-/tmp}/atus-desktop-e2e.XXXXXXXX")"
app_pid=''
vite_pid=''
cleanup() {
  [[ -z "$app_pid" ]] || kill "$app_pid" 2>/dev/null || true
  [[ -z "$vite_pid" ]] || kill "$vite_pid" 2>/dev/null || true
  [[ -z "$app_pid" ]] || wait "$app_pid" 2>/dev/null || true
  [[ -z "$vite_pid" ]] || wait "$vite_pid" 2>/dev/null || true
  node -e 'require("node:fs").rmSync(process.argv[1], { recursive: true, force: true })' "$test_dir"
}
trap cleanup EXIT

wait_http() {
  local url="$1" pid="$2" attempt
  for attempt in {1..90}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Process stopped before $url was ready" >&2
      return 1
    fi
    if node -e 'fetch(process.argv[1], {signal: AbortSignal.timeout(1000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))' "$url"; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

cd "$frontend"
node ./node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 1420 --strictPort > "$test_dir/vite.log" 2>&1 &
vite_pid=$!
if ! wait_http http://127.0.0.1:1420/ "$vite_pid"; then
  cat "$test_dir/vite.log" >&2
  exit 1
fi
mkdir "$test_dir/projects" "$test_dir/home"
HOME="$test_dir/home" XDG_CONFIG_HOME="$test_dir/home/config" \
  XDG_CACHE_HOME="$test_dir/home/cache" XDG_DATA_HOME="$test_dir/home/data" \
  ATUS_DESKTOP_E2E_PROJECT_DIR="$test_dir/projects" TAURI_WEBDRIVER_PORT=4455 \
  "$app" > "$test_dir/app.log" 2>&1 &
app_pid=$!
if ! wait_http http://127.0.0.1:4455/status "$app_pid"; then
  cat "$test_dir/app.log" >&2
  exit 1
fi
if ! ATUS_DESKTOP_E2E_PROJECT_DIR="$test_dir/projects" \
  ATUS_DESKTOP_E2E_URL=http://127.0.0.1:4455 \
  node --test tests/desktop/smoke.e2e.mjs; then
  cat "$test_dir/app.log" >&2
  cat "$test_dir/vite.log" >&2
  exit 1
fi
