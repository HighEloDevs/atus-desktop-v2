#!/usr/bin/env bash
# Mount a disk image read-only, check its layout and verify the packaged app opens a window.
# Usage: smoke-dmg.sh /path/to/image.dmg
set -euo pipefail
dmg="${1:?Usage: smoke-dmg.sh /path/to/image.dmg}"
[[ -f "$dmg" && "$dmg" == *.dmg ]] || { echo 'Invalid disk image' >&2; exit 2; }
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/atus-dmg-smoke.XXXXXX")"
mnt="$tmp/mnt"
mkdir -p "$mnt"
mounted=0
cleanup() {
  if [[ "$mounted" == 1 ]]; then hdiutil detach "$mnt" -force >/dev/null 2>&1 || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT
hdiutil attach "$dmg" -nobrowse -readonly -noautoopen -mountpoint "$mnt" >/dev/null
mounted=1
apps=("$mnt"/*.app)
[[ ${#apps[@]} -eq 1 && -d "${apps[0]}" ]] || { echo 'Expected exactly one .app in the disk image' >&2; exit 1; }
[[ -L "$mnt/Applications" ]] || { echo 'Disk image has no link to /Applications' >&2; exit 1; }
"$here/smoke-app.sh" "${apps[0]}"
echo 'Disk image verified.'
