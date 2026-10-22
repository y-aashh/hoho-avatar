import { readFileSync, readdirSync } from "node:fs";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { loadSpriteCharacterPackage } from "../examples/basic/characterPackage";

describe("bundled character ZIP import", () => {
  it.each(["niu-lai", "pixel-bot", "pixel-portrait"])("preserves %s image bytes", async (name) => {
    const directory = new URL(`../public/characters/${name}/`, import.meta.url);
    const files = Object.fromEntries(readdirSync(directory).map((file) => [
      `${name}/${file}`, new Uint8Array(readFileSync(new URL(file, directory))),
    ]));
    const bytes = zipSync(files);
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
      expect(new Uint8Array(await blobs[index].arrayBuffer())).toEqual(files[`${name}/${path}`]);
    }
    loaded.dispose();
    expect(revoked).toHaveLength(pairs.length);
  });
});
