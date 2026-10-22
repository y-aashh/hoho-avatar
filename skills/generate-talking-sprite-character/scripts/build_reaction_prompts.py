"""Build consistent reaction art direction; image generation/visual review follow separately."""
import argparse
import json
from pathlib import Path


def build_reaction_plan(render_style="pixel", gaze_direction="left"):
    if render_style not in ("pixel", "smooth"):
        raise ValueError("render_style must be pixel or smooth")
    if gaze_direction not in ("left", "right"):
        raise ValueError("gaze_direction must be left or right")
    x = -1 if gaze_direction == "left" else 1
    direction = f"screen-{gaze_direction}"
    gaze = (
        f"Move BOTH irises/pupils toward the {gaze_direction.upper()} EDGE OF THE IMAGE "
        f"(viewer-{gaze_direction}, {direction}). Use the same horizontal direction for Worried and Look Up. "
        "Keep pupils inside their existing eye sockets; never cross the eyes. "
        "Do not mirror the portrait, swap eyes, or translate the whole eye/skin layer. "
    )
    style = (
        "Preserve source resolution, smooth antialiased alpha edges, skin/beard texture and lighting. "
        "No pixelization, nearest-neighbor conversion, SVG tracing or pixel scaffold art. "
        if render_style == "smooth" else
        "Preserve the source pixel grid, palette and intentionally stepped edges. "
        "No smoothing, soft gradients or illustration-style replacement features. "
    )
    shared = (
        "Use case: identity-preserve. Asset type: registered talking-avatar reaction artwork. "
        "Input image 1 is the exact edit target. Any additional image is a labeled style or gaze reference only. "
        "Preserve identity, framing, scale, facial landmarks, eye sockets, hair, nose, beard, clothing and lighting. "
        "Change only the named features. Output one registered portrait with actual transparent background, "
        "not a sheet. No text or watermark. " + style
    )
    return {
        "renderStyle": render_style,
        "gazeDirection": direction,
        "coordinateSystem": "viewer/screen; x increases right, y increases down",
        "reactions": {
            "worried": {
                "gaze": {"x": x, "y": 0},
                "prompt": shared + gaze + "Keep a sideways glance with slightly narrowed lids and concerned "
                "brows drawing inward and lifting at their inner ends. Preserve the existing mouth region. "
                "Do not add sweat to this portrait; generate it as a separate transparent PNG.",
            },
            "look_up": {
                "gaze": {"x": x, "y": -1},
                "prompt": shared + gaze + f"Also move the pupils UP, diagonally toward the upper-{gaze_direction} "
                "of the image. Preserve eyelid outlines, eye-layer placement, brows, skin and mouth. "
                "Use the approved Worried artwork as a horizontal gaze-direction reference when available.",
            },
            "impressed": {
                "gaze": None,
                "prompt": shared + "Keep the neutral centered gaze. Slightly widen eyes, raise brows naturally, "
                "and add a delighted approving smile below the existing moustache without moving the mouth center. "
                "The impressed mouth will be extracted separately and must not replace audio-driven speech mouths.",
            },
        },
        "review": {
            "automaticGazeDetection": False,
            "required": "Visually compare both eyes in Worried and Look Up against neutral at peak and during "
            f"entry/recovery. Both must visibly look {direction}; Look Up must also look upward. "
            "Reject opposite directions, crossed eyes, duplicated pupils/brows and displaced eyelids. "
            "Correct the pupil artwork and repeat review before packaging; do not mirror the face or eye layer.",
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Build reaction prompts with a shared screen-left gaze by default")
    parser.add_argument("--render-style", choices=("pixel", "smooth"), default="pixel")
    parser.add_argument("--gaze-direction", choices=("left", "right"), default="left",
                        help="one shared direction for both reactions; override only when explicitly requested")
    parser.add_argument("--out", type=Path, required=True, help="save as reaction-plan.json beside character.json")
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(build_reaction_plan(args.render_style, args.gaze_direction), indent=2) + "\n", encoding="utf-8")
    print(args.out)


if __name__ == "__main__":
    main()
