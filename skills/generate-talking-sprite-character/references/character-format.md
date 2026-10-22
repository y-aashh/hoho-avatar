# Canvas V1 character format

The renderer resolves every image path relative to `character.json` and draws in this order:

```text
body -> eyes (or blink) -> eyebrows -> mouth -> foreground effects
```

Required V1 mouth states are `closed`, `small`, `large`, `wide`, and `round`.

```json
{
  "version": 1,
  "canvas": { "width": 512, "height": 512 },
  "body": {
    "src": "body.png",
    "x": 0,
    "y": 0,
    "width": 512,
    "height": 512
  },
  "mouth": {
    "anchor": { "x": 256, "y": 338 },
    "sprites": {
      "closed": "mouth-closed.png",
      "small": "mouth-small.png",
      "large": "mouth-large.png",
      "wide": "mouth-wide.png",
      "round": "mouth-round.png"
    }
  },
  "eyes": {
    "anchor": { "x": 256, "y": 256 },
    "sprites": {
      "open": "eyes-open.png",
      "closed": "eyes-closed.png"
    }
  },
  "animation": { "bodyBouncePx": 2 }
}
```

The anchor is the center of the corresponding PNG layer. PNG layers must use RGBA transparency.

Use `bodyBouncePx: 0` for poster-like or multi-subject compositions. Use `1` or `2` for restrained pixel sprites. Avoid values above `3` in a 512x512 canvas.

The core library accepts either a URL or an in-memory definition:

```ts
import { createAvatar } from '@hh1st/hoho-avatar';
import { canvasRenderer } from '@hh1st/hoho-avatar/canvas';
const avatar = await createAvatar(canvas, {
  renderer: canvasRenderer({ character: '/characters/my-character/character.json' }),
  sampleRate: audioContext.sampleRate,
});
```

Version stays 1. Omitted optional fields preserve legacy behavior. `renderStyle` is `pixel` (default, nearest-neighbor) or `smooth` (high-quality smoothing and fractional positions). Canvas dimensions can be any positive integral dimensions, including high-resolution illustrations. All anchors are PNG centers in the declared canvas coordinate system, not CSS pixels.

Optional additions (merge with required fields above):

```json
{
  "renderStyle": "smooth",
  "eyebrows": { "src": "eyebrows.png", "anchor": { "x": 256, "y": 200 } },
  "animation": {
    "bodyBouncePx": 1,
    "pivot": { "x": 256, "y": 360 },
    "idleSway": { "rotationDeg": 0.9, "horizontalPx": 2, "verticalPx": 1.5, "frequencyHz": 0.25, "speechInfluence": 0 }
  },
  "reactions": {
    "worried": {
      "eyes": "eyes-worried.png",
      "eyebrows": "eyebrows-worried.png",
      "effect": { "src": "sweat-drop.png", "anchor": { "x": 360, "y": 220 }, "fallPx": 45 }
    },
    "look_up": { "eyes": "eyes-look-up.png" },
    "impressed": { "eyes": "eyes-impressed.png", "eyebrows": "eyebrows-impressed.png", "mouth": "mouth-impressed.png" }
  }
}
```

Idle distances use a 512-unit reference canvas and scale by width/height; angles and frequency do not scale. Explicit `fallPx`, effect `width`/`height`, `bodyBouncePx`, pivots and anchors use declared canvas units. Omitting `fallPx` scales the default 45px fall. Declared idle settings enable sway initially; otherwise enable using `avatar.setIdleMotion(true)`.

Per-reaction `eyesAnchor`, `eyebrowsAnchor`, `mouthAnchor` override their neutral layer centers. Eyebrow variants require neutral eyebrows art. All optional art must be transparent PNG with matching anatomy. Missing undeclared sprites fall back to neutral. Declared missing files fail loading. ZIP packages must include all referenced assets, using safe relative paths with no parent traversal. URL-loaded definitions may use http(s) URLs and imported in-memory definitions use blob URLs.

Whole-character transforms use the pivot (default width/2, height*0.7); no independent head rotation is implied. Effects share this transform. Blink art overrides reaction eyes. Speech and manual mouth previews override reaction mouth art. Preserve margins for motion; artwork reaching canvas edges can clip.
