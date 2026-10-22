import type { MouthState } from './MouthState';
export type { MouthState } from './MouthState';
export type { CharacterState } from './CharacterState';

export interface MotionFrame {
  timestamp: number;
  speaking: boolean;
  energy: number;
  mouth: MouthState;
}

export interface AudioFeatures {
  timestamp: number;
  rms: number;
  peak: number;
  zeroCrossingRate: number;
  /** Zero-crossing-derived frequency estimate in Hz; not a spectral centroid. */
  estimatedFrequencyHz: number;
  /** Sample-rate-normalized 0..1 zero-crossing heuristic; not a phoneme or spectral measurement. */
  roundnessScore: number;
}
