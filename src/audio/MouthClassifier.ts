import type { AudioFeatures, MotionFrame } from "../core/types";
import { MouthState } from '../core/MouthState';

export interface MouthClassifierOptions {
  silenceThreshold?: number;
  loudThreshold?: number;
  highFrequencyThreshold?: number;
  roundThreshold?: number;
  /** Continuous round-candidate confirmation before entering the pose. */
  roundMinDurationMs?: number;
  /** Avoid puckering on quiet tails/noise. Linear RMS, not decibels. */
  roundMinRms?: number;
  minStateDurationMs?: number;
  silenceDelayMs?: number;
}

export class MouthClassifier {
  private readonly options: Required<MouthClassifierOptions>;
  private current: MouthState = MouthState.Closed;
  private lastChange = -Infinity;
  private silenceSince: number | null = null;
  private roundSince: number | null = null;

  constructor(options: MouthClassifierOptions = {}) {
    this.options = {
      silenceThreshold: options.silenceThreshold ?? 0.018,
      loudThreshold: options.loudThreshold ?? 0.16,
      highFrequencyThreshold: options.highFrequencyThreshold ?? 2800,
      roundThreshold: options.roundThreshold ?? 0.9,
      roundMinDurationMs: options.roundMinDurationMs ?? 60,
      roundMinRms: options.roundMinRms ?? 0.036,
      minStateDurationMs: options.minStateDurationMs ?? 50,
      silenceDelayMs: options.silenceDelayMs ?? 80,
    };
    for (const key of ['roundMinDurationMs', 'roundMinRms'] as const) {
      if (!Number.isFinite(this.options[key]) || this.options[key] < 0) throw new Error(`${key} must be non-negative and finite`);
    }
  }

  update(features: AudioFeatures): MotionFrame {
    const { timestamp, rms } = features;
    let next = this.rawState(features);

    if (next === MouthState.Closed) {
      this.silenceSince ??= timestamp;
      if (timestamp - this.silenceSince < this.options.silenceDelayMs) {
        next = this.current === MouthState.Round ? MouthState.Small : this.current;
      }
    } else {
      this.silenceSince = null;
    }

    const releaseRound = this.current === MouthState.Round && next !== MouthState.Round;
    if (next !== this.current && (releaseRound || timestamp - this.lastChange >= this.options.minStateDurationMs)) {
      this.current = next;
      this.lastChange = timestamp;
    }

    return {
      timestamp,
      speaking: this.current !== MouthState.Closed,
      energy: Math.max(0, Math.min(1, rms / 0.28)),
      mouth: this.current,
    };
  }

  reset(timestamp = performance.now()): MotionFrame {
    this.current = MouthState.Closed;
    this.lastChange = timestamp;
    this.silenceSince = null;
    this.roundSince = null;
    return { timestamp, speaking: false, energy: 0, mouth: MouthState.Closed };
  }

  private rawState(features: AudioFeatures): MouthState {
    let next: MouthState = MouthState.Small;
    if (features.rms < this.options.silenceThreshold) next = MouthState.Closed;
    else if (features.rms > this.options.loudThreshold) next = MouthState.Large;
    else if (features.estimatedFrequencyHz > this.options.highFrequencyThreshold) next = MouthState.Wide;
    else if (features.rms >= this.options.roundMinRms && features.roundnessScore > this.options.roundThreshold) {
      this.roundSince ??= features.timestamp;
      return features.timestamp - this.roundSince >= this.options.roundMinDurationMs ? MouthState.Round : MouthState.Small;
    }
    this.roundSince = null;
    return next;
  }
}
