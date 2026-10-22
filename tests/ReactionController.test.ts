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
  it('validates names, seed and numeric options', () => {
    const c = new ReactionController();
    expect(() => c.triggerReaction('bad' as never)).toThrow('Unknown reaction');
    for (const duration of [NaN, Infinity, 0, -1]) expect(() => c.triggerReaction('worried', { duration })).toThrow('duration');
    for (const intensity of [NaN, Infinity, -1, 2]) expect(() => c.triggerReaction('worried', { intensity })).toThrow('intensity');
    expect(() => c.update(-1)).toThrow('deltaSeconds');
    expect(() => new ReactionController({ seed: NaN })).toThrow('seed');
    expect(() => new ReactionController({ idleSway: { frequencyHz: -1 } })).toThrow('idleSway');
  });
});
