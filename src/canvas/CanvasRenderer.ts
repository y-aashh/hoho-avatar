import type { ReactionControllerOptions } from '../animation/ReactionController';
import type { AvatarRenderer, RendererCapabilities, RenderFrame } from '../core/renderer';
import type { SpriteCharacterDefinition } from './SpriteCharacterDefinition';
import { MouthState, MOUTH_STATES } from '../core/MouthState';
import { loadSpriteCharacter } from './SpriteAssetLoader';
import { SpritePainter } from './SpritePainter';

export interface CanvasRendererOptions { character: string | SpriteCharacterDefinition; }

/** Canvas implementation of the same renderer contract used by Three.js. */
export class CanvasRenderer implements AvatarRenderer {
  reactionOptions?: ReactionControllerOptions;
  readonly ready: Promise<void>;
  private lastFrame?: Readonly<RenderFrame>;
  private drawing?: SpritePainter;
  private disposed = false;
  private readonly loading = new AbortController();
  private features: RendererCapabilities = { mouth: [], blink: false, viewControl: false };
  get capabilities(): RendererCapabilities { return this.features; }

  constructor(private readonly canvas: HTMLCanvasElement, options: CanvasRendererOptions) {
    this.ready = loadSpriteCharacter(options.character, this.loading.signal).then((character) => {
      this.loading.signal.throwIfAborted();
      this.drawing = new SpritePainter(canvas, character);
      this.reactionOptions = { idleSway: character.definition.animation?.idleSway, idleMotion: Boolean(character.definition.animation?.idleSway) };
      this.features = { mouth: MOUTH_STATES, blink: Boolean(character.eyes), viewControl: false, reactions: ['worried', 'look_up', 'impressed'], idleMotion: true };
      if (this.canvas.style) this.canvas.style.imageRendering = character.definition.renderStyle === 'smooth' ? 'auto' : 'pixelated';
      this.reset();
    }).catch((error) => { this.destroy(); throw error; });
  }
  render(frame: Readonly<RenderFrame>): void { if (!this.disposed) { this.lastFrame = frame; this.drawing?.renderFrame(frame); } }
  reset(): void {
    if (this.disposed) return;
    const motion = { timestamp: 0, energy: 0, speaking: false, mouth: MouthState.Closed };
    if (this.lastFrame) this.drawing?.renderFrame({ ...this.lastFrame, motion, mouthPreview: false });
    else this.drawing?.render(motion, false);
  }
  // Canvas uses its character's logical resolution and CSS display size.
  resize(): void {}
  resetView(): void {}
  setViewControlEnabled(_enabled: boolean): void {}
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true; this.loading.abort();
    this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawing = undefined; this.lastFrame = undefined;
  }
}
