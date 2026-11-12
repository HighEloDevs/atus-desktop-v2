"""Check the file association and icon in a built macOS bundle."""

import plistlib
import sys
from pathlib import Path

contents = Path(sys.argv[1]) / "Contents"
with (contents / "Info.plist").open("rb") as file:
    metadata = plistlib.load(file)

project_type = "org.atus.desktop.project"
document = next(
    entry for entry in metadata["CFBundleDocumentTypes"]
    if project_type in entry["LSItemContentTypes"]
)
exported = next(
    entry for entry in metadata["UTExportedTypeDeclarations"]
    if entry["UTTypeIdentifier"] == project_type
)
assert document["CFBundleTypeRole"] == "Editor"
assert "atus" in exported["UTTypeTagSpecification"]["public.filename-extension"]
icon = document.get("CFBundleTypeIconFile")
assert icon, "The .atus document type must declare an icon"
assert exported["UTTypeIconFile"] == icon
assert (contents / "Resources" / icon).read_bytes().startswith(b"icns")
