import { describe, expect, it } from 'vitest';
import {
  clampDragHeight,
  nearestSnap,
  projectMomentum,
  resolveSnapTarget,
  rubberband,
  snapHeights,
  snapList,
  springSettled,
  springStep
} from '../sheetPhysics';

describe('snapHeights', () => {
  it('fixes peek at 96px regardless of viewport', () => {
    expect(snapHeights(800).peek).toBe(96);
    expect(snapHeights(1200).peek).toBe(96);
  });

  it('derives half/full as fractions of viewport height', () => {
    const h = snapHeights(1000);
    expect(h.half).toBeCloseTo(550);
    expect(h.full).toBeCloseTo(920);
  });
});

describe('projectMomentum', () => {
  it('is zero for zero velocity', () => {
    expect(projectMomentum(0)).toBe(0);
  });

  it('projects further forward for larger velocity, same sign', () => {
    const small = projectMomentum(200);
    const large = projectMomentum(800);
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });

  it('projects backward for negative velocity', () => {
    expect(projectMomentum(-300)).toBeLessThan(0);
  });
});

describe('nearestSnap', () => {
  const snaps = snapList(snapHeights(1000));

  it('picks the closest snap by height', () => {
    expect(nearestSnap(96, snaps).id).toBe('peek');
    expect(nearestSnap(550, snaps).id).toBe('half');
    expect(nearestSnap(920, snaps).id).toBe('full');
  });

  it('picks the nearer neighbour for an in-between value', () => {
    expect(nearestSnap(400, snaps).id).toBe('half'); // closer to 550 than 96
    expect(nearestSnap(200, snaps).id).toBe('peek'); // closer to 96 than 550
  });
});

describe('resolveSnapTarget', () => {
  const h = snapHeights(1000);

  it('with no velocity, resolves to the nearest snap to the release height', () => {
    expect(resolveSnapTarget(500, 0, h).id).toBe('half');
  });

  it('a strong upward flick from peek can skip past half straight to full', () => {
    // Released right at peek but moving fast enough that momentum projects well past half.
    const target = resolveSnapTarget(h.peek, 4000, h);
    expect(target.id).toBe('full');
  });

  it('a strong downward flick from full can skip past half straight to peek', () => {
    const target = resolveSnapTarget(h.full, -4000, h);
    expect(target.id).toBe('peek');
  });
});

describe('rubberband', () => {
  it('is zero at zero overshoot', () => {
    expect(rubberband(0, 900)).toBe(0);
  });

  it('grows with overshoot but stays sublinear (resists progressively)', () => {
    const small = rubberband(20, 900);
    const large = rubberband(200, 900);
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
    // Sublinear: 10x the overshoot should not produce 10x the displacement.
    expect(large).toBeLessThan(small * 10);
  });

  it('is negative for negative overshoot (mirrors the other direction)', () => {
    expect(rubberband(-50, 900)).toBeLessThan(0);
  });
});

describe('clampDragHeight', () => {
  const h = snapHeights(1000);

  it('passes values inside [peek, full] through unchanged', () => {
    expect(clampDragHeight(500, h)).toBe(500);
  });

  it('resists but does not hard-stop past full', () => {
    const dragged = clampDragHeight(h.full + 300, h);
    expect(dragged).toBeGreaterThan(h.full);
    expect(dragged).toBeLessThan(h.full + 300);
  });

  it('resists but does not hard-stop below peek', () => {
    const dragged = clampDragHeight(h.peek - 300, h);
    expect(dragged).toBeLessThan(h.peek);
    expect(dragged).toBeGreaterThan(h.peek - 300);
  });
});

describe('springStep / springSettled', () => {
  it('converges toward the target over repeated steps', () => {
    let position = 96;
    let velocity = 0;
    const target = 550;
    for (let i = 0; i < 600; i++) {
      const next = springStep(position, velocity, target, 0.3, 0.8, 1 / 60);
      position = next.position;
      velocity = next.velocity;
    }
    expect(springSettled(position, velocity, target)).toBe(true);
    expect(position).toBeCloseTo(target, 0);
  });

  it('critically damped (dampingRatio 1.0) never overshoots the target', () => {
    let position = 0;
    let velocity = 0;
    const target = 100;
    let maxPosition = 0;
    for (let i = 0; i < 600; i++) {
      const next = springStep(position, velocity, target, 0.3, 1.0, 1 / 60);
      position = next.position;
      velocity = next.velocity;
      maxPosition = Math.max(maxPosition, position);
    }
    expect(maxPosition).toBeLessThanOrEqual(target + 0.5);
  });

  it('springSettled is false far from target or at high velocity', () => {
    expect(springSettled(0, 0, 100)).toBe(false);
    expect(springSettled(100, 50, 100)).toBe(false);
    expect(springSettled(100, 0, 100)).toBe(true);
  });
});
