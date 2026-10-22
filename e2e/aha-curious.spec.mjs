import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const privateArchive = 'working/characters/yash-serious/yash-serious.zip';
const characters = ['pixel-bot', 'mira', 'arthur', 'yash-serious'];
for (const character of characters) {
  test(`${character}: Aha and Curious preserve art, speech, blink and transitions`, async ({ page }) => {
    test.skip(character === 'yash-serious' && !existsSync(privateArchive), 'Private working character is not distributed in CI');
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const privateCharacter = character === 'yash-serious';
    await page.goto(privateCharacter ? './' : './?character=' + character);
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    if (privateCharacter) {
      await page.locator('#avatarFile').setInputFiles(privateArchive);
      await expect(page.locator('#uploadStatus')).toContainText('yash-serious loaded locally');
    }
    // Exercise the same mounted Avatar controls during both audio providers.
    for (const label of ['Aha!', 'Curious']) await expect(page.getByRole('button', { name: label, exact: true })).toBeEnabled();
    await page.locator('#reactionHoldDuration').fill('2');
    await page.locator('#idleSway').check();
    await page.locator('#sampleAudioButton').click();
    await expect(page.locator('#statusText')).toHaveText('AUDIO LIVE');
    for (const label of ['Aha!', 'Curious']) await page.getByRole('button', { name: label, exact: true }).click();
    await page.locator('#audioStopButton').click();
    await page.locator('#tab-mic').click(); await page.locator('#micButton').click();
    await expect(page.locator('#statusText')).toHaveText('MIC LIVE');
    for (const label of ['Curious', 'Aha!']) await page.getByRole('button', { name: label, exact: true }).click();
    await page.locator('#micButton').click();
    const folder = 'tmp/aha-curious-review/' + character;
    mkdirSync(folder, { recursive: true });
    await page.screenshot({ path: folder + '/studio.png', fullPage: true });

    const source = '/hoho-avatar/@fs' + process.cwd() + '/src/';
    const archive = privateCharacter ? Array.from(readFileSync(privateArchive)) : null;
    await page.evaluate(async ({ source, character, archive }) => {
      const { CanvasRenderer } = await import(source + 'canvas/CanvasRenderer.ts');
      const { ReactionController } = await import(source + 'animation/ReactionController.ts');
      let loaded;
      const base = new URL('/hoho-avatar/characters/' + character + '/character.json', location.href).href;
      if (archive) {
        const { loadSpriteCharacterPackage } = await import('/hoho-avatar/characterPackage.ts');
        const bytes = new Uint8Array(archive);
        loaded = await loadSpriteCharacterPackage({ name: 'yash-serious.zip', size: bytes.length, arrayBuffer: async () => bytes.buffer });
      }
      const definition = loaded?.definition ?? await (await fetch(base)).json();
      const canvas = document.createElement('canvas'); canvas.id = 'behaviorReview';
      canvas.style.cssText = 'width:640px;height:640px;display:block;background:transparent';
      document.body.replaceChildren(canvas);
      const renderer = new CanvasRenderer(canvas, { character: loaded ? definition : base }); await renderer.ready;
      window.behaviorReview = { renderer, canvas, ReactionController, definition, base, loaded };
    }, { source, character, archive });

    const cases = [
      ['neutral', null, 0], ['aha-anticipation', 'aha', 0.1], ['aha-realization', 'aha', 0.3],
      ['aha-peak', 'aha', 0.46], ['aha-nod', 'aha', 0.72], ['aha-recovery', 'aha', 0.85], ['aha-end', 'aha', 1],
      ['aha-speech', 'aha', 0.46, true], ['aha-blink', 'aha', 0.46, false, true], ['aha-to-curious', 'aha', 0.46, false, false, 'curious'],
      ['curious-notice', 'curious', 0.2], ['curious-peak', 'curious', 0.5], ['curious-hold', 'curious', 0.65],
      ['curious-recovery', 'curious', 0.9], ['curious-end', 'curious', 1],
      ['curious-speech', 'curious', 0.55, true], ['curious-blink', 'curious', 0.55, false, true],
      ['curious-to-aha', 'curious', 0.55, false, false, 'aha'],
    ];
    const results = [];
    for (const [label, name, progress, speaking = false, blink = false, next] of cases) {
      const result = await page.evaluate(({ name, progress, speaking, blink, next }) => {
        const { canvas, renderer, ReactionController, definition: d, base } = window.behaviorReview;
        const c = new ReactionController({ seed: 42 });
        const duration = name === 'curious' ? 1.8 : 1;
        if (name) c.triggerReaction(name);
        let reaction = c.update(progress * duration);
        const frame = () => ({ reaction, motion: { timestamp: 0, speaking, energy: speaking ? 0.5 : 0, mouth: speaking ? 'large' : 'closed' },
          eyesClosed: blink, state: speaking ? 'speaking' : 'idle', timestamp: 0, deltaSeconds: 0 });
        const ctx = canvas.getContext('2d');
        renderer.render(frame()); const before = canvas.toDataURL();
        let continuous = true;
        if (next) {
          c.triggerReaction(next); reaction = c.update(0); renderer.render(frame());
          continuous = before === canvas.toDataURL();
          reaction = c.update(0.1);
        }
        const drawImage = ctx.drawImage, draws = [];
        ctx.drawImage = function (image, ...args) {
          if (image instanceof HTMLImageElement) draws.push({ src: image.src, alpha: this.globalAlpha });
          return drawImage.call(this, image, ...args);
        };
        renderer.render(frame()); ctx.drawImage = drawImage;
        const png = canvas.toDataURL(); renderer.render(frame());
        const url = path => path ? new URL(path, base).href : null;
        const features = group => [group === 'eyebrows' ? d.eyebrows?.src : null,
          ...Object.values(d[group]?.sprites ?? {}), ...Object.values(d.reactions ?? {}).map(r => r[group])].filter(Boolean).map(url);
        const eyes = draws.filter(draw => features('eyes').includes(draw.src));
        const brows = draws.filter(draw => features('eyebrows').includes(draw.src));
        const mouths = draws.filter(draw => features('mouth').includes(draw.src));
        const peakAha = name === 'aha' && progress === 0.46 && !next;
        const peakCurious = name === 'curious' && progress >= 0.45 && progress <= 0.75 && !next;
        return { png, reaction, eyes, brows, mouths, continuous, repeatStable: png === canvas.toDataURL(),
          expectedEye: url(blink ? d.eyes.sprites.closed : peakAha ? d.reactions?.impressed?.eyes ?? d.eyes.sprites.open
            : peakCurious ? d.reactions?.curious?.eyes ?? d.reactions?.look_up?.eyes ?? d.reactions?.impressed?.eyes ?? d.eyes.sprites.open : d.eyes.sprites.open),
          expectedBrow: url(peakCurious ? d.reactions?.curious?.eyebrows ?? d.reactions?.impressed?.eyebrows ?? d.eyebrows.src
            : peakAha ? d.reactions?.impressed?.eyebrows ?? d.eyebrows.src : d.eyebrows.src),
          expectedMouth: url(speaking ? d.mouth.sprites.large : peakAha ? d.reactions?.impressed?.mouth ?? d.mouth.sprites.closed : d.mouth.sprites.closed),
          transform: Array.from(ctx.getTransform().toFloat64Array()), smoothing: ctx.imageSmoothingEnabled,
          cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3] };
      }, { name, progress, speaking, blink, next });
      expect(result.eyes).toHaveLength(1); expect(result.brows).toHaveLength(1); expect(result.mouths).toHaveLength(1);
      expect(result.eyes[0].alpha).toBe(1); expect(result.brows[0].alpha).toBe(1);
      expect(result.repeatStable).toBe(true); expect(result.continuous).toBe(true);
      expect(result.cornerAlpha).toBe(0); expect(result.smoothing).toBe(character !== 'pixel-bot');
      expect(result.transform).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      if (blink || label.endsWith('peak')) expect(result.eyes[0].src).toBe(result.expectedEye);
      if (label.endsWith('peak')) expect(result.brows[0].src).toBe(result.expectedBrow);
      if (speaking || label.endsWith('peak')) expect(result.mouths[0].src).toBe(result.expectedMouth);
      writeFileSync(folder + '/' + label + '.png', Buffer.from(result.png.split(',')[1], 'base64'));
      delete result.png; results.push({ label, ...result });
    }
    const neutral = readFileSync(folder + '/neutral.png');
    expect(readFileSync(folder + '/aha-end.png').equals(neutral)).toBe(true);
    expect(readFileSync(folder + '/curious-end.png').equals(neutral)).toBe(true);
    writeFileSync(folder + '/frames.json', JSON.stringify(results, null, 2));
    await page.evaluate(() => { window.behaviorReview.renderer.destroy(); window.behaviorReview.loaded?.dispose(); });
    expect(errors).toEqual([]);
  });
}
