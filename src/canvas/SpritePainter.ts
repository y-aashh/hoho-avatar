import type { MotionFrame } from '../core/types';
import type { RenderFrame } from '../core/renderer';
import type { LoadedSpriteCharacter } from './SpriteAssetLoader';

export class SpritePainter {
  private readonly context: CanvasRenderingContext2D;
  constructor(private readonly canvas: HTMLCanvasElement, private readonly character: LoadedSpriteCharacter) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    this.context = context;
    canvas.width = character.definition.canvas.width;
    canvas.height = character.definition.canvas.height;
    context.imageSmoothingEnabled = character.definition.renderStyle === 'smooth';
    if (context.imageSmoothingEnabled) context.imageSmoothingQuality = 'high';
  }
  render(motion: MotionFrame, eyesClosed: boolean): void { this.paint(motion, eyesClosed); }
  renderFrame(frame: Readonly<RenderFrame>): void { this.paint(frame.motion, frame.eyesClosed, frame); }
  private paint(motion: Readonly<MotionFrame>, eyesClosed: boolean, frame?: Readonly<RenderFrame>): void {
    const { context: ctx, canvas, character: c } = this;
    const d = c.definition, pose = frame?.reaction, smooth = d.renderStyle === 'smooth';
    const round = (n: number) => smooth ? n : Math.round(n);
    const bounce = motion.speaking ? -round(motion.energy * (d.animation?.bodyBouncePx ?? 3)) : 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const transformed = pose !== undefined;
    if (transformed) {
      const pivot = d.animation?.pivot ?? { x: canvas.width / 2, y: canvas.height * 0.7 };
      const sx = canvas.width / 512, sy = canvas.height / 512;
      ctx.save();
      ctx.translate(round(pivot.x + (pose.position.x + pose.idle.x) * sx), round(pivot.y + (pose.position.y + pose.idle.y) * sy + bounce));
      ctx.rotate((pose.rotation + pose.idle.rotation) * Math.PI / 180);
      ctx.translate(-pivot.x, -pivot.y);
    }
    try {
      const offset = transformed ? 0 : bounce;
      const body = d.body;
      ctx.drawImage(c.body, body.x ?? 0, (body.y ?? 0) + offset, body.width ?? c.body.width, body.height ?? c.body.height);
      const layers = pose?.layers ?? [];
      const draw = (image: HTMLImageElement | undefined, anchor: { x: number; y: number }, alpha = 1) => {
        if (!image || alpha <= 0) return;
        const oldAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha;
        ctx.drawImage(image, round(anchor.x - image.width / 2), round(anchor.y - image.height / 2 + offset));
        ctx.globalAlpha = oldAlpha;
      };
      // Full raster faces cannot crossfade displaced pupils/brows without ghosts.
      // Select one coherent expression; keep pose/effect weights continuous.
      const weights = new Map<NonNullable<typeof pose>['layers'][number]['expression'], number>();
      let total = 0;
      for (const layer of layers) {
        total += layer.weight;
        weights.set(layer.expression, (weights.get(layer.expression) ?? 0) + layer.weight);
      }
      let strongest = Math.max(0, 1 - total);
      let expression: NonNullable<typeof pose>['expression'];
      for (const [name, weight] of weights) {
        if (weight > strongest) { strongest = weight; expression = name; }
      }
      const feature = (key: 'eyes' | 'eyebrows' | 'mouth', neutral: HTMLImageElement | undefined, anchor: { x: number; y: number }) => {
        const image = expression ? c.reactions?.[expression]?.[key] : undefined;
        const override = expression ? d.reactions?.[expression] : undefined;
        draw(image ?? neutral, image ? override?.[`${key}Anchor`] ?? anchor : anchor);
      };
      if (d.eyes && c.eyes) {
        if (eyesClosed) draw(c.eyes.closed, d.eyes.anchor);
        else feature('eyes', c.eyes.open, d.eyes.anchor);
      }
      if (d.eyebrows) feature('eyebrows', c.eyebrows, d.eyebrows.anchor);
      if (motion.speaking || frame?.mouthPreview) draw(c.mouths[motion.mouth], d.mouth.anchor);
      else feature('mouth', c.mouths[motion.mouth], d.mouth.anchor);
      // Foreground effects share the character transform and head coordinate system.
      for (const l of layers) {
        const effect = d.reactions?.[l.expression]?.effect, image = c.reactions?.[l.expression]?.effect;
        if (!effect || !image) continue;
        const oldAlpha = ctx.globalAlpha;
        ctx.globalAlpha = l.weight * l.effect.opacity;
        const width = effect.width ?? image.width, height = effect.height ?? image.height;
        const y = l.effect.y / 45 * (effect.fallPx ?? canvas.height * 45 / 512);
        ctx.drawImage(image, round(effect.anchor.x - width / 2), round(effect.anchor.y - height / 2 + y + offset), width, height);
        ctx.globalAlpha = oldAlpha;
      }
    } finally { if (transformed) ctx.restore(); }
  }
}
