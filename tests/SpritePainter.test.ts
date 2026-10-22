import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpritePainter } from '../src/canvas/SpritePainter';
import { ReactionController } from '../src/animation/ReactionController';
import type { LoadedSpriteCharacter } from '../src/canvas/SpriteAssetLoader';
import { CharacterState, MouthState } from '../src';

const image = (name: string) => ({ name, width: 20, height: 10 }) as unknown as HTMLImageElement;
function setup(style: 'pixel' | 'smooth') {
  const calls: string[] = [];
  const context = { imageSmoothingEnabled: false, imageSmoothingQuality: 'low', globalAlpha: 1,
    clearRect: vi.fn(() => calls.push('clear')), save: vi.fn(() => calls.push('save')), restore: vi.fn(() => calls.push('restore')),
    translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn((im) => calls.push(im.name ?? 'blend')) };
  const character: LoadedSpriteCharacter = { definition: { version: 1, renderStyle: style, canvas: { width: 512, height: 512 }, body: { src: 'body.png' },
    mouth: { anchor: { x: 256.25, y: 330.25 }, sprites: { closed: '', small: '', large: '', wide: '', round: '' } },
    eyes: { anchor: { x: 256, y: 200 }, sprites: { open: '', closed: '' } },
    eyebrows: { src: 'brows.png', anchor: { x: 256, y: 180 } },
    reactions: { worried: { eyes: 'worried.png', eyebrows: 'brows.png', effect: { src: 'sweat.png', anchor: { x: 320, y: 200 } } }, impressed: { mouth: 'smile.png' } } },
    body: image('body'), mouths: { closed: image('closed'), small: image('small'), large: image('large'), wide: image('wide'), round: image('round') },
    eyes: { open: image('eyes'), closed: image('blink') }, eyebrows: image('brows'),
    reactions: { worried: { eyes: image('worried'), eyebrows: image('worried-brows'), effect: image('sweat') }, impressed: { mouth: image('smile') } } };
  const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
  const painter = new SpritePainter(canvas, character);
  return { painter, context, calls };
}
const motion = { timestamp: 0, speaking: false, energy: 0, mouth: MouthState.Closed };
describe('SpritePainter reactions', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('draws transformed attached layers and effects in order over a transparent clear', () => {
    const { painter, calls, context } = setup('smooth');
    const reactions = new ReactionController(); reactions.triggerReaction('worried');
    painter.renderFrame({ motion, eyesClosed: false, state: CharacterState.Idle, timestamp: 400, deltaSeconds: 0.4, reaction: reactions.update(0.4) });
    expect(calls).toEqual(['clear', 'save', 'body', 'worried', 'worried-brows', 'closed', 'sweat', 'restore']);
    expect(context.rotate).toHaveBeenCalledOnce();
    expect(context.translate).toHaveBeenCalledTimes(2);
    expect(context.globalAlpha).toBe(1);
  });
  it.each([0.05, 0.11, 0.14, 0.4, 0.82, 0.84, 0.88, 0.95])('draws exactly one set of facial features at progress %s', progress => {
    const { painter, context, calls } = setup('smooth');
    const controller = new ReactionController(); controller.triggerReaction('worried', { duration: 1, intensity: 0.8 });
    const reaction = controller.update(progress);
    painter.renderFrame({ motion, eyesClosed: false, state: CharacterState.Idle, timestamp: 0, deltaSeconds: 0, reaction });
    expect(calls.filter(name => name === 'eyes' || name === 'worried')).toHaveLength(1);
    expect(calls.filter(name => name === 'brows' || name === 'worried-brows')).toHaveLength(1);
    expect(calls).not.toContain('blend');
    expect(context.globalAlpha).toBe(1);
  });
  it('replaces a whole expression coherently during interruption and reset', () => {
    const { painter, calls } = setup('smooth');
    const controller = new ReactionController(); controller.triggerReaction('worried'); controller.update(0.4);
    controller.triggerReaction('impressed');
    const draw = (dt: number) => {
      calls.length = 0;
      painter.renderFrame({ motion, eyesClosed: false, state: CharacterState.Idle, timestamp: 0, deltaSeconds: dt, reaction: controller.update(dt) });
    };
    draw(0.08); expect(calls).toContain('worried'); expect(calls).not.toContain('smile');
    draw(0.2); expect(calls).toContain('smile'); expect(calls).not.toContain('worried-brows');
    controller.resetReaction(); draw(0.22); expect(calls).toContain('eyes'); expect(calls).not.toContain('smile');
  });
  it('preserves blinking, speech mouth and manual mouth preview during a reaction', () => {
    const { painter, calls } = setup('pixel'); const r = new ReactionController(); r.triggerReaction('impressed');
    const reaction = r.update(0.5);
    const frame = { motion: { ...motion, speaking: true, mouth: MouthState.Large }, eyesClosed: true, state: CharacterState.Speaking, timestamp: 0, deltaSeconds: 0, reaction };
    painter.renderFrame(frame); expect(calls).toContain('blink'); expect(calls).toContain('large'); expect(calls).not.toContain('blend');
    calls.length = 0;
    painter.renderFrame({ ...frame, motion, mouthPreview: true }); expect(calls).toContain('closed'); expect(calls).not.toContain('blend');
  });
  it.each(['smooth', 'pixel'] as const)('uses the correct interpolation and placement for %s', style => {
    const { painter, context } = setup(style); painter.render(motion, false);
    expect(context.imageSmoothingEnabled).toBe(style === 'smooth');
    if (style === 'smooth') expect(context.imageSmoothingQuality).toBe('high');
    expect(context.drawImage.mock.calls.at(-1)!.slice(1)).toEqual(style === 'smooth' ? [246.25, 325.25] : [246, 325]);
  });
});
