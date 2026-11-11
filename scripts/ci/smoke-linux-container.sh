#!/usr/bin/env bash
# Install or extract a Linux bundle in an isolated test container and verify a visible window.
# Usage: smoke-linux-container.sh deb|rpm|appimage /absolute/path/to/bundle
set -euo pipefail

kind="${1:-}"
source_bundle="${2:-}"
if [[ "$kind" != deb && "$kind" != rpm && "$kind" != appimage ]]; then
  echo 'Expected bundle type: deb, rpm, or appimage.' >&2
  exit 2
fi
if [[ ! -f "$source_bundle" ]]; then
  echo "Bundle not found: $source_bundle" >&2
  exit 2
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
chmod 755 "$work"
cp "$source_bundle" "$work/package"

case "$kind" in
  deb|appimage)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y --no-install-recommends \
      ca-certificates xvfb xauth xdotool dbus-x11 libgtk-3-0 \
      libwebkit2gtk-4.1-0 libayatana-appindicator3-1 librsvg2-2
    if [[ "$kind" == deb ]]; then
      mv "$work/package" "$work/package.deb"
      apt-get install -y "$work/package.deb"
      program=/usr/bin/atus-desktop
    else
      chmod +x "$work/package"
      (cd "$work" && ./package --appimage-extract >/dev/null)
      program="$work/squashfs-root/AppRun"
    fi
    ;;
  rpm)
    dnf install -y --setopt=install_weak_deps=False \
      xorg-x11-server-Xvfb xorg-x11-xauth xdotool dbus-daemon shadow-utils util-linux
    mv "$work/package" "$work/package.rpm"
    dnf install -y --nogpgcheck "$work/package.rpm"
    program=/usr/bin/atus-desktop
    ;;
esac

if [[ ! -x "$program" ]]; then
  echo "Expected executable missing: $program" >&2
  exit 1
fi
useradd --create-home atus-smoke
# The container itself is isolated. Disable WebKit's nested sandbox because
# unprivileged containers cannot reliably create its user namespaces.
runuser -u atus-smoke -- env WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 \
  dbus-run-session -- xvfb-run -a bash -c '
    set -euo pipefail
    "$1" >"$HOME/atus.log" 2>&1 &
    pid=$!
    trap '\''kill "$pid" 2>/dev/null || true'\'' EXIT
    for ((attempt=0; attempt<60; attempt++)); do
      if ! kill -0 "$pid" 2>/dev/null; then
        echo "Application exited before its window appeared:" >&2
        cat "$HOME/atus.log" >&2
        exit 1
      fi
      if xdotool search --onlyvisible --name "ATUS Desktop" >/dev/null 2>&1; then
        echo "Visible ATUS Desktop window detected."
        exit 0
      fi
      sleep 0.5
    done
    echo "Application window did not appear:" >&2
    cat "$HOME/atus.log" >&2
    exit 1
  ' _ "$program"
