import { describe, expect, it } from 'vitest';
import { ReactionController, REACTIONS } from '../src/animation/ReactionController';

describe('ReactionController', () => {
  it.each(REACTIONS)('eases %s from neutral through a hold and recovers', name => {
    const c = new ReactionController();
    c.triggerReaction(name, { duration: 1, intensity: 0.8 });
    expect(c.update(0).weight).toBe(0);
    const early = c.update(0.05);
    const peak = c.update(0.35);
    expect(early.weight).toBeGreaterThan(0);
    expect(peak.weight).toBeCloseTo(0.8);
    expect(c.update(0.45).weight).toBeLessThan(peak.weight);
    expect(c.update(0.15).layers).toEqual([]);
    expect(c.update(0).expression).toBeUndefined();
  });
  it('interrupts without a pose jump and smoothly resets', () => {
    const c = new ReactionController(); c.triggerReaction('worried');
    const before = c.update(0.4);
    c.triggerReaction('look_up');
    expect(c.update(0).rotation).toBe(before.rotation);
    expect(c.update(0.1).layers.map(l => l.expression)).toEqual(['worried', 'look_up']);
    const atReset = c.update(0);
    c.resetReaction(); expect(c.update(0).rotation).toBe(atReset.rotation);
    expect(c.update(0.3).layers).toEqual([]);
  });
  it('supports non-interruption, configured duration, accelerating sweat and destruction', () => {
    const c = new ReactionController(); c.triggerReaction('worried', { duration: 2 });
    c.update(0.5); c.triggerReaction('impressed', { interrupt: false });
    const first = c.update(0.2);
    expect(first.expression).toBe('worried');
    const second = c.update(0.2);
    const third = c.update(0.2);
    expect(third.layers[0]!.effect.y - second.layers[0]!.effect.y).toBeGreaterThan(second.layers[0]!.effect.y - first.layers[0]!.effect.y);
    c.destroy(); expect(c.update(0).layers).toEqual([]);
  });
  it('has deterministic elapsed-time sway and damped settling', () => {
    const a = new ReactionController({ seed: 42, idleMotion: true });
    const b = new ReactionController({ seed: 42, idleMotion: true });
    const p = a.update(2);
    for (let i = 0; i < 120; i++) b.update(1 / 60);
    expect(b.update(0).idle.x).toBeCloseTo(p.idle.x, 10);
    expect(b.update(0).idle.rotation).toBeCloseTo(p.idle.rotation, 10);
    expect(new ReactionController({ seed: 2, idleMotion: true }).update(2).idle.x).not.toBe(p.idle.x);
    a.setIdleMotion(false); expect(a.update(0).idle).toEqual(p.idle);
    expect(Math.abs(a.update(3).idle.rotation)).toBeLessThan(0.00001);
  });
  it.each(['worried', 'look_up', 'impressed'] as const)('holds the complete %s pose for additional seconds before recovering', name => {
    const c = new ReactionController();
    c.triggerReaction(name, { duration: 1, holdDuration: 2, intensity: 0.8 });
    const finalPose = c.update(0.68);
    expect(finalPose.weight).toBeCloseTo(0.8);
    expect(finalPose.layers[0]!.effect).toEqual({ opacity: 1, y: 45 });
    // Idle is independent (including signed-zero changes when disabled).
    const heldReaction = { ...finalPose, idle: expect.any(Object) };
    expect(c.update(1)).toEqual(heldReaction);
    expect(c.update(0.9999)).toEqual(heldReaction);
    const recovery = c.update(0.16);
    expect(recovery.weight).toBeLessThan(finalPose.weight);
    expect(recovery.layers[0]!.effect.y).toBe(45);
    expect(c.update(0.1602).layers).toEqual([]);
    expect(c.update(0).expression).toBeUndefined();
  });
  it('keeps the original animation exactly when the hold is omitted or zero', () => {
    const a = new ReactionController(), b = new ReactionController();
    a.triggerReaction('worried', { duration: 1 });
    b.triggerReaction('worried', { duration: 1, holdDuration: 0 });
    for (const dt of [0, 0.05, 0.3, 0.33, 0.22, 0.1]) expect(a.update(dt)).toEqual(b.update(dt));
  });
  it('preserves a held pose on interruption, permits early reset and clears on destroy', () => {
    const c = new ReactionController(); c.triggerReaction('worried', { duration: 1, holdDuration: 2 });
    const held = c.update(1.5);
    c.triggerReaction('look_up', { interrupt: false });
    expect(c.update(0)).toEqual(held);
    c.triggerReaction('impressed', { holdDuration: 2 });
    expect(c.update(0).layers).toEqual(held.layers);
    c.resetReaction();
    expect(c.update(0.3).layers).toEqual([]);
    c.triggerReaction('worried', { duration: 1, holdDuration: 2 }); c.update(1);
    c.destroy(); expect(c.update(10).layers).toEqual([]);
  });
  it('advances a held animation deterministically and finishes after a skipped frame', () => {
    const a = new ReactionController(), b = new ReactionController();
    a.triggerReaction('impressed', { duration: 1, holdDuration: 2 });
    b.triggerReaction('impressed', { duration: 1, holdDuration: 2 });
    const pose = a.update(2);
    for (let i = 0; i < 120; i++) b.update(1 / 60);
    expect(b.update(0)).toEqual(pose);
    expect(a.update(20).layers).toEqual([]);
  });
  it('validates names, seed and numeric options', () => {
    const c = new ReactionController();
    expect(() => c.triggerReaction('bad' as never)).toThrow('Unknown reaction');
    for (const duration of [NaN, Infinity, 0, -1]) expect(() => c.triggerReaction('worried', { duration })).toThrow('duration');
    for (const intensity of [NaN, Infinity, -1, 2]) expect(() => c.triggerReaction('worried', { intensity })).toThrow('intensity');
    for (const holdDuration of [NaN, Infinity, -1]) expect(() => c.triggerReaction('worried', { holdDuration })).toThrow('holdDuration');
    expect(() => c.triggerReaction('worried', { duration: Number.MAX_VALUE, holdDuration: Number.MAX_VALUE })).toThrow('finite');
    expect(() => c.update(-1)).toThrow('deltaSeconds');
    expect(() => new ReactionController({ seed: NaN })).toThrow('seed');
    expect(() => new ReactionController({ idleSway: { frequencyHz: -1 } })).toThrow('idleSway');
  });

  it.each([['aha', 1, 0.6], ['curious', 1.8, 0.75]] as const)('%s uses its default duration and holds its final pose', (name, duration, holdAt) => {
    const controller = new ReactionController();
    controller.triggerReaction(name);
    expect(controller.update(duration - 0.01).expression).toBe(name);
    expect(controller.update(0.011)).toMatchObject({ layers: [], position: { x: 0, y: 0 }, rotation: 0, scale: 1 });
    controller.triggerReaction(name, { duration: 2, holdDuration: 1.5 });
    const pose = controller.update(2 * holdAt);
    const held = { ...pose, idle: expect.any(Object) };
    expect(controller.update(1)).toEqual(held);
    expect(controller.update(0.499)).toEqual(held);
    expect(controller.update(2).layers).toEqual([]);
  });

  it('gives Aha anticipation, a short lift and a gentle recovery nod', () => {
    const c = new ReactionController(); c.triggerReaction('aha');
    expect(c.update(0.1).position.y).toBeGreaterThan(0);
    const lift = c.update(0.25);
    const peak = c.update(0.11);
    expect(peak.position.y).toBeCloseTo(-3.8);
    expect(peak.position.y).toBeLessThan(lift.position.y);
    expect(peak.position.x).toBeGreaterThan(0);
    expect(Math.abs(peak.rotation)).toBeLessThan(3);
    expect(c.update(0.26).position.y).toBeGreaterThan(0);
    expect(c.update(0.28)).toMatchObject({ position: { x: 0, y: 0 }, rotation: 0, scale: 1 });
  });

  it('gives Curious a slower lean, uniform scale, quiet idle hold and full recovery', () => {
    const c = new ReactionController({ seed: 42, idleMotion: true });
    const neutral = new ReactionController({ seed: 42, idleMotion: true });
    c.triggerReaction('curious');
    const notice = c.update(0.36), investigate = c.update(0.45), hold = c.update(0.4);
    expect(notice.rotation).toBeLessThan(investigate.rotation);
    expect(investigate.rotation).toBeCloseTo(4);
    expect(investigate.scale).toBeCloseTo(1.018);
    expect(investigate.gaze).toEqual({ x: -1, y: -1 });
    expect(hold.position).toEqual(investigate.position);
    expect(hold.rotation).toBe(investigate.rotation);
    const idle = neutral.update(1.21).idle;
    expect(hold.idle.x).toBeCloseTo(idle.x * 0.3);
    expect(hold.idle.rotation).toBeCloseTo(idle.rotation * 0.3);
    const recovered = c.update(0.59);
    expect(recovered).toMatchObject({ position: { x: 0, y: 0 }, rotation: 0, scale: 1 });
    expect(recovered.idle.x).toBeCloseTo(neutral.update(0.59).idle.x);
  });

  it.each(['aha', 'curious'] as const)('scales %s intensity and composes deterministic motion through interruption/reset', name => {
    const a = new ReactionController({ seed: 3, idleMotion: true });
    const b = new ReactionController({ seed: 3, idleMotion: true });
    const half = new ReactionController();
    a.triggerReaction(name, { duration: 2 }); b.triggerReaction(name, { duration: 2 });
    half.triggerReaction(name, { duration: 2, intensity: 0.5 });
    const fullPose = a.update(1), halfPose = half.update(1);
    expect(halfPose.rotation).toBeCloseTo(fullPose.rotation / 2);
    expect(halfPose.position.x).toBeCloseTo(fullPose.position.x / 2);
    expect(halfPose.scale! - 1).toBeCloseTo((fullPose.scale! - 1) / 2);
    for (let i = 0; i < 60; i++) b.update(1 / 60);
    expect(b.update(0).rotation).toBeCloseTo(fullPose.rotation, 10);
    expect(b.update(0).idle.x).toBeCloseTo(fullPose.idle.x, 10);
    a.triggerReaction(name === 'aha' ? 'curious' : 'aha');
    expect(a.update(0)).toMatchObject({ position: fullPose.position, rotation: fullPose.rotation, scale: fullPose.scale, idle: fullPose.idle });
    const interrupted = a.update(0.08);
    expect(interrupted.layers).toHaveLength(2);
    a.resetReaction();
    expect(a.update(0)).toMatchObject({ position: interrupted.position, rotation: interrupted.rotation, scale: interrupted.scale, idle: interrupted.idle });
    expect(a.update(0.22)).toMatchObject({ layers: [], scale: 1, rotation: 0 });
    a.triggerReaction(name); a.update(0.4); a.destroy();
    expect(a.update(0)).toMatchObject({ layers: [], scale: 1, rotation: 0 });
  });

  it.each(['worried', 'look_up', 'impressed'] as const)('keeps the original %s movement and envelope', name => {
    const c = new ReactionController(); c.triggerReaction(name, { duration: 1 });
    const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
    let time = 0;
    for (const dt of [0, 0.05, 0.35, 0.28, 0.16, 0.1, 0.06]) {
      time += dt;
      const pose = c.update(dt), w = ease(time / 0.22) * (1 - ease((time - 0.68) / 0.32));
      expect(pose.weight).toBeCloseTo(w, 10);
      expect(pose.rotation).toBeCloseTo((name === 'worried' ? -2 : name === 'look_up' ? 2 : Math.sin(time * Math.PI * 4)) * w, 10);
      expect(pose.scale).toBe(1);
    }
  });
});
