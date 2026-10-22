import argparse
import json
from pathlib import Path
from PIL import Image


MOUTHS = ("closed", "small", "large", "wide", "round")
EYES = ("open", "closed")


def render_state(character: Path, mouth: str = "closed", eyes: str = "open", reaction=None, progress=0.4, speaking=False):
    definition = json.loads(character.read_text(encoding="utf-8"))
    root = character.parent
    smooth = definition.get("renderStyle") == "smooth"
    resample = Image.Resampling.LANCZOS if smooth else Image.Resampling.NEAREST
    body_config = definition["body"]
    body = Image.open(root / body_config["src"]).convert("RGBA")
    size = (int(body_config.get("width", body.width)), int(body_config.get("height", body.height)))
    body = body.resize(size, resample)
    frame = Image.new("RGBA", (definition["canvas"]["width"], definition["canvas"]["height"]), (0, 0, 0, 0))
    frame.alpha_composite(body, (round(body_config.get("x", 0)), round(body_config.get("y", 0))))
    def ease(value):
        t = max(0, min(1, value))
        return t * t * (3 - 2 * t)
    weight = ease(progress / 0.22) * (1 - ease((progress - 0.68) / 0.32)) if reaction else 0
    override = definition.get("reactions", {}).get(reaction, {})
    def draw(path, anchor, alpha=1, size=None):
        layer = Image.open(root / path).convert("RGBA")
        if size:
            layer = layer.resize(size, resample)
        if alpha < 1:
            layer.putalpha(layer.getchannel("A").point(lambda v: round(v * alpha)))
        frame.alpha_composite(layer, (round(anchor["x"] - layer.width / 2), round(anchor["y"] - layer.height / 2)))
    for group, state in (("eyes", eyes), ("eyebrows", None), ("mouth", mouth)):
        if group not in definition:
            continue
        config = definition[group]
        path = config["src"] if group == "eyebrows" else config["sprites"][state]
        variant = override.get(group) if not (group == "eyes" and eyes == "closed" or group == "mouth" and speaking) else None
        # Match Canvas: draw one complete facial sprite, never a crossfade
        # between different pupil, eyebrow or lip positions.
        if variant and weight > 0.5:
            draw(variant, override.get(f"{group}Anchor", config["anchor"]))
        else:
            draw(path, config["anchor"])
    effect = override.get("effect")
    if effect:
        opacity = weight * ease((progress - 0.15) / 0.12) * (1 - ease((progress - 0.6) / 0.3))
        anchor = dict(effect["anchor"])
        anchor["y"] += max(0, (progress - 0.25) / 0.75) ** 2 * effect.get("fallPx", frame.height * 45 / 512)
        with Image.open(root / effect["src"]) as image:
            size = (round(effect.get("width", image.width)), round(effect.get("height", image.height)))
        draw(effect["src"], anchor, opacity, size)
    # Same whole-character rotation/pivot as Canvas (without idle or audio bounce).
    import math
    rotation, y = 0, 0
    if reaction == "worried":
        rotation = -2 * weight
    elif reaction == "look_up":
        rotation = 2 * weight
    elif reaction == "impressed":
        rotation = math.sin(progress * math.pi * 4) * weight
        y = (-3 + 3 * math.sin(progress * math.pi * 4)) * weight * frame.height / 512
    pivot = definition.get("animation", {}).get("pivot", {"x": frame.width / 2, "y": frame.height * 0.7})
    if rotation or y:
        frame = frame.rotate(-rotation, resample=Image.Resampling.BICUBIC if smooth else Image.Resampling.NEAREST,
                             center=(pivot["x"], pivot["y"]), translate=(0, y))
    return frame


def main():
    parser = argparse.ArgumentParser(description="Render a character.json state without a browser")
    parser.add_argument("character", type=Path)
    parser.add_argument("--mouth", choices=MOUTHS, default="closed")
    parser.add_argument("--eyes", choices=EYES, default="open")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--reaction", choices=("worried", "look_up", "impressed"))
    parser.add_argument("--progress", type=float, default=0.4)
    parser.add_argument("--speaking", action="store_true")
    args = parser.parse_args()
    if not 0 <= args.progress <= 1:
        parser.error("progress must be between 0 and 1")

    frame = render_state(args.character, args.mouth, args.eyes, args.reaction, args.progress, args.speaking)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    frame.save(args.out)
    print(args.out)


if __name__ == "__main__":
    main()
