import { readFileSync, readdirSync } from 'node:fs';
import { zipSync } from 'fflate';

/** An imported character using only the public Pixel Bot artwork. */
export function spritePackage(name = 'my-character', { brokenBody = false } = {}) {
  const directory = new URL('../public/characters/pixel-bot/', import.meta.url);
  const entries = Object.fromEntries(readdirSync(directory).map(file => [
    `${name}/${file}`, new Uint8Array(readFileSync(new URL(file, directory))),
  ]));
  if (brokenBody) entries[`${name}/body.png`] = new Uint8Array([1, 2, 3]);
  return { name: name + '.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(entries)) };
}
