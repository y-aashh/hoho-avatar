import { readFileSync, readdirSync } from "node:fs";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { loadSpriteCharacterPackage } from "../examples/basic/characterPackage";

describe("bundled character ZIP import", () => {
  it.each(["pixel-bot", "mira"])("preserves %s image bytes", async (name) => {
    const directory = new URL(`../public/characters/${name}/`, import.meta.url);
    const files = Object.fromEntries(readdirSync(directory).filter(file => !file.endsWith('.zip')).map((file) => [
      `${name}/${file}`, new Uint8Array(readFileSync(new URL(file, directory))),
    ]));
    // Exercise the actual published archive for Mira, without nesting it in itself.
    const bytes = name === 'mira' ? new Uint8Array(readFileSync(new URL('mira.zip', directory))) : zipSync(files);
    const blobs = [];
    const revoked = [];
    const loaded = await loadSpriteCharacterPackage({
      name: `${name}.zip`,
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.slice().buffer,
    }, {
      create: (blob) => { blobs.push(blob); return `blob:test-${blobs.length}`; },
      revoke: (url) => revoked.push(url),
    });
    expect(loaded.name).toBe(name);
    const original = JSON.parse(readFileSync(new URL('character.json', directory), 'utf8'));
    const pairs = [];
    const collect = (before, after) => {
      for (const [key, value] of Object.entries(before)) {
        if (typeof value === 'string' && value.endsWith('.png')) pairs.push([value, after[key]]);
        else if (value && typeof value === 'object') collect(value, after[key]);
      }
    };
    collect(original, loaded.definition);
    expect(blobs).toHaveLength(pairs.length);
    for (const [path, url] of pairs) {
      const index = Number(url.replace('blob:test-', '')) - 1;
      // Compare every byte natively; large illustrated PNGs need no per-element matcher work.
      expect(Buffer.from(await blobs[index].arrayBuffer()).equals(Buffer.from(files[`${name}/${path}`]))).toBe(true);
    }
    loaded.dispose();
    expect(revoked).toHaveLength(pairs.length);
  });
});
