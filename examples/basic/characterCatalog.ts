import type { RendererFactory } from '../../src';
import { canvasRenderer } from '../../src/canvas';
import type { SpriteCharacterDefinition } from '../../src/canvas';
import { live2dConfig } from './studioConfig';
import { wankoromochiViewBox } from './live2dPresentation';

interface CharacterInfo {
  id: string;
  label: string;
  defaultText: string;
}
export type StudioCharacter = CharacterInfo & (
  | { renderer: '2d'; source: string | SpriteCharacterDefinition }
  | { renderer: 'live2d'; source: string }
);

export function createCharacterCatalog(): Map<string, StudioCharacter> {
  const characters: StudioCharacter[] = [
    { id: 'pixel-bot', renderer: '2d', source: import.meta.env.BASE_URL + 'characters/pixel-bot/character.json',
      label: 'Pixel Bot', defaultText: "Hey, I'm Pixel Bot. What's been the best part of your day?" },
    { id: 'mira', renderer: '2d', source: import.meta.env.BASE_URL + 'characters/mira/character.json',
      label: 'Mira', defaultText: "Hey, I'm Mira! What's sparked your curiosity today?" },
  ];
  if (live2dConfig.modelUrl) {
    characters.push({ id: 'live2d', renderer: 'live2d', source: live2dConfig.modelUrl,
      label: live2dConfig.name, defaultText: "Hello! It's nice to meet you." });
  }
  return new Map(characters.map((character) => [character.id, character]));
}

/** Optional renderer dependencies are fetched only when their character is selected. */
export async function createCharacterRenderer(character: StudioCharacter): Promise<RendererFactory> {
  switch (character.renderer) {
    case 'live2d':
      return (await import('../../src/live2d')).live2dRenderer({
        model: character.source, coreUrl: live2dConfig.coreUrl || undefined,
        ...(live2dConfig.usesSample ? { viewBox: wankoromochiViewBox, padding: 0.12 } : {}),
      });
    case '2d':
      return canvasRenderer({ character: character.source });
  }
}
