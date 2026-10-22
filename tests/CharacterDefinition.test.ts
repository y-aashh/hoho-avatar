import { describe, expect, it } from "vitest";
import { parseSpriteCharacterDefinition } from "../src/canvas/parseSpriteCharacter";
import { MOUTH_STATES } from '../src/core/MouthState';

const validCharacter = () => ({
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
});

describe("parseSpriteCharacterDefinition", () => {
  it("accepts a complete character definition", () => {
    expect(parseSpriteCharacterDefinition(validCharacter())).toEqual(validCharacter());
  });

  it.each(MOUTH_STATES)("rejects missing %s sprite at the engine boundary", (state) => {
    const character = validCharacter();
    delete (character.mouth.sprites as Partial<typeof character.mouth.sprites>)[state];
    expect(() => parseSpriteCharacterDefinition(character)).toThrow(state);
  });

  it('accepts high resolution smooth definitions and rejects malformed reactions', () => {
    const c = { ...validCharacter(), renderStyle: 'smooth', canvas: { width: 2048, height: 1536 }, reactions: {
      worried: { effect: { src: 'sweat.png', anchor: { x: 100, y: 200 } } },
    } };
    expect(parseSpriteCharacterDefinition(c).canvas.width).toBe(2048);
    for (const src of ['../secret.png', 'javascript:alert(1)', 'file:///secret', '%2e%2e/secret.png', 'data:text/html;base64,AAAA', '']) {
      expect(() => parseSpriteCharacterDefinition({ ...c, reactions: { worried: { effect: { src, anchor: { x: 1, y: 1 } } } } })).toThrow('path');
    }
    expect(() => parseSpriteCharacterDefinition({ ...c, reactions: { worried: { eyebrows: 'brows.png' } } })).toThrow('neutral eyebrows');
    expect(() => parseSpriteCharacterDefinition({ ...c, animation: { pivot: { x: 5000, y: 0 } } })).toThrow('outside');
  });

  it('accepts inert bundler image data URLs while rejecting active data', () => {
    const c = validCharacter(); c.body.src = 'data:image/png;base64,iVBORw0KGgo=';
    expect(parseSpriteCharacterDefinition(c).body.src).toBe(c.body.src);
  });

  it("rejects invalid dimensions and animation values", () => {
    expect(() => parseSpriteCharacterDefinition({ ...validCharacter(), canvas: { width: Infinity, height: 128 } })).toThrow(/canvas/);
    expect(() => parseSpriteCharacterDefinition({ ...validCharacter(), animation: { bodyBouncePx: -1 } })).toThrow(/bodyBouncePx/);
  });
});
