import { describe, expect, it } from 'vitest';
import { nestPoint } from '../nestTransform';

describe('nestPoint', () => {
  it('maps the origin to (L, Wd*2+10)', () => {
    expect(nestPoint([0, 0], 1350.9, 105.9)).toEqual([1350.9, 105.9 * 2 + 10]);
  });

  it('is rotate(180) about the origin, then translate(L, Wd*2+10) — SVG right-to-left order', () => {
    expect(nestPoint([10, 20], 100, 50)).toEqual([90, 90]); // [100-10, (50*2+10)-20]
  });

  it('is an involution: applying it twice returns the original point', () => {
    const L = 500;
    const Wd = 80;
    const p: [number, number] = [37.5, 12.25];
    const twice = nestPoint(nestPoint(p, L, Wd), L, Wd);
    expect(twice[0]).toBeCloseTo(p[0], 9);
    expect(twice[1]).toBeCloseTo(p[1], 9);
  });

  it('matches tiling.ts\'s nestTransform string numerically', () => {
    // tiling.ts: `translate(${f1(g.L)}, ${f1(g.Wd * 2 + 10)}) rotate(180)`.
    const L = 1350.88;
    const Wd = 105.88;
    const [nx, ny] = nestPoint([0, 0], L, Wd);
    expect(nx).toBeCloseTo(L, 6);
    expect(ny).toBeCloseTo(Wd * 2 + 10, 6);
  });
});
