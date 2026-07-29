import { describe, expect, it } from 'vitest';
import { packRects, type PackedRect, type PackRect } from '../packer';

const PW = 267;
const PARTS_PH = 172;

function overlaps(a: PackedRect, b: PackedRect): boolean {
  if (a.page !== b.page) return false;
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function assertNoOverlaps(placed: PackedRect[]) {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      expect(overlaps(placed[i]!, placed[j]!)).toBe(false);
    }
  }
}

describe('packRects', () => {
  it('places every input rect exactly once', () => {
    const rects: PackRect[] = [
      { id: 'a', w: 160, h: 14 },
      { id: 'b', w: 160, h: 14 },
      { id: 'c', w: 47, h: 100 }
    ];
    const placed = packRects(rects, PW, PARTS_PH);
    expect(placed.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('the default-shaped config (two 160×14 struts + a 47×100 mudflap) fits one page', () => {
    const rects: PackRect[] = [
      { id: 'strut-1', w: 160, h: 14 },
      { id: 'strut-2', w: 160, h: 14 },
      { id: 'mudflap', w: 47, h: 100 }
    ];
    const placed = packRects(rects, PW, PARTS_PH);
    const pages = new Set(placed.map((p) => p.page));
    expect(pages.size).toBe(1);
    expect(placed.every((p) => !p.overflow)).toBe(true);
    assertNoOverlaps(placed);
  });

  it('never overlaps rects on the same page', () => {
    const rects: PackRect[] = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, w: 34, h: 14 }));
    const placed = packRects(rects, PW, PARTS_PH);
    assertNoOverlaps(placed);
  });

  it('every placed rect stays within the page bounds unless it overflows', () => {
    const rects: PackRect[] = [
      { id: 'strut-1', w: 220, h: 14 },
      { id: 'strut-2', w: 220, h: 14 },
      { id: 'strut-3', w: 220, h: 14 },
      { id: 'mudflap', w: 90, h: 47 }
    ];
    const placed = packRects(rects, PW, PARTS_PH);
    for (const p of placed) {
      if (p.overflow) continue;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(PW + 1e-9);
      expect(p.y + p.h).toBeLessThanOrEqual(PARTS_PH + 1e-9);
    }
  });

  it('rotation swaps w/h and never rotates a rect that already fits without it, on a fresh page', () => {
    const placed = packRects([{ id: 'strut', w: 160, h: 14 }], PW, PARTS_PH);
    expect(placed[0]!.rotated).toBe(false);
    expect(placed[0]!.w).toBe(160);
    expect(placed[0]!.h).toBe(14);
  });

  it('a part wider than the page in both orientations is flagged overflow, not silently dropped', () => {
    const rects: PackRect[] = [{ id: 'too-long', w: 420, h: 14 }];
    const placed = packRects(rects, PW, PARTS_PH);
    expect(placed).toHaveLength(1);
    expect(placed[0]!.overflow).toBe(true);
    expect(placed[0]!.id).toBe('too-long');
    // Must land on page 0, not strand an empty page 0 and skip to page 1.
    expect(placed[0]!.page).toBe(0);
  });

  it('a part that fits only when rotated gets rotated rather than overflowing', () => {
    // Natural (100×200) fails height (200 > PARTS_PH); rotated (200×100) fits both.
    const rects: PackRect[] = [{ id: 'tall-strip', w: 100, h: 200 }];
    const placed = packRects(rects, PW, PARTS_PH);
    expect(placed[0]!.overflow).toBe(false);
    expect(placed[0]!.rotated).toBe(true);
    expect(placed[0]!.w).toBe(200);
    expect(placed[0]!.h).toBe(100);
  });

  it('spills onto a second page once a page is full, rather than overlapping', () => {
    // Two 100×150 rects fit side by side on one shelf (200 <= PW); a third can't join
    // them (300 > PW) and can't start a new shelf either (150 > the 22mm left in
    // PARTS_PH) in any orientation, so it must spill to a second page.
    const rects: PackRect[] = [
      { id: 'm0', w: 100, h: 150 },
      { id: 'm1', w: 100, h: 150 },
      { id: 'm2', w: 100, h: 150 }
    ];
    const placed = packRects(rects, PW, PARTS_PH);
    const pages = new Set(placed.map((p) => p.page));
    expect(pages.size).toBeGreaterThan(1);
    assertNoOverlaps(placed);
    expect(placed.every((p) => !p.overflow)).toBe(true);
    expect(placed).toHaveLength(3);
  });

  it('is deterministic', () => {
    const rects: PackRect[] = [
      { id: 'a', w: 220, h: 14 },
      { id: 'b', w: 220, h: 14 },
      { id: 'c', w: 220, h: 14 },
      { id: 'd', w: 90, h: 47 }
    ];
    const first = packRects(rects, PW, PARTS_PH);
    const second = packRects(rects, PW, PARTS_PH);
    expect(second).toEqual(first);
  });

  it('handles an empty input', () => {
    expect(packRects([], PW, PARTS_PH)).toEqual([]);
  });
});
