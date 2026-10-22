import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PCMAnalyzer } from '../src/audio/PCMAnalyzer';
import { MouthClassifier } from '../src/audio/MouthClassifier';

function sampleWav() {
  const bytes = readFileSync(new URL('../public/audio/sample-voice.wav', import.meta.url));
  let sampleRate = 0, channels = 0, data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (type === 'fmt ') {
      expect(bytes.readUInt16LE(start)).toBe(1);
      expect(bytes.readUInt16LE(start + 14)).toBe(16);
      channels = bytes.readUInt16LE(start + 2); sampleRate = bytes.readUInt32LE(start + 4);
    }
    if (type === 'data') data = bytes.subarray(start, start + length);
    offset = start + length + length % 2;
  }
  if (!data || !sampleRate || !channels) throw new Error('Invalid PCM16 speech fixture');
  const samples = new Float32Array(data.length / 2 / channels);
  for (let i = 0; i < samples.length; i++) {
    for (let c = 0; c < channels; c++) samples[i]! += data.readInt16LE((i * channels + c) * 2) / 32768 / channels;
  }
  return { samples, sampleRate };
}

function classify(samples: Float32Array, sampleRate: number) {
  const classifier = new MouthClassifier();
  return new PCMAnalyzer({ sampleRate }).push(samples, 0).map(features => ({ features, motion: classifier.update(features) }));
}

describe('real WAV speech regression', () => {
  it('uses round selectively instead of treating most voiced speech as puckering', () => {
    const { samples, sampleRate } = sampleWav();
    const frames = classify(samples, sampleRate), speaking = frames.filter(f => f.motion.speaking);
    const rounded = speaking.filter(f => f.motion.mouth === 'round');
    expect(rounded.length).toBeGreaterThan(0);
    expect(rounded.length / speaking.length).toBeLessThan(0.1);
    expect(rounded.every(f => f.features.rms >= 0.036 && f.features.roundnessScore > 0.9)).toBe(true);
    expect(frames.some(f => f.motion.mouth === 'wide')).toBe(true);
    expect(frames.some(f => f.motion.mouth === 'large')).toBe(true);
    expect(frames.some(f => f.motion.mouth === 'closed')).toBe(true);
    expect(speaking.filter(f => f.motion.mouth === 'small').length).toBeGreaterThan(speaking.length / 2);
  });

  it('does not increase rounding when identical speech is processed at twice the sample rate', () => {
    const { samples, sampleRate } = sampleWav();
    const upsampled = new Float32Array(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      upsampled[i * 2] = samples[i]!;
      upsampled[i * 2 + 1] = (samples[i]! + (samples[i + 1] ?? samples[i]!)) / 2;
    }
    const countRound = (frames: ReturnType<typeof classify>) => frames.filter(f => f.motion.mouth === 'round').length;
    expect(countRound(classify(upsampled, sampleRate * 2))).toBe(countRound(classify(samples, sampleRate)));
  });
});
