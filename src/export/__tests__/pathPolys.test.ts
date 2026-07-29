import { afterEach, describe, expect, it } from 'vitest';
import { buildModel } from '../../fender/index';
import { DEFAULTS } from '../../fender/defaults';
import { pathPolys } from '../pathPolys';

/**
 * `jsdom` is NOT a project dependency (checked: absent from package.json and
 * node_modules) and PLAN's hard rules forbid adding one without asking first. So:
 *
 * - The straight-line branch (M/L/H/V/Z) never touches the DOM at all — see PLAN §9.2 —
 *   so it is tested directly here in the default `node` vitest environment, including
 *   against the real blank outline from `buildModel()`.
 * - The curve branch (`getTotalLength`/`getPointAtLength`) is exercised with a small
 *   hand-written `document` stub (not jsdom) that returns caller-controlled points, so
 *   the sampling ALGORITHM — step count clamping, the 0.05 mm dedup filter, the
 *   zero-length skip, and DOM element cleanup — gets real coverage without asserting on
 *   real browser curve geometry, which this environment cannot produce trustworthily.
 */

describe('pathPolys — straight subpaths (M/L/H/V/Z), no DOM', () => {
  it('walks absolute M/L into exact vertices', () => {
    expect(pathPolys('M 0,0 L 10,0 L 10,10 Z')).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 10]
      ]
    ]);
  });

  it('walks relative m/l, accumulating from the current point', () => {
    expect(pathPolys('M 0,0 l 10,0 l 0,10')).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 10]
      ]
    ]);
  });

  it('walks H/V (absolute) and h/v (relative)', () => {
    expect(pathPolys('M 0,0 H 10 V 10 h -5 v -5')).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 10],
        [5, 5]
      ]
    ]);
  });

  it('splits on every M/m into a separate polyline', () => {
    const polys = pathPolys('M 0,0 L 1,1 M 5,5 L 6,6');
    expect(polys).toEqual([
      [
        [0, 0],
        [1, 1]
      ],
      [
        [5, 5],
        [6, 6]
      ]
    ]);
  });

  it('drops a subpath with fewer than 2 vertices (a bare moveto)', () => {
    expect(pathPolys('M 0,0')).toEqual([]);
  });

  it('a trailing Z adds no vertex of its own', () => {
    const withZ = pathPolys('M 0,0 L 10,0 L 10,10 Z');
    const withoutZ = pathPolys('M 0,0 L 10,0 L 10,10');
    expect(withZ).toEqual(withoutZ);
  });

  it('handles scientific notation and negative numbers, matching the source regex', () => {
    expect(pathPolys('M -1.5e2,3 L 4,-5')).toEqual([
      [
        [-150, 3],
        [4, -5]
      ]
    ]);
  });

  it('reproduces the real blank outline head/tail exactly — PLAN §7 golden text', () => {
    // "M 0.0,40.9 L 20.0,0.0 L 66.7,0.0 L 69.1,25.4 L 71.6,0.0 …" — default config.
    //
    // PLAN §7's original head ("M 0.0,0.0 L 65.1,0.0 …", 124 vertices) predates the
    // §13.3 bevel. Two changes move the count to 125:
    //   +2  the nose now starts at the tongue's edge (0, 40.9) and steps out to full
    //       skirt depth at (20, 0), one net extra point on each of the two edges
    //   -1  the bevel makes the reversed bottom edge land exactly on the tongue's lower
    //       corner, so the tongue append no longer repeats it — that duplicate was a
    //       zero-length segment in a CUT path, which can dwell a laser and puts a
    //       repeated vertex in the DXF polyline
    const model = buildModel(DEFAULTS);
    const [outline] = pathPolys(model.blank.outline);
    expect(outline).toBeDefined();
    expect(outline!.length).toBe(125);

    // No consecutive duplicate vertices anywhere in the cut path.
    for (let i = 1; i < outline!.length; i++) {
      const [px, py] = outline![i - 1]!;
      const [cx, cy] = outline![i]!;
      expect(px === cx && py === cy, `duplicate vertex at index ${i}`).toBe(false);
    }
    expect(outline![0]).toEqual([0, 40.9]);
    expect(outline![1]).toEqual([20, 0]);
    expect(outline![2]).toEqual([66.7, 0]);
    expect(outline![3]).toEqual([69.1, 25.4]);
    const last = outline![outline!.length - 1]!;
    expect(last).toEqual([0, 40.9]);
  });

  it('never touches the DOM for a curve-free path', () => {
    const originalDocument = (globalThis as Record<string, unknown>)['document'];
    expect(originalDocument).toBeUndefined();
    expect(() => pathPolys('M 0,0 L 10,0 L 10,10 Z')).not.toThrow();
  });
});

