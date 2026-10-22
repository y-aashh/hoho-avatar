import { test, expect } from '@playwright/test';
import { spritePackage } from './character-fixture.mjs';

async function choose(page, character) {
  await page.locator('[data-avatar="' + character + '"]').click();
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await expect(page.locator('[data-avatar="' + character + '"]')).toBeEnabled();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.testTracks = []; window.testContexts = [];
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => { const stream = await capture(options); window.testTracks.push(...stream.getTracks()); return stream; };
    const Context = AudioContext;
    window.AudioContext = class extends Context { constructor(...args) { super(...args); window.testContexts.push(this); } };
  });
});
test('Pixel Bot remains the default alongside Mira, including removed character links', async ({ page }) => {
  const requests = []; page.on('request', request => requests.push(request.url()));
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const id of ['', 'niu-lai', 'pixel-portrait', 'mochi', 'live2d']) {
    await page.goto(id ? './?character=' + id : './');
    await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
    await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
    await expect(page.locator('.character-choice:visible')).toHaveCount(2);
    await expect(page.locator('[data-avatar="pixel-bot"]')).toHaveAttribute('aria-pressed', 'true');
  }
  expect(requests.filter(url => /characters\/(?:niu-lai|pixel-portrait)|models\/|three(?:\.js|\/|\.module)|Wanko|live2dcubismcore/.test(url))).toEqual([]);
  for (const mouth of ['closed', 'small', 'large', 'wide', 'round']) {
    await page.locator('[data-mouth="' + mouth + '"]').click();
    await expect(page.locator('[data-mouth="' + mouth + '"]')).toHaveAttribute('aria-pressed', 'true');
  }
  await page.locator('#blinkPreview').click();
  await expect(page.locator('#resetView')).toBeHidden();
  expect(errors).toEqual([]);
});

test('changing audio providers and replaying a sample preserves character assets and canvas', async ({ page }) => {
  const bodies = [];
  page.on('request', request => { if (request.url().endsWith('/characters/pixel-bot/body.png')) bodies.push(request.url()); });
  await page.goto('./');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await page.evaluate(() => { window.firstCanvas = document.querySelector('#avatar'); });
  for (const provider of ['file', 'tts', 'mic', 'file']) await page.locator('#tab-' + provider).click();
  for (let i = 0; i < 2; i++) {
    await page.locator('#sampleAudioButton').click();
    await expect(page.locator('#statusText')).toHaveText('AUDIO LIVE');
    await page.locator('#audioStopButton').click();
  }
  expect(bodies).toHaveLength(1);
  expect(await page.evaluate(() => document.querySelector('#avatar') === window.firstCanvas)).toBe(true);
});

test('microphone and file playback survive switching between imported sprites and Pixel Bot', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await page.locator('#tab-mic').click();
  await page.locator('#micButton').click();
  await expect(page.locator('#statusText')).toHaveText('MIC LIVE');
  await page.locator('#avatarFile').setInputFiles(spritePackage());
  await expect(page.locator('#uploadStatus')).toContainText('my-character loaded locally');
  await expect(page.locator('#statusText')).toHaveText('MIC LIVE');
  await choose(page, 'pixel-bot');
  expect(await page.evaluate(() => window.testTracks.filter(track => track.readyState === 'live').length)).toBe(1);
  await page.locator('#micButton').click();
  await expect.poll(() => page.evaluate(() => window.testTracks.every(track => track.readyState === 'ended'))).toBe(true);
  await choose(page, 'custom');
  await page.locator('#demoSampleButton').click();
  await expect(page.locator('#statusText')).toHaveText('AUDIO LIVE');
  await choose(page, 'pixel-bot');
  await expect(page.locator('#statusText')).toHaveText('AUDIO LIVE');
  await page.locator('#audioStopButton').click();
  await expect(page.locator('#mouthState')).toHaveText('CLOSED');
  await page.locator('#tab-mic').click();
  await expect.poll(() => page.evaluate(() => window.testContexts.every(context => context.state === 'closed'))).toBe(true);
});

test('unsupported files and invalid sprite art preserve or restore the current character', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await page.locator('#avatarFile').setInputFiles({ name: 'broken.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('bad') });
  await expect(page.locator('#uploadStatus')).toContainText('Choose a .zip character package.');
  await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
  await page.locator('#avatarFile').setInputFiles(spritePackage('broken', { brokenBody: true }));
  await expect(page.locator('#uploadStatus')).toHaveClass(/error/);
  await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await page.locator('#avatarFile').setInputFiles(spritePackage());
  await expect(page.locator('#uploadStatus')).toContainText('my-character loaded locally');
  await page.locator('#avatarFile').setInputFiles(spritePackage('broken-again', { brokenBody: true }));
  await expect(page.locator('#uploadStatus')).toHaveClass(/error/);
  await expect(page.locator('#stageLabel')).toHaveText('my-character');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await choose(page, 'pixel-bot');
  await expect(page.locator('#avatar')).toHaveCount(1);
  await expect(page.locator('#uploadButton')).toBeEnabled();
});

test('imported sprites remain visible with voice controls on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.locator('#avatarFile').setInputFiles(spritePackage());
  await expect(page.locator('#uploadStatus')).toContainText('my-character loaded locally');
  await page.locator('#tab-mic').click();
  await page.locator('#micButton').scrollIntoViewIfNeeded();
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth, viewport: innerWidth,
    canvas: document.querySelector('#avatar').getBoundingClientRect().toJSON(),
    button: document.querySelector('#micButton').getBoundingClientRect().toJSON(),
  }));
  expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  expect(layout.canvas.top).toBeGreaterThanOrEqual(0);
  expect(layout.canvas.bottom).toBeLessThanOrEqual(layout.button.top);
});
