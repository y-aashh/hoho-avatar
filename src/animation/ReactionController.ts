/** Renderer-independent expressive motion. Distances use a 512-unit reference canvas. */
export const REACTIONS = ['worried', 'look_up', 'impressed', 'aha', 'curious'] as const;
export type ReactionName = typeof REACTIONS[number];
export interface ReactionOptions {
  /** Motion duration in seconds, excluding the additional final-pose hold. */
  duration?: number;
  /** Additional seconds at the final expression/effect pose. Default: 0. */
  holdDuration?: number;
  intensity?: number;
  interrupt?: boolean;
}
export interface IdleMotionOptions {
  rotationDeg?: number; horizontalPx?: number; verticalPx?: number; frequencyHz?: number; speechInfluence?: number;
}
export interface ReactionControllerOptions { seed?: number; idleMotion?: boolean; idleSway?: IdleMotionOptions; }
export interface ReactionLayerPose { expression: ReactionName; weight: number; progress: number; effect: { opacity: number; y: number }; }
export interface ReactionPose {
  expression?: ReactionName;
  progress: number;
  weight: number;
  layers: readonly ReactionLayerPose[];
  position: { x: number; y: number };
  rotation: number;
  /** Uniform whole-character scale; omitted by older producers means 1. */
  scale?: number;
  gaze: { x: number; y: number };
  idle: { x: number; y: number; rotation: number };
}
const durations: Record<ReactionName, number> = { worried: 1.4, look_up: 1.2, impressed: 1.5, aha: 1, curious: 1.8 };
const recoveryStart = (name: ReactionName) => name === 'aha' ? 0.6 : name === 'curious' ? 0.75 : 0.68;
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
// Progress, horizontal/vertical reference pixels, degrees, uniform scale offset.
type MotionKey = readonly [number, number, number, number, number];
const ahaMotion: readonly MotionKey[] = [
  [0, 0, 0, 0, 0], [0.1, 0, 0.8, 0.1, 0], [0.15, 0, 0.8, 0.1, 0],
  [0.35, 0, -2.4, -1.5, 0], [0.46, 0.8, -3.8, -0.7, 0],
  [0.6, 0.4, -1.3, 0.4, 0], [0.72, 0.1, 0.45, 0.8, 0],
  [0.84, 0, -0.2, -0.25, 0], [1, 0, 0, 0, 0],
];
const curiousMotion: readonly MotionKey[] = [
  [0, 0, 0, 0, 0], [0.2, 0.45, -0.2, 1.4, 0.005],
  [0.45, 1.5, -0.7, 4, 0.018], [0.75, 1.5, -0.7, 4, 0.018], [1, 0, 0, 0, 0],
];
function sampleMotion(keys: readonly MotionKey[], progress: number): number[] {
  const end = keys.findIndex(key => key[0] >= progress);
  if (end <= 0) return keys[end === 0 ? 0 : keys.length - 1]!.slice(1);
  const a = keys[end - 1]!, b = keys[end]!;
  const t = smooth((progress - a[0]) / (b[0] - a[0]));
  return a.slice(1).map((value, index) => value + (b[index + 1]! - value) * t);
}
export function validateIdleMotion(options: IdleMotionOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('idleSway must be an object');
  for (const [key, value] of Object.entries(options)) {
    if (!['rotationDeg', 'horizontalPx', 'verticalPx', 'frequencyHz', 'speechInfluence'].includes(key)
      || typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Invalid idleSway.${key}`);
  }
}
/** No timers, audio dependencies or rendering dependencies. Advance with elapsed seconds. */
export class ReactionController {
  private time = 0;
  private active?: { name: ReactionName; start: number; duration: number; holdDuration: number; intensity: number };
  private outgoing: ReactionLayerPose[] = [];
  private transition = 0;
  private enabled: boolean;
  private idleAmount = 0;
  private idleVelocity = 0;
  private speechAmount = 0;
  private readonly phase: number;
  private readonly idleOptions: Required<IdleMotionOptions>;
  constructor(options: ReactionControllerOptions = {}) {
    if (options.seed !== undefined && (!Number.isSafeInteger(options.seed))) throw new Error('seed must be a safe integer');
    validateIdleMotion(options.idleSway ?? {});
    if (options.idleMotion !== undefined && typeof options.idleMotion !== 'boolean') throw new Error('idleMotion must be boolean');
    this.enabled = options.idleMotion ?? false;
    this.phase = (((options.seed ?? 1) * 1664525 + 1013904223) >>> 0) / 4294967296 * Math.PI * 2;
    this.idleOptions = { rotationDeg: 0.9, horizontalPx: 2, verticalPx: 1.5, frequencyHz: 0.25, speechInfluence: 0, ...options.idleSway };
  }
  triggerReaction(name: ReactionName, options: ReactionOptions = {}): void {
    if (!REACTIONS.includes(name)) throw new Error('Unknown reaction');
    const duration = options.duration ?? durations[name], intensity = options.intensity ?? 1;
    const holdDuration = options.holdDuration ?? 0;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('duration must be positive and finite');
    if (!Number.isFinite(holdDuration) || holdDuration < 0) throw new Error('holdDuration must be non-negative and finite');
    if (!Number.isFinite(duration + holdDuration)) throw new Error('duration + holdDuration must be finite');
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw new Error('intensity must be between 0 and 1');
    if (options.interrupt !== undefined && typeof options.interrupt !== 'boolean') throw new Error('interrupt must be boolean');
    if (options.interrupt === false && this.active) return;
    this.outgoing = this.layers(); this.transition = this.time;
    this.active = { name, duration, holdDuration, intensity, start: this.time };
  }
  setIdleMotion(enabled: boolean): void {
    if (typeof enabled !== 'boolean') throw new Error('idle motion must be boolean');
    this.enabled = enabled;
  }
  resetReaction(): void { this.outgoing = this.layers(); this.transition = this.time; this.active = undefined; }
  destroy(): void { this.active = undefined; this.outgoing = []; this.enabled = false; this.idleAmount = this.idleVelocity = this.speechAmount = 0; }
  private activeProgress(): number {
    if (!this.active) return 1;
    const { start, duration, holdDuration } = this.active;
    const recovery = recoveryStart(this.active.name);
    const elapsed = this.time - start;
    // Preserve the existing timeline exactly when no explicit hold is requested.
    if (holdDuration === 0) return Math.min(1, elapsed / duration);
    const entryDuration = duration * recovery;
    if (elapsed < entryDuration) return recovery * smooth(elapsed / entryDuration);
    if (elapsed < entryDuration + holdDuration) return recovery;
    // Ease to/from zero velocity around the frozen pose; no timers or extra loop.
    return recovery + (1 - recovery) * smooth(
      (elapsed - entryDuration - holdDuration) / (duration * (1 - recovery)),
    );
  }
  private layers(): ReactionLayerPose[] {
    const fade = 1 - smooth((this.time - this.transition) / 0.22);
    const layers = this.outgoing.map(layer => ({ ...layer, weight: layer.weight * fade }));
    if (this.active) {
      const p = this.activeProgress();
      const recovery = recoveryStart(this.active.name);
      const recoverySpan = this.active.name === 'aha' ? 0.4 : this.active.name === 'curious' ? 0.25 : 0.32;
      const weight = smooth(p / 0.22) * (1 - smooth((p - recovery) / recoverySpan)) * this.active.intensity;
      const hasHold = this.active.holdDuration > 0;
      const fall = Math.max(0, Math.min(1, (p - 0.25) / (hasHold ? recovery - 0.25 : 0.75)));
      layers.push({ expression: this.active.name, progress: p, weight,
        effect: { opacity: smooth((p - 0.15) / 0.12) * (1 - smooth(hasHold ? (p - recovery) / (1 - recovery) : (p - 0.6) / 0.3)), y: 45 * fall * fall } });
    }
    return layers.filter(layer => layer.weight > 0.000001);
  }
  update(deltaSeconds: number, speechEnergy = 0): ReactionPose {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error('deltaSeconds must be non-negative and finite');
    this.time += deltaSeconds;
    // Exact critically damped spring for enable/disable; independent of frame subdivision.
    const target = this.enabled ? 1 : 0, omega = 9;
    const displacement = this.idleAmount - target, c = this.idleVelocity + omega * displacement;
    const decay = Math.exp(-omega * deltaSeconds);
    this.idleAmount = target + (displacement + c * deltaSeconds) * decay;
    this.idleVelocity = (this.idleVelocity - omega * c * deltaSeconds) * decay;
    const layers = this.layers();
    if (this.active && this.time - this.active.start >= this.active.duration + this.active.holdDuration) this.active = undefined;
    if (this.time - this.transition >= 0.22) this.outgoing = [];
    const pose: ReactionPose = { expression: this.active?.name, progress: this.activeProgress(),
      weight: 0, layers, position: { x: 0, y: 0 }, rotation: 0, scale: 1, gaze: { x: 0, y: 0 }, idle: { x: 0, y: 0, rotation: 0 } };
    let quietIdle = 0;
    for (const layer of layers) {
      const w = layer.weight;
      pose.weight += w;
      if (layer.expression === 'worried') { pose.rotation += -2 * w; pose.gaze.x -= w; }
      if (layer.expression === 'look_up') { pose.rotation += 2 * w; pose.gaze.x -= w; pose.gaze.y -= w; }
      if (layer.expression === 'impressed') { pose.position.y += (-3 + 3 * Math.sin(layer.progress * Math.PI * 4)) * w; pose.rotation += Math.sin(layer.progress * Math.PI * 4) * w; }
      if (layer.expression === 'aha' || layer.expression === 'curious') {
        const [x, y, rotation, scale] = sampleMotion(layer.expression === 'aha' ? ahaMotion : curiousMotion, layer.progress);
        pose.position.x += x! * w; pose.position.y += y! * w;
        pose.rotation += rotation! * w; pose.scale! += scale! * w;
        if (layer.expression === 'curious') {
          quietIdle += 0.7 * w * smooth(layer.progress / 0.45);
          pose.gaze.x -= w; pose.gaze.y -= w;
        }
      }
    }
    const o = this.idleOptions, angle = this.time * Math.PI * 2 * o.frequencyHz + this.phase;
    const energy = Number.isFinite(speechEnergy) ? Math.max(0, Math.min(1, speechEnergy)) : 0;
    this.speechAmount += (energy - this.speechAmount) * (1 - Math.exp(-deltaSeconds * 5));
    const amount = this.idleAmount * (1 + this.speechAmount * o.speechInfluence) * Math.max(0, 1 - quietIdle);
    pose.idle = { x: Math.sin(angle) * o.horizontalPx * amount, y: Math.sin(angle * 2) * o.verticalPx * amount,
      rotation: Math.sin(angle + 0.4) * o.rotationDeg * amount };
    return pose;
  }
}
