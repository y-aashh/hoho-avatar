import { test, expect } from '@playwright/test';
import { zipSync } from 'fflate';
import { readFileSync, readdirSync } from 'node:fs';

for (const width of [390, 1440]) {
  test(`reaction controls work with imported art and audio at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('./');
    await page.evaluate(async source => {
      const { Avatar } = await import(source + 'core/Avatar.ts');
      const trigger = Avatar.prototype.triggerReaction;
      Avatar.prototype.triggerReaction = function (name, options) {
        window.lastReactionOptions = options;
        return trigger.call(this, name, options);
      };
    }, '/hoho-avatar/@fs' + process.cwd() + '/src/');
    await page.getByRole('button', { name: /Pixel Bot/ }).click();
    await expect(page.locator('#reactionControls')).toBeEnabled();
    await page.locator('#reactionDuration').fill('1.2');
    await page.getByLabel('Hold duration (seconds)', { exact: true }).fill('2');
    await page.locator('#idleSway').check();
    for (const name of ['Worried', 'Look Up', 'Impressed']) await page.getByRole('button', { name, exact: true }).click();
    expect(await page.evaluate(() => window.lastReactionOptions)).toMatchObject({ duration: 1.2, holdDuration: 2 });
    await page.locator('#sampleAudioButton').click();
    await page.getByRole('button', { name: 'Worried', exact: true }).click();
    await expect(page.locator('#statusText')).toHaveText('AUDIO LIVE');
    await page.locator('#audioStopButton').click();
    await page.getByRole('button', { name: 'Reset Reaction', exact: true }).click();
    const directory = new URL('../public/characters/pixel-bot/', import.meta.url);
    const entries = Object.fromEntries(readdirSync(directory).map(name => [name, new Uint8Array(readFileSync(new URL(name, directory)))]));
    await page.locator('#avatarFile').setInputFiles({ name: 'reactions.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(entries)) });
    await expect(page.locator('#stageLabel')).toHaveText('reactions');
    await expect(page.locator('#reactionControls')).toBeEnabled();
    await page.getByRole('button', { name: 'Worried', exact: true }).click();
    await page.screenshot({ path: `working/reaction-review/studio-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.getByRole('button', { name: /Pixel Bot/ }).click();
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    await expect(page.getByRole('button', { name: 'Worried', exact: true })).toBeEnabled();
  });
}

