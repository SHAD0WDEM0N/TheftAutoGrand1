import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from scripts.create_mobile_bundle import create_compact_bundle, make_autoexec, normalize_name


class MobileBundleTests(unittest.TestCase):
    def test_zip_paths_preserve_hidden_jsdos_config(self):
        self.assertEqual(normalize_name("./.jsdos/dosbox.conf"), ".jsdos/dosbox.conf")
        self.assertEqual(normalize_name(".jsdos/dosbox.conf"), ".jsdos/dosbox.conf")

    def test_autoexec_replaces_install_prompt_with_launch(self):
        old = "[cpu]\ncycles=max\n[autoexec]\n@echo off\nmount c .\nc:\nimgmount d \"disc.iso\" -t iso\nd:\ndir\n"
        result = make_autoexec(old, ["c:", "cd GTA", "GTA.BAT"])
        self.assertIn("[cpu]\ncycles=max", result)
        self.assertIn("mount c .\nc:\nc:\ncd GTA\nGTA.BAT", result)
        self.assertNotIn("imgmount d", result)
        self.assertNotIn("\nd:\ndir", result)

    def test_stream_copy_keeps_installed_files_and_drops_disc(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = Path(tmp) / "backup.jsdos"
            compact = Path(tmp) / "mobile.jsdos"
            conf = "[cpu]\ncycles=max\n[autoexec]\n@echo off\nmount c .\nc:\nimgmount d \"disc.iso\" -t iso\nd:\ndir\n"
            with ZipFile(original, "w") as archive:
                archive.writestr(".jsdos/dosbox.conf", conf)
                archive.writestr("disc.iso", b"fake disc image bytes" * 1024)
                archive.writestr("GTA/GTA.BAT", b"echo test")
                archive.writestr("SAVES/001.SAV", b"my-game-save")
            removed, length = create_compact_bundle(original, compact, "disc.iso", ["c:", "cd GTA", "GTA.BAT"])
            self.assertGreater(removed, 1024)
            self.assertGreater(length, 0)
            with ZipFile(compact) as archive:
                self.assertNotIn("disc.iso", archive.namelist())
                self.assertEqual(archive.read("GTA/GTA.BAT"), b"echo test")
                self.assertEqual(archive.read("SAVES/001.SAV"), b"my-game-save")
                self.assertIn("GTA.BAT", archive.read(".jsdos/dosbox.conf").decode())

    def test_refuses_missing_disc_and_does_not_create_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = Path(tmp) / "backup.jsdos"
            compact = Path(tmp) / "mobile.jsdos"
            with ZipFile(original, "w") as archive:
                archive.writestr(".jsdos/dosbox.conf", "[autoexec]\n")
            with self.assertRaises(ValueError):
                create_compact_bundle(original, compact, "disc.iso", ["GTA.BAT"])
            self.assertFalse(compact.exists())


if __name__ == "__main__":
    unittest.main()
