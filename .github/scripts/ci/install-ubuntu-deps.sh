#!/usr/bin/env bash
# Install Tauri build dependencies on the pinned Ubuntu 22.04 runner.
set -euo pipefail
sources="$(mktemp)"
cleanup() {
  rm -f "$sources"
  python3 -c 'from pathlib import Path; p=Path(__import__("os").environ.get("ATUS_HOSTS_FILE", "/etc/hosts")); p.write_text("".join(line for line in p.read_text().splitlines(keepends=True) if "# atus-ci-dns" not in line))'
}
trap cleanup EXIT
.github/scripts/ci/ubuntu-dns-fallback.sh
cat > "$sources" <<'SOURCES'
deb http://archive.ubuntu.com/ubuntu jammy main universe
deb http://archive.ubuntu.com/ubuntu jammy-updates main universe
deb http://security.ubuntu.com/ubuntu jammy-security main universe
SOURCES
options=(-o "Dir::Etc::sourcelist=$sources" -o Dir::Etc::sourceparts=- -o Acquire::Retries=3 -o Acquire::http::Timeout=15 -o APT::Update::Error-Mode=any)
apt-get "${options[@]}" update
apt-get "${options[@]}" install -y libwebkit2gtk-4.1-dev build-essential clang llvm curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libfuse2 rpm xvfb xauth
