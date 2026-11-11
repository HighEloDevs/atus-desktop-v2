#!/usr/bin/env python3
"""Check that a Tauri bundle directory contains one valid-looking file per Linux format.

This validates inventory and container signatures; installation and application
execution still require separate tests on the target distributions.
"""

import argparse
from pathlib import Path


FORMATS = {"deb": ".deb", "rpm": ".rpm", "appimage": ".AppImage"}


def verify_bundles(bundle_dir: Path) -> dict[str, Path]:
    """Return the three bundle paths, or raise ValueError on absent/invalid files."""
    bundles = {}
    for kind, suffix in FORMATS.items():
        matches = list((bundle_dir / kind).glob(f"*{suffix}"))
        if len(matches) != 1 or not matches[0].is_file():
            raise ValueError(f"Expected exactly one {kind} bundle in {bundle_dir / kind}")
        path = matches[0]
        with path.open("rb") as file:
            header = file.read(12)
        valid = (
            header.startswith(b"!<arch>\n") if kind == "deb" else
            header.startswith(b"\xed\xab\xee\xdb") if kind == "rpm" else
            header.startswith(b"\x7fELF") and header[8:11] == b"AI\x02"
        )
        if not valid:
            raise ValueError(f"Invalid {kind} signature: {path}")
        bundles[kind] = path
    return bundles


def main() -> None:
    """Print validated bundle paths; exit with an error for incomplete inventory."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle_dir", type=Path)
    args = parser.parse_args()
    try:
        for path in verify_bundles(args.bundle_dir).values():
            print(path)
    except ValueError as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
