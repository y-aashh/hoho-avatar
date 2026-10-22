import type { ReactionName } from '../animation/ReactionController';
import { parseSpriteCharacterDefinition } from "./parseSpriteCharacter";
import type { SpriteCharacterDefinition } from "./SpriteCharacterDefinition";
import type { MouthState } from "../core/types";
import { MOUTH_STATES } from '../core/MouthState';

export interface LoadedSpriteCharacter {
  definition: SpriteCharacterDefinition;
  body: HTMLImageElement;
  mouths: Record<MouthState, HTMLImageElement>;
  eyebrows?: HTMLImageElement;
  reactions?: Partial<Record<ReactionName, Partial<Record<'eyes' | 'eyebrows' | 'mouth' | 'effect', HTMLImageElement>>>>;
  eyes?: Record<"open" | "closed", HTMLImageElement>;
}

const loadImage = (src: string, signal?: AbortSignal): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  signal?.throwIfAborted();
  const image = new Image();
  const cleanup = () => { image.onload = null; image.onerror = null; signal?.removeEventListener('abort', abort); };
  const abort = () => { cleanup(); reject(signal?.reason); };
  signal?.addEventListener('abort', abort, { once: true });
  image.onload = () => { cleanup(); resolve(image); };
  image.onerror = () => { cleanup(); reject(new Error(`Unable to load sprite: ${src}`)); };
  image.src = src;
});

export async function loadSpriteCharacter(source: string | SpriteCharacterDefinition, signal?: AbortSignal): Promise<LoadedSpriteCharacter> {
  signal?.throwIfAborted();
  let definition: SpriteCharacterDefinition;
  let baseUrl = document.baseURI;

  if (typeof source === "string") {
    const configUrl = new URL(source, document.baseURI);
    const response = await fetch(configUrl, { signal });
    if (!response.ok) throw new Error(`Unable to load character: ${response.status}`);
    definition = parseSpriteCharacterDefinition(await response.json());
    baseUrl = configUrl.href;
  } else {
    definition = parseSpriteCharacterDefinition(source);
  }

  const resolve = (path: string) => new URL(path, baseUrl).href;
  const mouthPromise = Promise.all(
    MOUTH_STATES.map(async (state) => [state, await loadImage(resolve(definition.mouth.sprites[state]), signal)] as const),
  );
  const eyesPromise = definition.eyes
    ? Promise.all(Object.entries(definition.eyes.sprites).map(async ([key, path]) => [key, await loadImage(resolve(path), signal)] as const))
    : undefined;
  const reactionPromise = Promise.all(Object.entries(definition.reactions ?? {}).map(async ([name, reaction]) => {
    const entries = await Promise.all((['eyes', 'eyebrows', 'mouth', 'effect'] as const).map(async key => {
      const path = key === 'effect' ? reaction.effect?.src : reaction[key];
      return [key, path ? await loadImage(resolve(path), signal) : undefined];
    }));
    return [name, Object.fromEntries(entries)];
  }));
  const [body, mouthEntries, eyeEntries, reactions, eyebrows] = await Promise.all([
    loadImage(resolve(definition.body.src), signal),
    mouthPromise,
    eyesPromise,
    reactionPromise,
    definition.eyebrows ? loadImage(resolve(definition.eyebrows.src), signal) : undefined,
  ]);

  return {
    definition,
    reactions: Object.fromEntries(reactions),
    eyebrows,
    body,
    mouths: Object.fromEntries(mouthEntries) as Record<MouthState, HTMLImageElement>,
    eyes: eyeEntries ? Object.fromEntries(eyeEntries) as Record<"open" | "closed", HTMLImageElement> : undefined,
  };
}
