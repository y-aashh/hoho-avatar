import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const width of [390, 1440]) {
  test('Mira speaks, reacts and switches without disturbing Pixel Bot at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [], failedAssets = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/characters/') && response.status() >= 400) failedAssets.push(response.url()); });
    await page.goto('./');
    await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    await page.getByRole('button', { name: 'Mira Curiosity & charm' }).click();
    await expect(page.locator('#stageLabel')).toHaveText('Mira');
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    await expect(page.locator('#ttsText')).toHaveValue("Hey, I'm Mira! What's sparked your curiosity today?");
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
    await page.screenshot({ path: 'tmp/mira-generation/review/studio-' + width + '.png', fullPage: true });
    await page.locator('#avatarFile').setInputFiles({ name: 'mira.zip', mimeType: 'application/zip',
      buffer: readFileSync('public/characters/mira/mira.zip') });
    await expect(page.locator('#uploadStatus')).toContainText('mira loaded locally');
    await expect(page.locator('#reactionControls')).toBeEnabled();
    await page.getByRole('button', { name: /Pixel Bot/ }).click();
    await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    expect(await page.locator('#avatar').evaluate(c => c.getContext('2d').imageSmoothingEnabled)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]); expect(failedAssets).toEqual([]);
  });
}

test('Mira Canvas composites preserve alpha, one facial layer per feature and speech priority', async ({ page }) => {
  await page.goto('./?character=mira');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await expect(page.locator('#stageLabel')).toHaveText('Mira');
  const source = '/hoho-avatar/@fs' + process.cwd() + '/src/';
  await page.evaluate(async source => {
    const { CanvasRenderer } = await import(source + 'canvas/CanvasRenderer.ts');
    const { ReactionController } = await import(source + 'animation/ReactionController.ts');
    const canvas = document.createElement('canvas'); canvas.id = 'miraReview';
    canvas.style.cssText = 'width:700px;height:700px;display:block;background:transparent';
    document.body.replaceChildren(canvas);
    const renderer = new CanvasRenderer(canvas, { character: '/hoho-avatar/characters/mira/character.json' });
    await renderer.ready;
    window.miraReview = { renderer, canvas, ReactionController };
  }, source);
  const cases = [
    ['neutral', null, 0], ['worried', 'worried', 0.4], ['sweat-fall', 'worried', 0.7],
    ['look-up', 'look_up', 0.4], ['impressed', 'impressed', 0.4],
    ['speaking', 'impressed', 0.4, true], ['blink', 'worried', 0.4, false, true],
    ['entry', 'worried', 0.11], ['recovery-mid', 'worried', 0.84],
    ['recovery', 'worried', 1], ['hold', 'worried', 1.68], ['sway', null, 0],
  ];
  for (const [label, name, progress, speaking = false, blink = false] of cases) {
    const result = await page.evaluate(({ label, name, progress, speaking, blink }) => {
      const { renderer, canvas, ReactionController } = window.miraReview;
      const controller = new ReactionController({ seed: 42 });
      if (name) controller.triggerReaction(name, { duration: 1, holdDuration: label === 'hold' ? 2 : 0 });
      const reaction = controller.update(progress);
      if (label === 'sway') reaction.idle = { x: 2, y: 1.5, rotation: 1.2 };
      const ctx = canvas.getContext('2d'), drawImage = ctx.drawImage, draws = [];
      ctx.drawImage = function (image, ...args) {
        if (image instanceof HTMLImageElement) draws.push({ src: image.src.split('/').at(-1), alpha: this.globalAlpha });
        return drawImage.call(this, image, ...args);
      };
      renderer.render({ motion: { timestamp: 0, energy: speaking ? 0.5 : 0, speaking, mouth: speaking ? 'large' : 'closed' },
        reaction, eyesClosed: blink, state: speaking ? 'speaking' : 'idle', timestamp: 0, deltaSeconds: 0 });
      ctx.drawImage = drawImage;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let partial = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0 && pixels[i] < 255) partial++;
      return { eyes: draws.filter(d => d.src.startsWith('eyes-')), brows: draws.filter(d => d.src.startsWith('eyebrows')),
        mouths: draws.filter(d => d.src.startsWith('mouth-')), cornerAlpha: pixels[3], partial };
    }, { label, name, progress, speaking, blink });
    expect(result.eyes).toHaveLength(1); expect(result.brows).toHaveLength(1); expect(result.mouths).toHaveLength(1);
    expect(result.eyes[0].alpha).toBe(1); expect(result.brows[0].alpha).toBe(1);
    expect(result.cornerAlpha).toBe(0); expect(result.partial).toBeGreaterThan(0);
    if (speaking) expect(result.mouths[0].src).toBe('mouth-large.png');
    if (blink) expect(result.eyes[0].src).toBe('eyes-closed.png');
    await page.locator('#miraReview').screenshot({ path: 'tmp/mira-generation/review/browser-' + label + '.png' });
  }
  await page.evaluate(() => window.miraReview.renderer.destroy());
});

test('Mira impressed brows change expression without repainting surrounding hair', async ({ page }) => {
  await page.goto('./?character=mira');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  const result = await page.evaluate(async source => {
    const { CanvasRenderer } = await import(source + 'canvas/CanvasRenderer.ts');
    const { ReactionController } = await import(source + 'animation/ReactionController.ts');
    const canvas = document.createElement('canvas');
    const renderer = new CanvasRenderer(canvas, { character: '/hoho-avatar/characters/mira/character.json' });
    await renderer.ready;
    const frame = { motion: { timestamp: 0, energy: 0, speaking: false, mouth: 'wide' },
      eyesClosed: false, state: 'idle', timestamp: 0, deltaSeconds: 0 };
    renderer.render(frame);
    const ctx = canvas.getContext('2d');
    const neutral = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const controller = new ReactionController();
    controller.triggerReaction('impressed', { duration: 1 });
    const reaction = controller.update(0.4);
    // Compare art in the same coordinates, independently of the intentional nod.
    reaction.position = { x: 0, y: 0 }; reaction.rotation = 0;
    reaction.idle = { x: 0, y: 0, rotation: 0 };
    renderer.render({ ...frame, reaction });
    const impressed = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let changedBrows = 0, changedSurroundings = 0;
    for (let i = 0; i < impressed.length; i += 4) {
      if (impressed[i] === neutral[i] && impressed[i + 1] === neutral[i + 1]
        && impressed[i + 2] === neutral[i + 2] && impressed[i + 3] === neutral[i + 3]) continue;
      const x = i / 4 % canvas.width, y = Math.floor(i / 4 / canvas.width);
      const brow = x >= 560 && x <= 695 && y >= 340 && y <= 420
        || x >= 695 && x <= 795 && y >= 320 && y <= 400;
      if (brow) changedBrows++; else changedSurroundings++;
    }
    renderer.destroy();
    return { changedBrows, changedSurroundings };
  }, '/hoho-avatar/@fs' + process.cwd() + '/src/');
  expect(result.changedBrows).toBeGreaterThan(0);
  expect(result.changedSurroundings).toBe(0);
});
