import { REACTIONS, validateIdleMotion } from '../animation/ReactionController';
import type { SpriteCharacterDefinition, SpritePlacement } from "./SpriteCharacterDefinition";
import { MOUTH_STATES } from '../core/MouthState';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function requirePoint(value: unknown, label: string): asserts value is { x: number; y: number } {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    throw new Error(`${label} must contain finite numeric x and y values.`);
  }
}

function requirePlacement(value: unknown, label: string): asserts value is SpritePlacement {
  if (!isRecord(value) || !isNonEmptyString(value.src)) throw new Error(`${label}.src must be a non-empty string.`);
  for (const key of ["x", "y", "width", "height"] as const) {
    const coordinate = value[key];
    if (coordinate !== undefined && !isFiniteNumber(coordinate)) throw new Error(`${label}.${key} must be a finite number.`);
  }
  if (isFiniteNumber(value.width) && value.width <= 0) throw new Error(`${label}.width must be positive.`);
  if (isFiniteNumber(value.height) && value.height <= 0) throw new Error(`${label}.height must be positive.`);
}

function requirePath(value: unknown, label: string): void {
  // Bundlers inline small PNG imports; permit only inert base64 image URLs.
  if (typeof value === 'string' && /^data:image\/(?:png|webp|jpeg|gif);base64,[a-z\d+/]+={0,2}$/i.test(value)) return;
  if (!isNonEmptyString(value) || (value.includes('\\') || [...value].some(c => c.charCodeAt(0) < 32))
    || /^(?:javascript|data|file):/i.test(value) || value.split('/').includes('..')) throw new Error(`${label} must be a safe sprite path.`);
  try { const decoded = decodeURIComponent(value); if (decoded.split('/').includes('..') || decoded.includes('\\')) throw new Error(); const url = new URL(value, 'https://avatar.invalid/'); if (!['https:', 'http:', 'blob:'].includes(url.protocol)) throw new Error(); }
  catch { throw new Error(`${label} must be a safe sprite path.`); }
}

/** Validate untrusted JSON before it reaches the renderer or asset loader. */
export function parseSpriteCharacterDefinition(value: unknown): SpriteCharacterDefinition {
  if (!isRecord(value) || value.version !== 1) throw new Error("character.json must use version 1.");
  if (!isRecord(value.canvas) || !isFiniteNumber(value.canvas.width) || !isFiniteNumber(value.canvas.height)
    || value.canvas.width <= 0 || value.canvas.height <= 0 || !Number.isSafeInteger(value.canvas.width) || !Number.isSafeInteger(value.canvas.height)) {
    throw new Error("character.json must define a positive, finite canvas width and height.");
  }
  requirePlacement(value.body, "body");
  if (!isRecord(value.mouth)) throw new Error("character.json is missing mouth settings.");
  requirePoint(value.mouth.anchor, "mouth.anchor");
  if (!isRecord(value.mouth.sprites)) throw new Error("character.json is missing mouth sprites.");
  for (const state of MOUTH_STATES) {
    if (!isNonEmptyString(value.mouth.sprites[state])) throw new Error(`character.json is missing mouth sprite: ${state}.`);
  }
  if (value.eyes !== undefined) {
    if (!isRecord(value.eyes)) throw new Error("eyes must be an object.");
    requirePoint(value.eyes.anchor, "eyes.anchor");
    if (!isRecord(value.eyes.sprites) || !isNonEmptyString(value.eyes.sprites.open) || !isNonEmptyString(value.eyes.sprites.closed)) {
      throw new Error("eyes.sprites must contain open and closed images.");
    }
  }
  if (value.animation !== undefined) {
    if (!isRecord(value.animation)) throw new Error("animation must be an object.");
    const bounce = value.animation.bodyBouncePx;
    if (bounce !== undefined && (!isFiniteNumber(bounce) || bounce < 0)) {
      throw new Error("animation.bodyBouncePx must be a non-negative finite number.");
    }
  }
  if (value.renderStyle !== undefined && !['pixel', 'smooth'].includes(value.renderStyle as string)) throw new Error('renderStyle must be pixel or smooth');
  const pointInCanvas = (point: unknown, label: string) => {
    requirePoint(point, label);
    const canvas = value.canvas as { width: number; height: number };
    if (point.x < 0 || point.y < 0 || point.x > canvas.width || point.y > canvas.height) throw new Error(`${label} is outside canvas`);
  };
  requirePath(value.body.src, 'body.src');
  for (const [key, path] of Object.entries(value.mouth.sprites)) requirePath(path, `mouth.${key}`);
  if (isRecord(value.eyes) && isRecord(value.eyes.sprites)) for (const path of Object.values(value.eyes.sprites)) requirePath(path, 'eyes');
  if (isRecord(value.animation)) {
    if (value.animation.pivot !== undefined) pointInCanvas(value.animation.pivot, 'animation.pivot');
    if (value.animation.idleSway !== undefined) {
      if (!isRecord(value.animation.idleSway)) throw new Error('idleSway must be an object');
      validateIdleMotion(value.animation.idleSway);
    }
  }
  if (value.eyebrows !== undefined) {
    if (!isRecord(value.eyebrows)) throw new Error('eyebrows must be an object');
    requirePath(value.eyebrows.src, 'eyebrows.src'); pointInCanvas(value.eyebrows.anchor, 'eyebrows.anchor');
  }
  if (value.reactions !== undefined) {
    if (!isRecord(value.reactions)) throw new Error('reactions must be an object');
    for (const [name, reaction] of Object.entries(value.reactions)) {
      if (!REACTIONS.includes(name as never) || !isRecord(reaction)) throw new Error(`Unknown reaction: ${name}`);
      for (const feature of ['eyes', 'eyebrows', 'mouth']) {
        if (reaction[feature] !== undefined) requirePath(reaction[feature], `reactions.${name}.${feature}`);
        if (reaction[`${feature}Anchor`] !== undefined) pointInCanvas(reaction[`${feature}Anchor`], `${name}.${feature}Anchor`);
      }
      if (reaction.eyebrows && !value.eyebrows) throw new Error(`${name}.eyebrows requires neutral eyebrows art and anchor`);
      if (reaction.eyes && !value.eyes) throw new Error(`${name}.eyes requires neutral eyes art and anchor`);
      if (reaction.effect !== undefined) {
        if (!isRecord(reaction.effect)) throw new Error(`${name}.effect must be an object`);
        requirePath(reaction.effect.src, `${name}.effect.src`);
        pointInCanvas(reaction.effect.anchor, `${name}.effect.anchor`);
        for (const key of ['width', 'height', 'fallPx']) {
          const n = reaction.effect[key];
          if (n !== undefined && (!isFiniteNumber(n) || n < 0 || (key !== 'fallPx' && n === 0))) throw new Error(`${name}.effect.${key} must be finite and positive`);
        }
      }
    }
  }
  return value as unknown as SpriteCharacterDefinition;
}
