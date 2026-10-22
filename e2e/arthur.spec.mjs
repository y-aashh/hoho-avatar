import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

for (const width of [390, 1440]) {
  test('Arthur speaks, reacts and switches without disturbing Pixel Bot at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [], failedAssets = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/characters/') && response.status() >= 400) failedAssets.push(response.url()); });
    await page.goto('./');
    await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    await page.getByRole('button', { name: 'Arthur Stories & wit' }).click();
    await expect(page.locator('#stageLabel')).toHaveText('Arthur');
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    await expect(page.locator('#ttsText')).toHaveValue("Hello, I'm Arthur. Shall we explore something fascinating?");
    const canvas = await page.locator('#avatar').evaluate(c => ({
      width: c.width, height: c.height, smoothing: c.getContext('2d').imageSmoothingEnabled,
      quality: c.getContext('2d').imageSmoothingQuality, css: c.style.imageRendering,
    }));
    expect(canvas).toEqual({ width: 1400, height: 1400, smoothing: true, quality: 'high', css: 'auto' });
    await page.locator('#reactionHoldDuration').fill('2');
    await page.locator('#idleSway').check();
    for (const name of ['Worried', 'Look Up', 'Impressed']) await page.getByRole('button', { name, exact: true }).click();
    await page.locator('#blinkPreview').click();
    await page.locator('#demoSampleButton').click();
    await expect(page.locator('#statusText')).toHaveText('AUDIO LIVE');
    await page.getByRole('button', { name: 'Worried', exact: true }).click();
    await page.locator('#audioStopButton').click();
    await page.getByRole('button', { name: 'Reset Reaction', exact: true }).click();
    await page.screenshot({ path: 'tmp/arthur-generation/review/studio-' + width + '.png', fullPage: true });
    await page.locator('#avatarFile').setInputFiles({ name: 'arthur.zip', mimeType: 'application/zip',
      buffer: readFileSync('public/characters/arthur/arthur.zip') });
    await expect(page.locator('#uploadStatus')).toContainText('arthur loaded locally');
    await expect(page.locator('#reactionControls')).toBeEnabled();
    await page.getByRole('button', { name: /Pixel Bot/ }).click();
    await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    expect(await page.locator('#avatar').evaluate(c => c.getContext('2d').imageSmoothingEnabled)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]); expect(failedAssets).toEqual([]);
  });
}

test('Arthur Canvas composites preserve alpha, one facial layer per feature and speech priority', async ({ page }) => {
  await page.goto('./?character=arthur');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await expect(page.locator('#stageLabel')).toHaveText('Arthur');
  const source = '/hoho-avatar/@fs' + process.cwd() + '/src/';
  await page.evaluate(async source => {
    const { CanvasRenderer } = await import(source + 'canvas/CanvasRenderer.ts');
    const { ReactionController } = await import(source + 'animation/ReactionController.ts');
    const canvas = document.createElement('canvas'); canvas.id = 'arthurReview';
    canvas.style.cssText = 'width:700px;height:700px;display:block;background:transparent';
    document.body.replaceChildren(canvas);
    const renderer = new CanvasRenderer(canvas, { character: '/hoho-avatar/characters/arthur/character.json' });
    await renderer.ready;
    window.arthurReview = { renderer, canvas, ReactionController };
  }, source);
  const cases = [
    ['neutral', null, 0], ['worried', 'worried', 0.4], ['sweat-fall', 'worried', 0.7],
    ['look-up', 'look_up', 0.4], ['impressed', 'impressed', 0.4],
    ['speaking', 'impressed', 0.4, true], ['blink', 'worried', 0.4, false, true],
    ['entry', 'worried', 0.11], ['recovery-mid', 'worried', 0.84],
    ['recovery', 'worried', 1], ['hold', 'worried', 1.68], ['sway', null, 0],
  ];
  let sweatStartY;
  for (const [label, name, progress, speaking = false, blink = false] of cases) {
    const result = await page.evaluate(({ label, name, progress, speaking, blink }) => {
      const { renderer, canvas, ReactionController } = window.arthurReview;
      const controller = new ReactionController({ seed: 42 });
      if (name) controller.triggerReaction(name, { duration: 1, holdDuration: label === 'hold' ? 2 : 0 });
      const reaction = controller.update(progress);
      if (label === 'sway') reaction.idle = { x: 2, y: 1.5, rotation: 1.2 };
      const ctx = canvas.getContext('2d'), drawImage = ctx.drawImage, draws = [];
      ctx.drawImage = function (image, ...args) {
        if (image instanceof HTMLImageElement) draws.push({ src: image.src.split('/').at(-1), alpha: this.globalAlpha, args });
        return drawImage.call(this, image, ...args);
      };
      renderer.render({ motion: { timestamp: 0, energy: speaking ? 0.5 : 0, speaking, mouth: speaking ? 'large' : 'closed' },
        reaction, eyesClosed: blink, state: speaking ? 'speaking' : 'idle', timestamp: 0, deltaSeconds: 0 });
      ctx.drawImage = drawImage;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let partial = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0 && pixels[i] < 255) partial++;
      return { eyes: draws.filter(d => d.src.startsWith('eyes-')), brows: draws.filter(d => d.src.startsWith('eyebrows')),
        mouths: draws.filter(d => d.src.startsWith('mouth-')),
        sweat: draws.find(d => d.src === 'sweat-drop.png'), cornerAlpha: pixels[3], partial };
    }, { label, name, progress, speaking, blink });
    expect(result.eyes).toHaveLength(1); expect(result.brows).toHaveLength(1); expect(result.mouths).toHaveLength(1);
    expect(result.eyes[0].alpha).toBe(1); expect(result.brows[0].alpha).toBe(1);
    expect(result.cornerAlpha).toBe(0); expect(result.partial).toBeGreaterThan(0);
    if (speaking) expect(result.mouths[0].src).toBe('mouth-large.png');
    if (blink) expect(result.eyes[0].src).toBe('eyes-closed.png');
    if (label === 'worried' || label === 'sweat-fall' || label === 'hold') {
      expect(result.sweat.alpha).toBeGreaterThan(0);
      expect(result.sweat.args[2]).toBe(27);
      expect(result.sweat.args[3]).toBeGreaterThanOrEqual(54);
      if (label === 'worried') sweatStartY = result.sweat.args[1];
      if (label === 'sweat-fall') expect(result.sweat.args[1]).toBeGreaterThan(sweatStartY);
    }
    await page.locator('#arthurReview').screenshot({ path: 'tmp/arthur-generation/review/browser-' + label + '.png' });
  }
  await page.evaluate(() => window.arthurReview.renderer.destroy());
});

