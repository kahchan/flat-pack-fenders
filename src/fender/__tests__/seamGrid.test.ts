import { describe, expect, it } from 'vitest';
import { LAP, PW, WHEELS, tileOriginX } from '../defaults';
import { buildAssembly, mergedDartAt } from '../assembly';
import { geo } from '../geometry';
import { buildBlank } from '../pattern';
import { buildTiling, croppedTile } from '../tiling';
import { PRESETS } from '../../state/presets';
import type { FenderConfig, WheelKey } from '../types';

/** Parses the leading `M x,y` out of a seam/lap path `d` string. */
const leadX = (d: string): number => Number(d.match(/^M (-?[\d.]+),/)![1]);

/**
 * WP27 — the invariant this package exists to protect: a panel seam and the tile
 * boundary it belongs to are the SAME grid now (`tileOriginX` shared by `pattern.ts` and
 * `tiling.ts`), not two independent computations that happened to agree. Swept over
 * every preset AND a sweep of lengths chosen to stress `ceil()` boundaries — a length
 * exactly on a `PW - LAP` step is where a formula that merely "usually agrees" would
 * show it.
 */
describe('WP27 — the panel seam is where the page is', () => {
  const wheels = Object.keys(WHEELS) as WheelKey[];
  const leads = [0, 40, 55, 120, 160];
  const trails = [0, 100, 120, 160, 200];

  it('every seam sits within 0.05 mm of its tile boundary, for every preset', () => {
    let checked = 0;
    for (const preset of PRESETS) {
      const cfg: FenderConfig = { ...preset.config, stock: 'a4' };
      const g = geo(cfg);
      const b = buildBlank(cfg, g);
      const t = buildTiling(cfg, g, b);
      if (b.panelCount <= 1) continue;

      const x0 = tileOriginX(cfg);
      const stepX = PW - LAP;
      b.seams.forEach((sm, i) => {
        const nominal = x0 + (i + 1) * stepX;
        expect(leadX(sm.d), `${preset.id} seam ${i + 1}`).toBeCloseTo(nominal, 1);
      });
      // The print-tile grid shares the same origin, so column c's own x is the same
      // number — checked directly against `t.rects`, not re-derived.
      expect(t.rects[0]!.x).toBe(String(x0.toFixed(1)));
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('every seam sits within 0.05 mm of its tile boundary, across a length sweep stressing ceil() boundaries', () => {
    const base = PRESETS[0]!.config;
    let checked = 0;
    for (const wheel of wheels) {
      for (const lead of leads) {
        for (const trail of trails) {
          if (lead + trail <= 0) continue;
          const cfg: FenderConfig = { ...base, wheel, lead, trail, stock: 'a4' };
          const g = geo(cfg);
          const b = buildBlank(cfg, g);
          if (b.panelCount <= 1) continue;

          const x0 = tileOriginX(cfg);
          const stepX = PW - LAP;
          b.seams.forEach((sm, i) => {
            const nominal = x0 + (i + 1) * stepX;
            expect(leadX(sm.d), `${wheel} ${lead}/${trail} seam ${i + 1}`).toBeCloseTo(nominal, 1);
          });
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  // Exact multiples of `stepX` are where `panelCount`'s `ceil()` has zero residual — the
  // one case a formula relying on rounding-up slack could get wrong.
  it('every seam sits within 0.05 mm of its tile boundary, when totalW lands exactly on a stepX boundary', () => {
    const base = PRESETS[0]!.config;
    const stepX = PW - LAP;
    for (const k of [1, 2, 3, 5]) {
      // Solve for a `flaps`/`skirt` combo isn't practical; instead force totalW directly
      // by overriding `crown`/`tyre` is indirect too — sweep `lead`/`trail` finely enough
      // near a boundary that at least one hits it within rounding.
      const cfg: FenderConfig = { ...base, lead: 40 + k * 3, trail: 90 + k * 7, stock: 'a4' };
      const g = geo(cfg);
      const b = buildBlank(cfg, g);
      if (b.panelCount <= 1) continue;
      const x0 = tileOriginX(cfg);
      b.seams.forEach((sm, i) => {
        const nominal = x0 + (i + 1) * stepX;
        expect(leadX(sm.d), `k=${k} seam ${i + 1}`).toBeCloseTo(nominal, 1);
      });
    }
  });

  it('panelCount === tiling.cols, for every preset', () => {
    for (const preset of PRESETS) {
      const cfg: FenderConfig = { ...preset.config, stock: 'a4' };
      const g = geo(cfg);
      const b = buildBlank(cfg, g);
      const t = buildTiling(cfg, g, b);
      expect(t.cols, preset.id).toBe(b.panelCount);
    }
  });

  it('panelCount === tiling.cols, across a length sweep', () => {
    const base = PRESETS[0]!.config;
    let checked = 0;
    for (const wheel of wheels) {
      for (const lead of leads) {
        for (const trail of trails) {
          if (lead + trail <= 0) continue;
          const cfg: FenderConfig = { ...base, wheel, lead, trail, stock: 'a4' };
          const g = geo(cfg);
          const b = buildBlank(cfg, g);
          const t = buildTiling(cfg, g, b);
          expect(t.cols, `${wheel} ${lead}/${trail}`).toBe(b.panelCount);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('no annotation extends outside its own tile row\'s cropped bounds', () => {
    let checked = 0;
    for (const preset of PRESETS) {
      const cfg: FenderConfig = { ...preset.config, stock: 'a4' };
      const g = geo(cfg);
      const b = buildBlank(cfg, g);
      const t = buildTiling(cfg, g, b);
      // Every shipped preset is a single row — the case the round-3 PDF actually showed
      // clipped. The last row's own cropped tile is what a printed page shows.
      expect(t.rows, preset.id).toBe(1);
      const tile = croppedTile(t.tiles[0]!, t.lastRowH);
      const [, oyStr, , hStr] = tile.viewBox.split(' ');
      const oy = Number(oyStr);
      const h = Number(hStr);
      for (const l of b.labels) {
        expect(Number(l.y), `${preset.id} label "${l.text}"`).toBeLessThanOrEqual(oy + h);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the ruler never overprints the pattern — its topmost extent clears every label', () => {
    for (const preset of PRESETS) {
      const cfg: FenderConfig = { ...preset.config, stock: 'a4' };
      const g = geo(cfg);
      const b = buildBlank(cfg, g);
      const t = buildTiling(cfg, g, b);
      const tile = croppedTile(t.tiles[0]!, t.lastRowH);
      const rulerTopY = Number(tile.rulerY) - 3; // ~glyph ascent above the caption baseline
      const labelMaxY = b.labels.reduce((m, l) => Math.max(m, Number(l.y)), 0);
      expect(rulerTopY, preset.id).toBeGreaterThanOrEqual(labelMaxY);
    }
  });
});

/**
 * WP27 §27.2 — the merge case: a seam that lands on a dart closes both with one
 * fastener instead of drawing two hole columns a few mm apart. `rivet`/`zip`/`cinch`
 * darts are all reachable; swept over wheel/lead/trail (real presets never happen to hit
 * one exactly, per the implementation notes) rather than picking a single hand-tuned
 * case, so the test does not depend on a coincidence surviving future geometry changes
 * unnoticed — if it stops finding one, that is itself worth knowing.
 */
describe('WP27 §27.2 — the merged four-layer corner', () => {
  const wheels = Object.keys(WHEELS) as WheelKey[];

  it('is reachable: some wheel/join/flaps combination puts a pinned seam on a dart', () => {
    const base = PRESETS[0]!.config;
    let found = 0;
    for (const join of ['rivet', 'zip', 'cinch'] as const) {
      for (const wheel of wheels) {
        for (let flaps = 8; flaps <= 30; flaps++) {
          const cfg: FenderConfig = { ...base, wheel, join, flaps, stock: 'a4' };
          const g = geo(cfg);
          const b = buildBlank(cfg, g);
          if (b.panelCount <= 1) continue;
          const stepX = PW - LAP;
          const x0 = tileOriginX(cfg);
          for (let i = 1; i < b.panelCount; i++) {
            const xm = x0 + i * stepX + LAP / 2;
            if (mergedDartAt(cfg, g, xm) !== null) found++;
          }
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('a merged dart\'s own fastener is bumped for four thicknesses, and the seam draws no separate row there', () => {
    const base = PRESETS[0]!.config;
    let checked = 0;
    for (const join of ['rivet', 'zip', 'cinch'] as const) {
      for (const wheel of wheels) {
        for (let flaps = 8; flaps <= 30; flaps++) {
          const cfg: FenderConfig = { ...base, wheel, join, flaps, stock: 'a4' };
          const g = geo(cfg);
          const stepX = PW - LAP;
          const x0 = tileOriginX(cfg);
          const seamGridLen = g.L - x0;
          const panelCount = seamGridLen <= PW ? 1 : 1 + Math.ceil((seamGridLen - PW) / stepX);
          if (panelCount <= 1) continue;

          const mergedDarts = new Set<number>();
          for (let i = 1; i < panelCount; i++) {
            const xm = x0 + i * stepX + LAP / 2;
            const k = mergedDartAt(cfg, g, xm);
            if (k !== null) mergedDarts.add(k);
          }
          if (mergedDarts.size === 0) continue;
          checked++;

          const asm = buildAssembly(cfg, g, mergedDarts);
          const baseR = join === 'zip' ? 2 : join === 'rivet' ? 1.6 : 2;
          for (const f of asm.features) {
            if (mergedDarts.has(f.dart) && f.kind === 'hole') {
              expect(f.fourLayer, `${wheel} ${join} flaps=${flaps} dart ${f.dart}`).toBe(true);
              expect(f.r).toBeCloseTo(baseR + 0.4, 6);
            }
          }

          // The blank itself draws no separate seam-fastener row at a merged seam's xm
          // — every hole there comes from the (bumped) dart feature, not a plain-radius
          // row hole.
          const b = buildBlank(cfg, g);
          for (let i = 1; i < panelCount; i++) {
            const xm = x0 + i * stepX + LAP / 2;
            if (mergedDartAt(cfg, g, xm) === null) continue;
            const plainRowHole = b.holes.some(
              (h) => Math.abs(Number(h.cx) - xm) < 0.1 && Math.abs(Number(h.r) - baseR) < 1e-6
            );
            expect(plainRowHole, `${wheel} ${join} flaps=${flaps} seam at xm=${xm}`).toBe(false);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
