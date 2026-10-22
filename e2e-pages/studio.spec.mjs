import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { spritePackage } from '../e2e/character-fixture.mjs';

test('Pages ships only Pixel Bot and no extra model fixtures or 3D chunks', () => {
  const root = 'examples/basic/dist';
  expect(readdirSync(root + '/characters')).toEqual(['pixel-bot']);
  expect(readdirSync(root)).not.toContain('live2d');
  expect(readdirSync(root)).not.toContain('models');
  expect(readdirSync(root + '/assets').filter(name => /three|mochi|niu-lai|portrait/.test(name))).toEqual([]);
});

test('production page loads Pixel Bot and plays audio without extra character requests', async ({ page }) => {
  const errors = [], requests = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  await page.goto('./');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
  await expect(page.locator('.character-choice:visible')).toHaveCount(1);
  await page.locator('[data-mouth="large"]').click();
  await expect(page.locator('[data-mouth="large"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#demoSampleButton').click();
  await expect(page.locator('#statusText')).toHaveText('AUDIO LIVE');
  await page.locator('#audioStopButton').click();
  expect(requests.filter(url => /Wanko|live2dcubismcore|three(?:\.js|\/|\.module)|characters\/(?:niu-lai|pixel-portrait)|models\//.test(url))).toEqual([]);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'tmp/pixel-bot-pages.png', fullPage: true });
});

test('production ZIP import, held reactions and switching back to Pixel Bot work', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await page.locator('#avatarFile').setInputFiles(spritePackage());
  await expect(page.locator('#uploadStatus')).toContainText('my-character loaded locally');
  await page.locator('#reactionHoldDuration').fill('2');
  await page.getByRole('button', { name: 'Worried', exact: true }).click();
  await page.locator('#idleSway').check();
  await page.locator('#blinkPreview').click();
  await page.getByRole('button', { name: 'Reset Reaction', exact: true }).click();
  await page.locator('[data-avatar="pixel-bot"]').click();
  await expect(page.locator('.stage-wrap')).toHaveAttribute('data-loaded', 'true');
  await expect(page.locator('#stageLabel')).toHaveText('Pixel Bot');
  expect(errors).toEqual([]);
});
