import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasRenderer } from "../src/canvas";
import { MotionController } from "../src/core/MotionController";
import type { SpriteCharacterDefinition } from "../src/canvas";

const character: SpriteCharacterDefinition = {
  version: 1,
  canvas: { width: 128, height: 128 },
  body: { src: "body.png" },
  mouth: {
    anchor: { x: 64, y: 80 },
    sprites: {
      closed: "closed.png",
      small: "small.png",
      large: "large.png",
      wide: "wide.png",
      round: "round.png",
    },
  },
};

describe("Canvas renderer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("changes PCM rate without reloading images and resets the previous motion", async () => {
    const images: object[] = [];
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      width = 16; height = 16;
      constructor() { images.push(this); }
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.stubGlobal("document", { baseURI: "https://example.test/" });
    const context = { clearRect: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: true };
    const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
    const sprite = new MotionController(new CanvasRenderer(canvas, { character }), 48000);
    await sprite.ready;
    const onMotion = vi.fn();
    sprite.onMotion(onMotion);
    sprite.setSampleRate(24000);
    expect(onMotion).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mouth: "closed", energy: 0 }));
    sprite.pushPCM(new Float32Array(720));
    expect(onMotion).toHaveBeenCalledTimes(2);
    expect(images).toHaveLength(6);
    expect(() => sprite.setSampleRate(NaN)).toThrow("finite");
    sprite.destroy();
  });

  it('loads reaction sprites once relative to the config and rejects a declared broken sprite', async () => {
    const paths: string[] = [];
    vi.stubGlobal('document', { baseURI: 'https://example.test/app/' });
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null; onerror: (() => void) | null = null;
      width = 16; height = 16;
      set src(value: string) { paths.push(value); queueMicrotask(() => value.endsWith('broken.png') ? this.onerror?.() : this.onload?.()); }
    });
    const context = { clearRect: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: false, globalAlpha: 1 };
    const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
    const definition = { ...character, reactions: { worried: { effect: { src: 'sweat.png', anchor: { x: 80, y: 40 } } } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => definition }));
    const renderer = new CanvasRenderer(canvas, { character: 'characters/a/character.json' });
    await renderer.ready;
    expect(renderer.capabilities.reactions).toEqual(['worried', 'look_up', 'impressed', 'aha', 'curious']);
    expect(paths).toContain('https://example.test/app/characters/a/sweat.png');
    renderer.reset(); renderer.reset();
    expect(paths.filter(p => p.endsWith('sweat.png'))).toHaveLength(1);
    renderer.destroy();
    definition.reactions.worried.effect.src = 'broken.png';
    await expect(new CanvasRenderer(canvas, { character: definition }).ready).rejects.toThrow('broken.png');
  });

  it("does not initialize a renderer after being destroyed during loading", async () => {
    const images: Array<{ onload: (() => void) | null; width: number; height: number }> = [];
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 16;
      height = 16;
      constructor() { images.push(this); }
      set src(_value: string) {}
    });
    vi.stubGlobal("document", { baseURI: "https://example.test/" });

    const context = { clearRect: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: true };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement;
    const sprite = new MotionController(new CanvasRenderer(canvas, { character }), 48_000);

    const rejected = expect(sprite.ready).rejects.toMatchObject({ name: "AbortError" });
    sprite.destroy();
    for (const image of images) image.onload?.();
    await rejected;

    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(() => sprite.start()).toThrow(/destroyed/);
  });
});
