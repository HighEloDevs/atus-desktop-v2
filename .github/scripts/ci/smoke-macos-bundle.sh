#!/usr/bin/env bash
# Copy an app bundle into a temporary directory and verify its process opens a window.
set -euo pipefail
bundle="${1:?Usage: smoke-macos-bundle.sh /path/to/application.app}"
[[ -d "$bundle" && -f "$bundle/Contents/Info.plist" ]] || { echo 'Invalid app bundle' >&2; exit 2; }
tmp="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/atus-macos-smoke.XXXXXX")"
pid=""
cleanup() {
  if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT
mkdir -p "$tmp/home"
ditto "$bundle" "$tmp/App.app"
executable="$(plutil -extract CFBundleExecutable raw "$tmp/App.app/Contents/Info.plist")"
[[ "$executable" != */* && "$executable" != .* && -x "$tmp/App.app/Contents/MacOS/$executable" ]] || { echo 'Invalid bundle executable' >&2; exit 1; }
HOME="$tmp/home" TMPDIR="$tmp" "$tmp/App.app/Contents/MacOS/$executable" >"$tmp/app.log" 2>&1 &
pid=$!
cat > "$tmp/window.swift" <<'SWIFT'
import CoreGraphics
import Foundation
let pid = Int(CommandLine.arguments[1])!
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
let found = windows.contains { w in
    guard let owner = w[kCGWindowOwnerPID as String] as? Int, owner == pid,
          let layer = w[kCGWindowLayer as String] as? Int, layer == 0,
          let bounds = w[kCGWindowBounds as String] as? [String: Any],
          let width = bounds["Width"] as? Double, let height = bounds["Height"] as? Double else { return false }
    return width > 0 && height > 0
}
exit(found ? 0 : 1)
SWIFT
for ((attempt=0; attempt<60; attempt++)); do
  if ! kill -0 "$pid" 2>/dev/null; then echo 'Application exited before showing a window:' >&2; cat "$tmp/app.log" >&2; exit 1; fi
  if swift "$tmp/window.swift" "$pid"; then echo 'Visible application window detected.'; exit 0; fi
  sleep 0.5
done
echo 'Application window did not appear:' >&2
cat "$tmp/app.log" >&2
exit 1
