import json
import math
import sys
from pathlib import Path
from PIL import Image

MOUTHS = ("closed", "small", "large", "wide", "round")
REACTIONS = ("worried", "look_up", "impressed")


def fail(message):
    raise ValueError(message)


def number(value, label, minimum=0, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < minimum or (positive and value == 0):
        fail(f"{label} must be a finite {'positive' if positive else 'non-negative'} number")


def inspect_image(root, relative, require_alpha=False, inspect_assets=True):
    if not isinstance(relative, str) or not relative.strip() or "\\" in relative or ":" in relative or relative.startswith("/") or ".." in Path(relative).parts:
        fail(f"unsafe asset path: {relative}")
    path = root / relative
    if not path.resolve().is_relative_to(root.resolve()):
        fail(f"asset escapes character directory: {relative}")
    if not inspect_assets:
        return (1, 1)
    if not path.is_file():
        fail(f"missing image: {relative}")
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        if require_alpha and not ("A" in image.getbands() or "transparency" in image.info):
            fail(f"layer must support transparency: {relative}")
        if image.width <= 0 or image.height <= 0:
            fail(f"invalid image dimensions: {relative}")
        return image.size


def validate_definition(data, root, inspect_assets=True):
    if data.get("version") != 1:
        fail("version must be 1")
    canvas = data.get("canvas", {})
    for key in ("width", "height"):
        number(canvas.get(key), f"canvas.{key}", positive=True)
        if int(canvas[key]) != canvas[key]:
            fail("canvas dimensions must be integers")
    if data.get("renderStyle", "pixel") not in ("pixel", "smooth"):
        fail("renderStyle must be pixel or smooth")

    def point(value, label):
        if not isinstance(value, dict):
            fail(f"{label} must contain x and y")
        for key, dimension in (("x", "width"), ("y", "height")):
            number(value.get(key), label)
            if value[key] > canvas[dimension]:
                fail(f"{label} is outside canvas")

    def image(path, alpha=True):
        size = inspect_image(root, path, alpha, inspect_assets)
        if size[0] > canvas["width"] or size[1] > canvas["height"]:
            fail(f"layer exceeds canvas dimensions: {path}")
        return size

    body = data.get("body", {})
    body_size = inspect_image(root, body.get("src"), False, inspect_assets)
    for key in ("width", "height"):
        if key in body:
            number(body[key], f"body.{key}", positive=True)
    mouth = data.get("mouth", {})
    point(mouth.get("anchor"), "mouth.anchor")
    if set(mouth.get("sprites", {})) != set(MOUTHS):
        fail("mouth sprites must contain exactly closed, small, large, wide, and round")
    for path in mouth["sprites"].values():
        image(path)
    if "eyes" in data:
        eyes = data["eyes"]
        point(eyes.get("anchor"), "eyes.anchor")
        if set(eyes.get("sprites", {})) != {"open", "closed"}:
            fail("eyes sprites must contain open and closed")
        for path in eyes["sprites"].values():
            image(path)
    if "eyebrows" in data:
        image(data["eyebrows"].get("src"))
        point(data["eyebrows"].get("anchor"), "eyebrows.anchor")
    animation = data.get("animation", {})
    if "bodyBouncePx" in animation:
        number(animation["bodyBouncePx"], "bodyBouncePx")
    if "pivot" in animation:
        point(animation["pivot"], "pivot")
    for key, value in animation.get("idleSway", {}).items():
        if key not in ("rotationDeg", "horizontalPx", "verticalPx", "frequencyHz", "speechInfluence"):
            fail(f"unknown idleSway setting: {key}")
        number(value, f"idleSway.{key}")
    for name, reaction in data.get("reactions", {}).items():
        if name not in REACTIONS or not isinstance(reaction, dict):
            fail(f"unknown or invalid reaction: {name}")
        for feature in ("eyes", "eyebrows", "mouth"):
            if feature in reaction:
                image(reaction[feature])
                if feature in ("eyes", "eyebrows") and feature not in data:
                    fail(f"{name}.{feature} requires neutral {feature} art")
            if f"{feature}Anchor" in reaction:
                point(reaction[f"{feature}Anchor"], f"{name}.{feature}Anchor")
        if "effect" in reaction:
            effect = reaction["effect"]
            image(effect.get("src"))
            point(effect.get("anchor"), f"{name}.effect.anchor")
            for key in ("width", "height", "fallPx"):
                if key in effect:
                    number(effect[key], f"effect.{key}", positive=key != "fallPx")
    return body_size


def main():
    if len(sys.argv) != 2:
        print("usage: validate_character.py path/to/character.json", file=sys.stderr)
        return 1
    config = Path(sys.argv[1])
    try:
        data = json.loads(config.read_text(encoding="utf-8"))
        size = validate_definition(data, config.parent)
        print(f"OK: {config} ({size[0]}x{size[1]})")
    except (ValueError, OSError, TypeError, KeyError, AttributeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
