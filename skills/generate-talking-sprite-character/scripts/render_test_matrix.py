import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw

from render_preview import EYES, MOUTHS, render_state


def main():
    parser = argparse.ArgumentParser(description="Render every mouth and eye state into one review sheet")
    parser.add_argument("character", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cell-size", type=int, default=256)
    args = parser.parse_args()
    if args.cell_size < 128 or args.cell_size > 512:
        parser.error("cell size must be between 128 and 512")

    definition = json.loads(args.character.read_text(encoding="utf-8"))
    resample = Image.Resampling.LANCZOS if definition.get("renderStyle") == "smooth" else Image.Resampling.NEAREST
    eye_states = EYES if "eyes" in definition else ("open",)
    label_width = 72
    header_height = 28
    gap = 4
    width = label_width + len(MOUTHS) * (args.cell_size + gap) - gap
    height = header_height + len(eye_states) * (args.cell_size + gap) - gap
    sheet = Image.new("RGB", (width, height), (18, 22, 30))
    draw = ImageDraw.Draw(sheet)

    for column, mouth in enumerate(MOUTHS):
        x = label_width + column * (args.cell_size + gap)
        draw.text((x + 6, 8), mouth.upper(), fill=(220, 226, 235))

    for row, eyes in enumerate(eye_states):
        y = header_height + row * (args.cell_size + gap)
        draw.text((8, y + 8), f"EYES\n{eyes.upper()}", fill=(220, 226, 235), spacing=4)
        for column, mouth in enumerate(MOUTHS):
            x = label_width + column * (args.cell_size + gap)
            frame = render_state(args.character, mouth, eyes)
            frame.thumbnail((args.cell_size, args.cell_size), resample)
            sheet.paste(frame, (x + (args.cell_size - frame.width) // 2, y + (args.cell_size - frame.height) // 2), frame)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out, optimize=True)
    reactions = definition.get("reactions", {})
    if reactions:
        review = Image.new("RGB", (3 * args.cell_size, len(reactions) * (args.cell_size + 28)), (18, 22, 30))
        labels = ImageDraw.Draw(review)
        for row, name in enumerate(reactions):
            for col, (label, progress) in enumerate((("neutral", 0), ("peak", 0.4), ("recovery", 0.85))):
                frame = render_state(args.character, reaction=name, progress=progress)
                x, y = col * args.cell_size, row * (args.cell_size + 28)
                labels.text((x + 4, y + 4), f"{name}: {label}", fill="white")
                frame.thumbnail((args.cell_size, args.cell_size), resample)
                review.paste(frame, (x, y + 28), frame)
        review.save(args.out.with_name(args.out.stem + "-reactions.png"))
    if definition.get("renderStyle") == "smooth":
        names = [None, *reactions]
        closeups = Image.new("RGB", (512, 256 * len(names)), (18, 22, 30))
        for row, name in enumerate(names):
            frame = render_state(args.character, reaction=name)
            for col, group in enumerate(("eyes", "mouth")):
                if group not in definition:
                    continue
                anchor = definition[group]["anchor"]
                radius = frame.width / 6
                crop = frame.crop((round(anchor["x"] - radius), round(anchor["y"] - radius), round(anchor["x"] + radius), round(anchor["y"] + radius)))
                crop = crop.resize((256, 256), resample)
                closeups.paste(crop, (col * 256, row * 256), crop)
        closeups.save(args.out.with_name(args.out.stem + "-closeups.png"))
    print(f"{args.out} states={len(MOUTHS) * len(eye_states)} cell={args.cell_size}")


if __name__ == "__main__":
    main()