test('mounted Arthur automatically blinks while idle sway continues', async ({ page }) => {
  await page.addInitScript(() => {
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    window.arthurLiveFrames = { blinks: 0, firstTransform: null, moving: false, blinkPNG: null };
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      const result = drawImage.call(this, image, ...args);
      if (!(image instanceof HTMLImageElement) || !image.src.includes('/characters/arthur/')) return result;
      const frames = window.arthurLiveFrames;
      if (image.src.endsWith('/body.png')) {
        const transform = JSON.stringify(this.getTransform());
        if (frames.firstTransform === null) frames.firstTransform = transform;
        else if (transform !== frames.firstTransform) frames.moving = true;
      }
      if (image.src.endsWith('/eyes-closed.png')) {
        frames.blinks++;
        if (!frames.blinkPNG) queueMicrotask(() => { frames.blinkPNG = this.canvas.toDataURL('image/png'); });
      }
      return result;
    };
  });
  await page.goto('./?character=arthur');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await page.locator('#idleSway').check();
  await page.waitForFunction(() => window.arthurLiveFrames.blinkPNG && window.arthurLiveFrames.moving, null, { timeout: 8000 });
  const data = await page.evaluate(() => window.arthurLiveFrames.blinkPNG);
  writeFileSync('tmp/arthur-generation/review/browser-automatic-blink.png', Buffer.from(data.split(',')[1], 'base64'));
});

test('Arthur keeps glasses rims, hair and beard registered across facial changes', async ({ page }) => {
  await page.goto('./?character=arthur');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  const source = '/hoho-avatar/@fs' + process.cwd() + '/src/';
  const results = await page.evaluate(async source => {
    const { CanvasRenderer } = await import(source + 'canvas/CanvasRenderer.ts');
    const { ReactionController } = await import(source + 'animation/ReactionController.ts');
    const canvas = document.createElement('canvas');
    const renderer = new CanvasRenderer(canvas, { character: '/hoho-avatar/characters/arthur/character.json' });
    await renderer.ready;
    const context = canvas.getContext('2d');
    const capture = (name, blink = false) => {
      const controller = new ReactionController({ seed: 42 });
      if (name) controller.triggerReaction(name);
      const reaction = controller.update(0.5);
      reaction.rotation = 0; reaction.position = { x: 0, y: 0 };
      reaction.idle = { x: 0, y: 0, rotation: 0 };
      // Isolate facial registration from intended body movement and foreground sweat.
      for (const layer of reaction.layers) layer.effect.opacity = 0;
      renderer.render({ motion: { timestamp: 0, energy: 0, speaking: true, mouth: 'closed' },
        reaction, eyesClosed: blink, state: 'speaking', timestamp: 0, deltaSeconds: 0 });
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const neutral = capture(null);
    const boxes = [[460, 415, 805, 525], [455, 335, 805, 445], [500, 620, 775, 745]];
    const rims = [[435, 442, 460, 505], [480, 425, 580, 435], [610, 436, 652, 452],
      [680, 407, 780, 416], [480, 539, 565, 546], [699, 520, 755, 528]];
    const inside = (box, x, y) => x >= box[0] && x < box[2] && y >= box[1] && y < box[3];
    const results = [];
    for (const name of ['worried', 'look_up', 'impressed', 'blink']) {
      const pixels = capture(name === 'blink' ? null : name, name === 'blink');
      let surroundingChanges = 0, rimChanges = 0, facialChanges = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (pixels[i] === neutral[i] && pixels[i + 1] === neutral[i + 1] &&
            pixels[i + 2] === neutral[i + 2] && pixels[i + 3] === neutral[i + 3]) continue;
        const sx = x - 73, sy = y - 50;
        if (!boxes.some(box => inside(box, sx, sy))) surroundingChanges++;
        if (rims.some(box => inside(box, sx, sy))) rimChanges++;
        facialChanges++;
      }
      results.push({ name, surroundingChanges, rimChanges, facialChanges });
    }
    renderer.destroy();
    return results;
  }, source);
  for (const result of results) {
    expect(result.surroundingChanges, result.name + ' surrounding artwork').toBe(0);
    expect(result.rimChanges, result.name + ' glasses').toBe(0);
    expect(result.facialChanges, result.name + ' animated features').toBeGreaterThan(0);
  }
});

