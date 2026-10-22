"""Run with the same Pillow-enabled Python used for the asset tools."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from validate_character import validate_definition
from render_preview import render_state

SCRIPTS = Path(__file__).parent


class CharacterToolsTest(unittest.TestCase):
    def test_high_resolution_writer_validator_previews_and_matrix(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            Image.new("RGBA", (1024, 768), (25, 100, 130, 255)).save(root / "body.png")
            for group, states in (("mouth", ("closed", "small", "large", "wide", "round")), ("eyes", ("open", "closed"))):
                for state in states:
                    Image.new("RGBA", (160, 80), (200, 150, 90, 128)).save(root / f"{group}-{state}.png")
            Image.new("RGBA", (30, 60), (80, 160, 220, 200)).save(root / "sweat.png")
            reaction = {"worried": {"eyes": "eyes-closed.png", "effect": {"src": "sweat.png", "anchor": {"x": 700, "y": 200}}},
                        "look_up": {"eyes": "eyes-open.png"}, "impressed": {"mouth": "mouth-wide.png"}}
            (root / "reactions.json").write_text(json.dumps(reaction))
            subprocess.run([sys.executable, str(SCRIPTS / "write_character.py"), "--out-dir", str(root), "--canvas", "1024,768", "--mouth-anchor", "512.25,450.5", "--eyes-anchor", "512,300", "--pivot", "512,600", "--render-style", "smooth", "--reactions", str(root / "reactions.json")], check=True, capture_output=True)
            config = root / "character.json"
            data = json.loads(config.read_text())
            validate_definition(data, root)
            for name in reaction:
                for progress in (0, 0.4, 0.85):
                    self.assertEqual(render_state(config, reaction=name, progress=progress).size, (1024, 768))
            subprocess.run([sys.executable, str(SCRIPTS / "render_test_matrix.py"), str(config), "--out", str(root / "matrix.png")], check=True, capture_output=True)
            self.assertTrue((root / "matrix-reactions.png").is_file())
            self.assertTrue((root / "matrix-closeups.png").is_file())
            for path in ("../escape.png", "https://bad.test/image.png"):
                data["reactions"]["worried"]["eyes"] = path
                with self.assertRaisesRegex(ValueError, "unsafe"):
                    validate_definition(data, root)
            data["reactions"]["worried"]["eyes"] = "missing.png"
            with self.assertRaisesRegex(ValueError, "missing"):
                validate_definition(data, root)
            data["reactions"]["worried"]["eyes"] = "eyes-open.png"
            data["reactions"]["worried"]["effect"]["anchor"]["x"] = 2000
            with self.assertRaisesRegex(ValueError, "outside"):
                validate_definition(data, root)
            data["reactions"]["worried"]["effect"]["anchor"]["x"] = 700
            Image.new("RGB", (30, 60)).save(root / "sweat.png")
            with self.assertRaisesRegex(ValueError, "transparency"):
                validate_definition(data, root)

    def test_legacy_bundled_characters(self):
        repo = SCRIPTS.parents[2]
        for name in ("pixel-bot", "pixel-portrait", "niu-lai"):
            config = repo / "public" / "characters" / name / "character.json"
            validate_definition(json.loads(config.read_text()), config.parent)


if __name__ == "__main__":
    unittest.main()
