#!/usr/bin/env bash
# Install Tauri build dependencies on the pinned Ubuntu 22.04 runner.
set -euo pipefail
sources="$(mktemp)"
trap 'rm -f "$sources"' EXIT
cat > "$sources" <<'SOURCES'
deb http://archive.ubuntu.com/ubuntu jammy main universe
deb http://archive.ubuntu.com/ubuntu jammy-updates main universe
deb http://security.ubuntu.com/ubuntu jammy-security main universe
SOURCES
options=(-o "Dir::Etc::sourcelist=$sources" -o Dir::Etc::sourceparts=- -o Acquire::Retries=3 -o Acquire::http::Timeout=15)
apt-get "${options[@]}" update
apt-get "${options[@]}" install -y libwebkit2gtk-4.1-dev build-essential clang llvm curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libfuse2 rpm
