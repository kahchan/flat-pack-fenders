import { describe, expect, it } from 'vitest';
import { PRINT_STROKE, RULER_CAPTION } from '../printStrokes';

describe('PRINT_STROKE', () => {
  it('matches the design source print weights exactly (fender.html ~381-423)', () => {
    expect(PRINT_STROKE).toEqual({
      frame: 0.4,
      ruler: 0.6,
      outline: 0.9,
      seam: 0.7,
      lap: 0.5,
      fold: 0.6,
      score: 0.5,
      hole: 0.6,
      slot: 0.6
    });
  });

  it('every print weight is thinner than its screen counterpart (SheetA.tsx / SheetB.tsx)', () => {
    // Screen weights: outline 1.2, fold 0.9, seam 1.4, lap 1, hole/slot 0.9.
    expect(PRINT_STROKE.outline).toBeLessThan(1.2);
    expect(PRINT_STROKE.fold).toBeLessThan(0.9);
    expect(PRINT_STROKE.seam).toBeLessThan(1.4);
    expect(PRINT_STROKE.lap).toBeLessThan(1);
    expect(PRINT_STROKE.hole).toBeLessThan(0.9);
    expect(PRINT_STROKE.slot).toBeLessThan(0.9);
  });
});

describe('RULER_CAPTION', () => {
  // PLAN FEEDBACK WP17 (decision A3) — the design source (fender.html:1004) reads
  // "100 mm — measure to check scale"; the em-dash is now a colon. Facts unchanged.
  it('drops the source em-dash but keeps the same instruction (WP17)', () => {
    expect(RULER_CAPTION).toBe('100 mm: measure to check scale');
  });
});
