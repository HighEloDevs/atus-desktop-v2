"""Regression tests for the Linux bundle inventory verifier."""

import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "verify_linux_bundles", Path(__file__).resolve().parents[1] / "verify-linux-bundles.py"
)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class VerifyLinuxBundlesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.files = {
            "deb": ("app.deb", b"!<arch>\n"),
            "rpm": ("app.rpm", b"\xed\xab\xee\xdb"),
            "appimage": ("app.AppImage", b"\x7fELF\x02\x01\x01\x00AI\x02"),
        }
        for kind, (name, signature) in self.files.items():
            folder = self.root / kind
            folder.mkdir()
            (folder / name).write_bytes(signature)

    def test_accepts_one_valid_signature_per_format(self):
        self.assertEqual(set(verifier.verify_bundles(self.root)), set(self.files))

    def test_rejects_missing_or_duplicate_artifacts(self):
        path = self.root / "deb" / "app.deb"
        path.unlink()
        with self.assertRaises(ValueError):
            verifier.verify_bundles(self.root)
        path.write_bytes(b"!<arch>\n")
        (path.parent / "other.deb").write_bytes(b"!<arch>\n")
        with self.assertRaises(ValueError):
            verifier.verify_bundles(self.root)

    def test_rejects_wrong_signatures(self):
        for kind, (name, signature) in self.files.items():
            path = self.root / kind / name
            path.write_bytes(b"not a package")
            with self.assertRaises(ValueError, msg=kind):
                verifier.verify_bundles(self.root)
            path.write_bytes(signature)


if __name__ == "__main__":
    unittest.main()
