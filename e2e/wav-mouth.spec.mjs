import { test, expect } from '@playwright/test';

test('WAV playback uses occasional rounding and returns to a closed mouth', async ({ page }) => {
  await page.goto('./');
  const source = '/hoho-avatar/@fs' + process.cwd() + '/src/';
  await page.evaluate(async source => {
    const { createAvatar } = await import(source + 'index.ts');
    const { canvasRenderer } = await import(source + 'canvas/index.ts');
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:400px;height:400px';
    const button = document.createElement('button'); button.id = 'playWavTest'; button.textContent = 'Play speech fixture';
    document.body.append(canvas, button);
    window.wavFrames = []; window.wavFinished = false;
    const avatar = await createAvatar(canvas, {
      renderer: canvasRenderer({ character: '/hoho-avatar/characters/pixel-bot/character.json' }),
      onMotion: frame => { window.wavFrames.push({ ...frame }); },
    });
    window.wavAvatar = avatar;
    button.onclick = async () => {
      window.wavMetadata = await avatar.playAudio('/hoho-avatar/audio/sample-voice.wav');
      const check = () => {
        if (!avatar.audioActive) window.wavFinished = true;
        else setTimeout(check, 20);
      };
      check();
    };
  }, source);
  await page.locator('#playWavTest').click();
  await page.waitForFunction(() => window.wavFinished);
  const result = await page.evaluate(() => {
    const frames = window.wavFrames;
    const speaking = frames.filter(f => f.speaking);
    const counts = Object.fromEntries(['closed', 'small', 'large', 'wide', 'round'].map(state => [state, frames.filter(f => f.mouth === state).length]));
    return { counts, ratio: counts.round / speaking.length, last: window.wavAvatar.getMotionFrame(), rate: window.wavMetadata.sampleRate };
  });
  expect(result.counts.round).toBeGreaterThan(0);
  expect(result.ratio).toBeLessThan(0.1);
  expect(result.counts.small).toBeGreaterThan(result.counts.round * 4);
  expect(result.counts.large).toBeGreaterThan(0);
  expect(result.counts.wide).toBeGreaterThan(0);
  expect(result.last).toMatchObject({ speaking: false, energy: 0, mouth: 'closed' });
  await page.evaluate(() => window.wavAvatar.destroy());
});
