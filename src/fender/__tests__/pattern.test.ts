import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildBlank } from '../pattern';
import type { FenderConfig } from '../types';

type Case = {
  config: FenderConfig;
  blank: {
    outline: string;
    foldLines: string[];
    scoreLineCount: number;
    holeCount: number;
    slotCount: number;
    seamCount: number;
    lapCount: number;
    panelCount: number;
    strutFrac: number[];
    viewBox: string;
    bboxW: number;
    bboxH: number;
    firstHole: { cx: string; cy: string; r: number } | null;
    lastHole: { cx: string; cy: string; r: number } | null;
    firstSlot: {
      x: string;
      y: string;
      w: number | string;
      h: number | string;
    } | null;
    lastSlot: {
      x: string;
      y: string;
      w: number | string;
      h: number | string;
    } | null;
  };
};

const CASES = Object.entries(golden as unknown as Record<string, Case>);

describe.each(CASES)('buildBlank(%s)', (_name, c) => {
  const b = buildBlank(c.config);
  const g = c.blank;

  // The outline is the whole job. Exact string equality catches a wrong vertex, a wrong
  // rounding mode, and a reordered edge traversal all at once.
  it('outline matches the design source exactly', () => {
    expect(b.outline).toBe(g.outline);
  });

  it('fold lines match exactly', () => {
    expect(b.foldLines.map((f) => f.d)).toEqual(g.foldLines);
  });

  it('viewBox matches', () => {
    expect(b.viewBox).toBe(g.viewBox);
    expect(b.bboxW).toBeCloseTo(g.bboxW, 10);
    expect(b.bboxH).toBeCloseTo(g.bboxH, 10);
  });

  // Counts and endpoints pin the push ORDER, which the exporters and DXF layers inherit.
  it('hole and slot counts match, in order', () => {
    expect(b.holes).toHaveLength(g.holeCount);
    expect(b.slots).toHaveLength(g.slotCount);
    expect(b.holes[0] ?? null).toEqual(g.firstHole);
    expect(b.holes[b.holes.length - 1] ?? null).toEqual(g.lastHole);
    expect(b.slots[0] ?? null).toEqual(g.firstSlot);
    expect(b.slots[b.slots.length - 1] ?? null).toEqual(g.lastSlot);
  });

  it('score, seam and lap counts match', () => {
    expect(b.scoreLines).toHaveLength(g.scoreLineCount);
    expect(b.seams).toHaveLength(g.seamCount);
    expect(b.lapLines).toHaveLength(g.lapCount);
  });

  it('panel count and strut positions match', () => {
    expect(b.panelCount).toBe(g.panelCount);
    expect(b.strutFrac).toHaveLength(g.strutFrac.length);
    b.strutFrac.forEach((fr, i) => expect(fr).toBeCloseTo(g.strutFrac[i]!, 12));
  });
});

describe('pattern invariants', () => {
  const base = CASES[0]![1].config;

  it('closes the outline', () => {
    expect(buildBlank(base).outline.trimEnd().endsWith('Z')).toBe(true);
  });

  it('the blank outline is straight-line only — no curves to sample when exporting', () => {
    // This is why DXF blank geometry is exact and only the parts sheet gets sampled.
    expect(buildBlank(base).outline).not.toMatch(/[acqstACQST]/);
  });

  it('cuts one dart fewer than the flap count', () => {
    // 20 flaps means 19 darts: the flaps are the panels between them.
    const zip = buildBlank({
      ...base,
      join: 'zip',
      struts: 1,
      mudflap: 0,
      stock: 'single'
    });
    const dartHoles = zip.holes.length - 4; // minus the single strut's four
    expect(dartHoles).toBe((base.flaps - 1) * 8);
  });

  it('the hole-free join pierces nothing but the mounts', () => {
    const none = buildBlank({
      ...base,
      join: 'none',
      struts: 0,
      mudflap: 0,
      stock: 'single'
    });
    expect(none.holes).toHaveLength(0);
    // One score line per dart, to take the tie round the girth.
    expect(none.scoreLines).toHaveLength(base.flaps - 1);
  });

  it('nesting doubles the drawn height', () => {
    const flat = buildBlank({ ...base, nest: false });
    const pair = buildBlank({ ...base, nest: true });
    expect(pair.bboxH).toBeCloseTo(flat.bboxH * 2 + 10, 10);
    // ...but must not change the pattern itself.
    expect(pair.outline).toBe(flat.outline);
  });

  it('a4 stock adds a fastener row per seam', () => {
    const single = buildBlank({ ...base, stock: 'single' });
    const panelled = buildBlank({ ...base, stock: 'a4' });
    expect(panelled.seams.length).toBe(panelled.panelCount - 1);
    expect(panelled.lapLines.length).toBe(panelled.panelCount - 1);
    expect(panelled.holes.length).toBeGreaterThan(single.holes.length);
  });

  it('taper past the knee narrows the tail but not the nose', () => {
    const t = buildBlank({ ...base, taper: 40, taperAt: 70 });
    const foldTop = t.foldLines[0]!.d;
    const ys = [...foldTop.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(ys[0]).toBeCloseTo(ys[1]!, 6); // flat until the knee
    expect(ys[2]!).toBeGreaterThan(ys[1]!); // then the crown closes in
  });
});
