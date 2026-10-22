# Mira

Original smooth illustrated showcase character, generated from a text description with OpenAI ImageGen, then prepared through [the repository character-generation skill](../../../skills/generate-talking-sprite-character/SKILL.md). No reference photographs, licensed film characters or outside character artwork were used. Distributed under the included MIT license.

Mira is a cheerful young adult presenter with warm peach skin, chocolate-brown eyes, voluminous chestnut curls, an ivory knit sweater and small gold hoops. Her neutral closed smile is relaxed; Wide and Impressed show her bright upper-teeth smile.

The 1254 × 1254 generated artwork retains its native pixels inside a 1400 × 1400 transparent canvas. All facial states are matching edited illustration layers, with a clean inpainted face base. No pixelization, pixel scaffold art, nearest-neighbor resizing or SVG tracing is used. Preview art is a complete Wide-smile composite, not the feature-free body.

## Animation and coordinates

- Eye layer: 365 × 170; center anchor (700.5, 430).
- Eyebrows: 365 × 160; center anchor (695.5, 350).
- Mouth states: 305 × 225; center anchor (725.5, 587.5).
- Whole-character pivot: (700, 1060); speech bounce: 0.
- Idle sway: 0.65 degrees, horizontal 1.5 and vertical 1 reference pixels, 0.22 Hz.
- Worried and Look Up both glance screen-left; Look Up also glances upward.
- Worried sweat is a separate transparent PNG at (849, 435), with a 70px fall.
- Speech and manual mouth previews take priority over the optional impressed smile. Automatic blinks take priority over reaction eyes.
- Runtime supports additional final-pose holding through holdDuration; no extra animation loop is needed.

## Load

~~~ts
import { createAvatar } from '@hh1st/hoho-avatar';
import { canvasRenderer } from '@hh1st/hoho-avatar/canvas';

const avatar = await createAvatar(canvas, {
  renderer: canvasRenderer({ character: '/characters/mira/character.json' }),
});
avatar.triggerReaction('worried', { duration: 1.4, holdDuration: 2 });
avatar.setIdleMotion(true);
~~~

Adapt the URL to your application's base path. In the bundled Studio, select Mira or open ?character=mira. The verified mira.zip contains character.json and every referenced PNG at the archive root, with license and notes; it can also be loaded through Import avatar.

## Generation prompt

The built-in ImageGen tool was used for the reference and each matched edit, including blink, closed/small/large/round mouths, worried/look-up/impressed expressions, the clean face inpainting and separate sweat art. The reference smile supplies Wide and the impressed mouth; the Impressed edit supplies raised brows only inside measured brow footprints. Surrounding forehead and hair pixels and alpha remain identical to the neutral brow layer, preventing the generated forelock from shifting when the expression changes. Impressed deliberately reuses the neutral eye artwork to preserve socket placement and iris size; the grin and nod carry the delight. A separately generated impressed mouth was rejected because its surrounding skin lighting did not match the base. Registered crops share measured anchors, and feathered alpha boundaries preserve the illustration's skin and lighting. The prompt plan uses the skill's shared screen-left gaze.

Use case: stylized-concept. Asset type: original high-resolution layered 2D talking-avatar reference portrait named Mira, for a public open-source showcase. Design exactly one cheerful charming young adult woman. Soft slightly heart-shaped face, warm peach skin, naturally rosy cheeks, large expressive chocolate-brown eyes, delicate curved dark lashes, subtle eye highlights, thick gently arched dark-brown eyebrows. Long thick voluminous dark-chestnut hair, off-center part, beautifully defined loose waves and flowing curls extending past shoulders, soft face-framing strands, subtle warm-brown highlights. Small softly rounded nose, naturally pink lips, bright genuine open smile showing neat ivory upper teeth. Cozy ivory-white knitted sweater with simple round neckline, small elegant gold hoop earrings. Friendly witty enthusiastic slightly mischievous charismatic animated presenter. Polished premium 2D cartoon illustration with soft dimensional animated-feature aesthetic; stylized, rounded features, soft studio lighting, rich natural colors, dimensional shading, clean antialiased edges, no harsh outlines, no photorealism. Composition: square canvas, fully front-facing and centered, both eyes looking directly at viewer, relaxed level shoulders, head and upper torso, all hair silhouette visible. Leave generous fully transparent padding at top and sides and a little under torso for rotation and sway; do not crop hair, shoulders or sweater at image edges. Keep hair behind facial features rather than covering eyes/brows. Show normal complete face in this reference; matched clean face base and facial layers will be prepared by editing it next. Actual transparent background, no cast background or floor shadow, no checkerboard baked into pixels, no text, no watermark, no props.