test('captures deterministic Canvas reaction poses and verifies alpha and smooth mode', async ({ page }) => {
  await page.goto('./');
  const source = '/hoho-avatar/@fs' + process.cwd() + '/src/';
  await page.evaluate(async ({ source }) => {
    const { CanvasRenderer } = await import(source + 'canvas/CanvasRenderer.ts');
    const { ReactionController } = await import(source + 'animation/ReactionController.ts');
    const canvas = document.createElement('canvas'); canvas.id = 'reactionReview';
    canvas.style.cssText = 'width:512px;height:512px;position:relative;background:transparent';
    document.body.replaceChildren(canvas);
    const renderer = new CanvasRenderer(canvas, { character: '/hoho-avatar/characters/pixel-bot/character.json' });
    await renderer.ready;
    window.review = { canvas, renderer, ReactionController };
  }, { source });
  const cases = [
    ['neutral', null, 0, false, false], ['worried-peak', 'worried', 0.4, false, false],
    ['sweat-fall', 'worried', 0.7, false, false], ['look-up', 'look_up', 0.4, false, false],
    ['impressed', 'impressed', 0.4, false, false], ['speaking', 'impressed', 0.4, true, false],
    ['blink', 'worried', 0.4, false, true], ['recovery', 'worried', 1, false, false], ['sway', null, 0, false, false],
  ];
  for (const [label, name, progress, speaking, blink] of cases) {
    const alpha = await page.evaluate(({ label, name, progress, speaking, blink }) => {
      const { canvas, renderer, ReactionController } = window.review;
      const r = new ReactionController({ seed: 42 });
      if (name) r.triggerReaction(name, { duration: 1 });
      const reaction = r.update(progress);
      if (label === 'sway') reaction.idle = { x: 2, y: 1.5, rotation: 1.2 };
      renderer.render({ motion: { timestamp: 0, energy: speaking ? 0.6 : 0, speaking, mouth: speaking ? 'large' : 'closed' }, eyesClosed: blink, state: 'idle', timestamp: progress * 1000, deltaSeconds: 0, reaction });
      return canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3];
    }, { label, name, progress, speaking, blink });
    expect(alpha).toBe(0);
    await page.locator('#reactionReview').screenshot({ path: `working/reaction-review/${label}.png` });
  }
  const smooth = await page.evaluate(async source => {
    const { CanvasRenderer } = await import(source + 'canvas/CanvasRenderer.ts');
    const c = await (await fetch('/hoho-avatar/characters/pixel-bot/character.json')).json();
    for (const group of [c.body, c.eyebrows]) group.src = '/hoho-avatar/characters/pixel-bot/' + group.src;
    for (const group of [c.eyes, c.mouth]) for (const k of Object.keys(group.sprites)) group.sprites[k] = '/hoho-avatar/characters/pixel-bot/' + group.sprites[k];
    delete c.reactions; c.renderStyle = 'smooth'; c.canvas = { width: 1024, height: 1024 };
    const canvas = window.review.canvas;
    const renderer = new CanvasRenderer(canvas, { character: c }); await renderer.ready;
    return { smoothing: canvas.getContext('2d').imageSmoothingEnabled, quality: canvas.getContext('2d').imageSmoothingQuality, css: canvas.style.imageRendering, width: canvas.width };
  }, source);
  expect(smooth).toEqual({ smoothing: true, quality: 'high', css: 'auto', width: 1024 });
});

test('holds the final eyes and sweat pixels for two seconds before recovery', async ({ page }) => {
  await page.goto('./');
  const result = await page.evaluate(async source => {
    const { CanvasRenderer } = await import(source + 'canvas/CanvasRenderer.ts');
    const { ReactionController } = await import(source + 'animation/ReactionController.ts');
    const canvas = document.createElement('canvas'); canvas.id = 'holdReview';
    canvas.style.cssText = 'width:512px;height:512px;display:block;background:transparent';
    document.body.replaceChildren(canvas);
    const renderer = new CanvasRenderer(canvas, { character: '/hoho-avatar/characters/pixel-bot/character.json' });
    await renderer.ready;
    const controller = new ReactionController();
    const draw = delta => {
      const reaction = controller.update(delta);
      renderer.render({ reaction, motion: { timestamp: 0, speaking: false, energy: 0, mouth: 'closed' }, eyesClosed: false, state: 'idle', timestamp: 0, deltaSeconds: delta });
      return { reaction, pixels: canvas.toDataURL() };
    };
    const neutral = draw(0);
    controller.triggerReaction('worried', { duration: 1, holdDuration: 2 });
    const start = draw(0.68), middle = draw(1), last = draw(0.9999);
    const recovering = draw(0.16), end = draw(0.1602);
    window.holdReview = { draw, controller, renderer };
    controller.triggerReaction('worried', { duration: 1, holdDuration: 2 }); draw(0.68);
    return {
      sameThroughoutHold: start.pixels === middle.pixels && middle.pixels === last.pixels,
      differsFromNeutral: start.pixels !== neutral.pixels,
      effect: start.reaction.layers[0].effect,
      recovers: recovering.reaction.weight < last.reaction.weight,
      returnedToNeutral: end.pixels === neutral.pixels,
      ended: end.reaction.layers.length === 0,
    };
  }, '/hoho-avatar/@fs' + process.cwd() + '/src/');
  expect(result).toEqual({ sameThroughoutHold: true, differsFromNeutral: true, effect: { opacity: 1, y: 45 }, recovers: true, returnedToNeutral: true, ended: true });
  await page.locator('#holdReview').screenshot({ path: 'working/reaction-review/hold-final.png' });
  await page.evaluate(() => window.holdReview.renderer.destroy());
});
