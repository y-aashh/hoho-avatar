import argparse
import json
from pathlib import Path


def point(value: str):
    try:
        x, y = (float(part) for part in value.split(","))
        return {"x": x, "y": y}
    except Exception as exc:
        raise argparse.ArgumentTypeError("expected X,Y") from exc


def main():
    parser = argparse.ArgumentParser(description="Write a Canvas V1 character.json")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--mouth-anchor", type=point, required=True)
    parser.add_argument("--eyes", choices=("pair", "single", "none"), default="pair")
    parser.add_argument("--eyes-anchor", type=point)
    parser.add_argument("--body-bounce", type=float, default=2)
    parser.add_argument("--render-style", choices=("pixel", "smooth"), default="pixel")
    parser.add_argument("--canvas", type=point, default={"x": 512, "y": 512}, help="WIDTH,HEIGHT")
    parser.add_argument("--pivot", type=point)
    parser.add_argument("--idle-sway", type=Path, help="JSON file with idle motion options")
    parser.add_argument("--reactions", type=Path, help="JSON file with reaction overrides and anchors")
    parser.add_argument("--eyebrows-anchor", type=point, help="neutral eyebrows.png anchor")
    args = parser.parse_args()
    if any(v <= 0 or not float(v).is_integer() for v in args.canvas.values()):
        parser.error("canvas dimensions must be positive integers")
    if args.eyes != "none" and args.eyes_anchor is None:
        parser.error("--eyes-anchor is required when eyes are enabled")
    if args.body_bounce < 0:
        parser.error("body bounce must be non-negative")

    definition = {
        "version": 1,
        "canvas": {"width": int(args.canvas["x"]), "height": int(args.canvas["y"])},
        "body": {"src": "body.png", "x": 0, "y": 0, "width": int(args.canvas["x"]), "height": int(args.canvas["y"])},
        "mouth": {
            "anchor": args.mouth_anchor,
            "sprites": {state: f"mouth-{state}.png" for state in ("closed", "small", "large", "wide", "round")},
        },
        "animation": {"bodyBouncePx": args.body_bounce},
    }
    if args.eyes != "none":
        definition["eyes"] = {
            "anchor": args.eyes_anchor,
            "sprites": {"open": "eyes-open.png", "closed": "eyes-closed.png"},
        }

    if args.render_style != "pixel":
        definition["renderStyle"] = args.render_style
    if args.pivot:
        definition["animation"]["pivot"] = args.pivot
    if args.idle_sway:
        definition["animation"]["idleSway"] = json.loads(args.idle_sway.read_text())
    if args.reactions:
        definition["reactions"] = json.loads(args.reactions.read_text())
    if args.eyebrows_anchor:
        definition["eyebrows"] = {"src": "eyebrows.png", "anchor": args.eyebrows_anchor}
    from validate_character import validate_definition
    validate_definition(definition, args.out_dir, inspect_assets=False)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    target = args.out_dir / "character.json"
    target.write_text(json.dumps(definition, indent=2) + "\n", encoding="utf-8")
    print(target)


if __name__ == "__main__":
    main()
