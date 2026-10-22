import { describe, expect, it } from "vitest";
import { MouthClassifier } from "../src/audio/MouthClassifier";
import type { AudioFeatures } from "../src/core/types";

const features = (timestamp: number, rms: number, estimatedFrequencyHz = 1000, roundnessScore = 0.5): AudioFeatures => ({ timestamp, rms, peak: rms, zeroCrossingRate: 0.05, estimatedFrequencyHz, roundnessScore });

describe("MouthClassifier", () => {
  it("classifies loud input as large", () => {
    const classifier = new MouthClassifier({ minStateDurationMs: 0 });
    expect(classifier.update(features(100, 0.4)).mouth).toBe("large");
  });

  it("closes after the silence delay", () => {
    const classifier = new MouthClassifier({ minStateDurationMs: 0, silenceDelayMs: 80 });
    expect(classifier.update(features(0, 0.1)).mouth).toBe("small");
    expect(classifier.update(features(20, 0)).mouth).toBe("small");
    expect(classifier.update(features(101, 0)).mouth).toBe("closed");
  });

  it("holds rapid changes for the minimum duration", () => {
    const classifier = new MouthClassifier({ minStateDurationMs: 50 });
    expect(classifier.update(features(0, 0.1)).mouth).toBe("small");
    expect(classifier.update(features(20, 0.4)).mouth).toBe("small");
    expect(classifier.update(features(60, 0.4)).mouth).toBe("large");
  });

  it("resets immediately to a closed mouth", () => {
    const classifier = new MouthClassifier({ minStateDurationMs: 0 });
    expect(classifier.update(features(0, 0.4)).mouth).toBe("large");
    expect(classifier.reset(10)).toEqual({ timestamp: 10, speaking: false, energy: 0, mouth: "closed" });
  });

  it('does not interpret ordinary low-frequency speech as a rounded vowel', () => {
    const classifier = new MouthClassifier();
    for (const time of [0, 30, 60, 90, 120]) {
      expect(classifier.update(features(time, 0.1, 800, 0.82)).mouth).toBe('small');
    }
  });

  it('requires a sustained strong cue and releases rounding without the silence hold', () => {
    const classifier = new MouthClassifier();
    expect(classifier.update(features(0, 0.08, 250, 0.94)).mouth).toBe('small');
    expect(classifier.update(features(30, 0.08, 250, 0.94)).mouth).toBe('small');
    expect(classifier.update(features(60, 0.08, 250, 0.94)).mouth).toBe('round');
    expect(classifier.update(features(90, 0)).mouth).toBe('small');
    expect(classifier.update(features(180, 0)).mouth).toBe('closed');
  });

  it('ignores quiet low-frequency tails and interrupted round candidates', () => {
    const classifier = new MouthClassifier();
    for (const time of [0, 30, 60, 90]) expect(classifier.update(features(time, 0.025, 250, 0.94)).mouth).toBe('small');
    classifier.update(features(120, 0.08, 250, 0.94));
    classifier.update(features(150, 0.08, 250, 0.94));
    classifier.update(features(180, 0.08));
    expect(classifier.update(features(210, 0.08, 250, 0.94)).mouth).toBe('small');
    expect(classifier.update(features(240, 0.08, 250, 0.94)).mouth).toBe('small');
  });

  it('keeps loud/wide priority and clears rounding evidence on reset', () => {
    const classifier = new MouthClassifier({ minStateDurationMs: 0 });
    classifier.update(features(0, 0.08, 250, 0.94));
    classifier.update(features(30, 0.08, 250, 0.94));
    expect(classifier.update(features(60, 0.3, 250, 0.94)).mouth).toBe('large');
    expect(classifier.update(features(90, 0.08, 3500, 0.94)).mouth).toBe('wide');
    classifier.reset(100);
    expect(classifier.update(features(120, 0.08, 250, 0.94)).mouth).toBe('small');
    expect(classifier.update(features(150, 0.08, 250, 0.94)).mouth).toBe('small');
  });

  it('permits explicit round tuning and validates new numeric settings', () => {
    const classifier = new MouthClassifier({ roundThreshold: 0.8, roundMinDurationMs: 0, roundMinRms: 0.02 });
    expect(classifier.update(features(0, 0.03, 600, 0.85)).mouth).toBe('round');
    for (const value of [NaN, Infinity, -1]) {
      expect(() => new MouthClassifier({ roundMinDurationMs: value })).toThrow('roundMinDurationMs');
      expect(() => new MouthClassifier({ roundMinRms: value })).toThrow('roundMinRms');
    }
  });
});
