# Arthur

Original smooth illustrated public showcase character, generated from a text description with OpenAI ImageGen and prepared through [the repository character-generation skill](../../../skills/generate-talking-sprite-character/SKILL.md). No reference photographs or third-party character designs were used. Distributed under the included MIT license.

Arthur is a warm, witty professor-like storyteller in his late fifties, with swept-back silver hair and darker roots, brown eyes behind black rectangular glasses, a salt-and-pepper beard, a navy knitted sweater and a blue-gray open shirt collar.

The native 1254 × 1254 illustration is padded, without resizing, into a 1400 × 1400 transparent canvas. All facial states use matching edited illustration crops and an inpainted clean face base. No pixelization, 64px grid, nearest-neighbor resizing, scaffold facial art or SVG tracing is used. Original skin, lip, brown iris, muted ivory teeth and warm shadow colors are preserved rather than quantized to a fixed palette.

## Animation and coordinates

- Eye group: 345 × 110; center (705.5, 520). Eye edits stay inside the lens openings; the black frames are fixed base artwork.
- Eyebrows: 350 × 110; center (703, 440). Brow edit footprints exclude hair and the glasses rims.
- Mouth states: 275 × 125; center (710.5, 732.5). Local mouth crops preserve the surrounding mustache and beard.
- Source padding offset: (73, 50); whole-character pivot: (700, 1060); speech bounce: 0.
- Idle sway: 0.65 degrees, horizontal 1.5 and vertical 1 reference pixels at 0.22 Hz. Runtime scales reference distances to canvas dimensions.
- Worried and Look Up both gaze screen-left; Look Up also glances upward.
- Sweat is separate transparent PNG artwork, anchored near the temple at (915, 510), with 75px fall.
- Speech and manual mouth previews take priority over the optional impressed smile; automatic blink takes priority over reaction eyes.
- Reactions support configurable duration, intensity and additional final-pose holdDuration. One existing animation loop drives the entire character.

## Load

~~~ts
import { createAvatar } from '@hh1st/hoho-avatar';
import { canvasRenderer } from '@hh1st/hoho-avatar/canvas';

const avatar = await createAvatar(canvas, {
  renderer: canvasRenderer({ character: '/characters/arthur/character.json' }),
});
avatar.triggerReaction('worried', { duration: 1.4, holdDuration: 2 });
avatar.setIdleMotion(true);
~~~

Adapt the URL to your application's base path. Select Arthur in Studio or open ?character=arthur. arthur.zip contains character.json, every referenced PNG, these notes and the license at the archive root and can be loaded through Import avatar.

## Generation prompt

Built-in ImageGen generated the reference, matching localized edits for clean face, blink, speech mouths, reactions, and separate sweat art. The skill's shared reaction prompt plan enforces the same screen-left gaze. Feature crops use measured anchors and feathered alpha edges. Fixed facial surroundings are excluded from the editable regions so expression changes cannot bring in shifted glasses, hair or beard patches.

Use case: stylized-concept. Asset type: original premium smooth 2D talking-avatar reference portrait named Arthur for a public open-source showcase. Exactly one charming friendly intelligent gentleman in his late fifties. Softly rounded naturally proportioned face, medium-light warm skin with subtle rosy undertones, gently full cheeks, rounded moderately prominent nose, gentle smile lines around the eyes, expressive kind chocolate-brown eyes with natural highlights. Distinguished yet playful and approachable, a wise professor-like storyteller with a slightly mischievous knowing smile. Stylish rectangular BLACK-FRAMED GLASSES with softly rounded corners; clear transparent lenses, unobscured brown eyes, no strong reflections. Thick dark slightly arched expressive brows clearly visible ABOVE the glasses with a small gap, so brows are separately animatable. Thick voluminous swept-back slightly tousled SILVER-GRAY hair with soft waves, clean textured strands and darker charcoal roots and sides. Full neatly groomed fluffy salt-and-pepper beard and mustache: darker on cheeks and upper lip, silver-gray chin, clearly defined but not excessive individual whiskers. A gentle CLOSED knowing smile with slightly raised corners, natural subtle warm lips visible below the mustache. Classic dark charcoal-navy knitted crewneck sweater over a muted blue-gray button-down shirt; neat collar visible above round neckline, top button undone. Premium 2D cartoon illustration with soft dimensional modern animated-film aesthetics, smooth rounded contours, rich natural colors, warm soft cinematic studio lighting, subtle skin shading, clean soft texture and high-quality antialiased edges; stylized not photorealistic, no harsh outlines. Composition: fully front-facing, upright, eye corners level, direct gaze into viewer, relaxed shoulders, head and upper torso visible; square canvas, entire silver hair silhouette and shoulders visible with generous fully transparent margin for animation, a little margin below sweater. Exactly one character, no props, no text or watermark, no checkerboard baked into pixels, no colored background or floor shadow. Actual transparent background. Show normal complete face in this reference; matching clean facial base and facial animation layers will be prepared through localized edits afterward. Keep signature hair, glasses, beard, clothing and lighting consistent.