describe('pathPolys — curved subpaths, hand-written DOM stub (no jsdom)', () => {
  /** A fake `document` returning caller-controlled points, standing in for jsdom. */
  function stubDocument(sampler: (u: number) => { x: number; y: number }, len: number) {
    let removed = false;
    let getPointCalls = 0;
    const pathEl = {
      attrs: {} as Record<string, string>,
      setAttribute(k: string, v: string) {
        this.attrs[k] = v;
      },
      getTotalLength: () => len,
      getPointAtLength: (l: number) => {
        getPointCalls += 1;
        return sampler(len === 0 ? 0 : l / len);
      }
    };
    const svgEl = {
      setAttribute() {
        /* no-op */
      },
      appendChild() {
        /* no-op */
      },
      remove() {
        removed = true;
      }
    };
    let createCalls = 0;
    const doc = {
      createElementNS: (_ns: string, tag: string) => {
        createCalls += 1;
        return tag === 'svg' ? svgEl : pathEl;
      },
      body: {
        appendChild() {
          /* no-op */
        }
      }
    };
    return {
      doc,
      wasRemoved: () => removed,
      getPointCalls: () => getPointCalls,
      createCalls: () => createCalls
    };
  }

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)['document'];
  });

  it('samples at a 0.4 mm step: a 100 mm straight-line curve gets 251 points', () => {
    const stub = stubDocument((u) => ({ x: u * 100, y: 0 }), 100);
    (globalThis as Record<string, unknown>)['document'] = stub.doc;

    const [pts] = pathPolys('M 0,0 a 50 50 0 0 1 100 0');
    expect(pts).toHaveLength(251); // steps = ceil(100/0.4) = 250, i + 1 samples
  });

  it('caps steps at 6000 for a very long curve', () => {
    const stub = stubDocument((u) => ({ x: u * 100000, y: 0 }), 100000);
    (globalThis as Record<string, unknown>)['document'] = stub.doc;

    pathPolys('M 0,0 a 5 5 0 0 1 100000 0');
    expect(stub.getPointCalls()).toBe(6001); // 6000 steps, capped
  });

  it('floors steps at 2 for a very short curve', () => {
    const stub = stubDocument((u) => ({ x: u * 1000, y: 0 }), 0.001);
    (globalThis as Record<string, unknown>)['document'] = stub.doc;

    const [pts] = pathPolys('M 0,0 a 1 1 0 0 1 0.001 0');
    expect(pts).toHaveLength(3); // steps = max(2, ceil(0.001/0.4)) = 2, i + 1 samples
  });

  it('dedups points closer than 0.05 mm, keeping the first and the first that clears it', () => {
    const stub = stubDocument((u) => (u < 1 ? { x: 0, y: 0 } : { x: 10, y: 0 }), 10);
    (globalThis as Record<string, unknown>)['document'] = stub.doc;

    const [pts] = pathPolys('M 0,0 a 5 5 0 0 1 10 0');
    expect(pts).toEqual([
      [0, 0],
      [10, 0]
    ]);
  });

  it('skips a zero-length curve subpath without sampling', () => {
    const stub = stubDocument(() => ({ x: 0, y: 0 }), 0);
    (globalThis as Record<string, unknown>)['document'] = stub.doc;

    expect(pathPolys('M 0,0 a 5 5 0 0 1 0 0')).toEqual([]);
    expect(stub.getPointCalls()).toBe(0);
  });

  it('removes the temporary SVG element after sampling', () => {
    const stub = stubDocument((u) => ({ x: u * 10, y: 0 }), 10);
    (globalThis as Record<string, unknown>)['document'] = stub.doc;

    pathPolys('M 0,0 a 5 5 0 0 1 10 0');
    expect(stub.wasRemoved()).toBe(true);
  });

  it('creates the DOM scratch elements once, even across multiple curved subpaths', () => {
    const stub = stubDocument((u) => ({ x: u * 10, y: 0 }), 10);
    (globalThis as Record<string, unknown>)['document'] = stub.doc;

    pathPolys('M 0,0 a 5 5 0 0 1 10 0 M 20,20 a 5 5 0 0 1 10 0');
    expect(stub.createCalls()).toBe(2); // one <svg>, one <path> — reused for both subpaths
  });

  it('mixes a straight subpath (no DOM) with a curved one (DOM) in the same path', () => {
    const stub = stubDocument((u) => ({ x: u * 10, y: 10 }), 10);
    (globalThis as Record<string, unknown>)['document'] = stub.doc;

    const polys = pathPolys('M 0,0 L 5,5 M 20,20 a 5 5 0 0 1 10 0');
    expect(polys[0]).toEqual([
      [0, 0],
      [5, 5]
    ]);
    expect(polys[1]).toHaveLength(26); // steps = ceil(10/0.4) = 25, i + 1 samples
  });
});
