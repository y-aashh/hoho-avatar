import type { IdleMotionOptions, ReactionName } from '../animation/ReactionController';
import type { MouthState } from '../core/MouthState';

export interface SpritePlacement {
  src: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ReactionSpriteDefinition {
  eyes?: string;
  eyebrows?: string;
  mouth?: string;
  eyesAnchor?: { x: number; y: number };
  eyebrowsAnchor?: { x: number; y: number };
  mouthAnchor?: { x: number; y: number };
  effect?: { src: string; anchor: { x: number; y: number }; fallPx?: number; width?: number; height?: number };
}
export interface SpriteCharacterDefinition {
  version: 1;
  renderStyle?: 'pixel' | 'smooth';
  reactions?: Partial<Record<ReactionName, ReactionSpriteDefinition>>;
  eyebrows?: { src: string; anchor: { x: number; y: number } };
  canvas: { width: number; height: number };
  body: SpritePlacement;
  mouth: {
    anchor: { x: number; y: number };
    sprites: Record<MouthState, string>;
  };
  eyes?: {
    anchor: { x: number; y: number };
    sprites: { open: string; closed: string };
  };
  animation?: {
    bodyBouncePx?: number;
    pivot?: { x: number; y: number };
    idleSway?: IdleMotionOptions;
  };
}
