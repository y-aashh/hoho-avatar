# Expression layer art direction

Use the generated layers as a starting point. Humanoid mouths usually need character-specific refinement before delivery.

## Palette

- Sample or harmonize an outline, lip, mouth-interior, tongue, and optional tooth color from the body.
- Avoid pure black cavities and pure white teeth unless the body already uses that contrast.
- Keep lip and blink colors related to nearby facial shadows or eye lines.

## State anatomy

- `closed`: preserve personality with a restrained curve, corner lift, asymmetry, or lip accent. Reject a ruler-straight bar unless the character is intentionally mechanical.
- `small`: show a compact cavity; use teeth or tongue only when they remain legible.
- `large`: increase vertical opening and expose different anatomy from `small`.
- `wide`: increase horizontal stretch and keep visible mouth corners. Reject a detached horizontal strip.
- `round`: use a stepped oval with an interior cavity. Reject a square outline or hollow rectangular frame.

Keep all states centered and related, but do not scale one universal shape into five sizes. Teeth are optional per state; `round` often reads better without them.

## Delivery gate

Reject a humanoid mouth set when any state:

- reads as a single-color sticker or generic symbol;
- has no visible relationship to the character's palette or expression;
- changes center, lip weight, or pixel density unexpectedly;
- becomes a square, bar, or detached object at the 256-pixel matrix preview size;
- looks acceptable alone but pasted on when composed with either eye state.

Render the complete state matrix after every meaningful mouth revision. Judge the composite, not the transparent layer in isolation.

## Reaction anatomy and illustration fidelity

Prepare a clean face base for new reaction-enabled assets. Never automatically erase facial art from legacy bodies. Use prepared or carefully inpainted regions that preserve skin texture, beard, hair, glasses and lighting; no solid rectangular masks. Neutral and expression eyes/brows must replace each other without duplicate outlines or mismatched skin patches.

Worried lids narrow slightly and inner brows draw together. Both worried pupils point sideways toward screen-left/viewer-left, within the same sockets. Look-up pupils point diagonally toward the upper-left edge of the image, using the same horizontal direction. Do not translate the whole eye/skin layer. Impressed eyes widen slightly, brows lift, and the optional smile conveys delight without replacing speech mouths. Keep asymmetry consistent with the character, rather than mirroring mechanically.

Use center anchors measured from actual artwork. Keep neutral and variant group dimensions consistent, or provide explicit feature anchors. Sweat is separate RGBA art at the temple, sharing the character coordinate system, with clear space below it for accelerated travel. Keep it stylistically matched, never a generic Canvas teardrop on a textured face.

For smooth illustration preserve source resolution, anti-aliased alpha, line weight and texture. No pixel scaffold mouths, forced 64px grids, nearest-neighbor reduction or SVG auto-tracing. Pixel mode retains intentionally stepped anatomy and nearest-neighbor scaling.

Review each reaction at neutral, peak and recovery, plus all mouth states and blinking during reactions. Inspect native-scale eyes and mouths for seams, doubles, floating anatomy, and cropped sway; the actual browser renderer is the final composition reference.

Complete raster face variants must not alpha-crossfade displaced pupils, brows or lips. Canvas selects one coherent expression at a time; body transforms and effects retain continuous easing. Inspect partial-intensity, entry, recovery, interruption and reset frames, not just peak art. Ensure the clean base removes the full original feature footprint, including outer brow tips and the skin between extraction masks.

Use the shared prompt builder's default screen-left gaze for both Worried and Look Up. Judge direction against the image edges, not the character's anatomical left/right. Compare both pupil positions against neutral in `*-gaze.png` and the browser at entry, peak and recovery before packaging. Reject opposite directions and crossed eyes; revise the pupil artwork while keeping eyelids, brows and skin anchored. Structural PNG/JSON validation does not detect gaze. Honor an explicit user override by changing the shared direction for both reactions together.
