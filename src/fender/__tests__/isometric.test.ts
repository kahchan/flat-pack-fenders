import { describe, expect, it } from 'vitest';
import { buildIsometric, NS } from '../isometric';
import { buildBlank } from '../pattern';
import { DEFAULTS } from '../defaults';
import { geo } from '../geometry';
import { PRESETS } from '../../state/presets';
import type { FenderConfig } from '../types';

/**
 * WP28 §28.2 (decision C5): the preview renders real cut geometry — real section
 * count on the skirt, a real thickness step, and every hole/slot/tongue/strut/mudflap
 * as actual geometry — not a fixed-`NS` shaded proxy for it. The old golden-diff
 * fixture (a verbatim `NS`-segment sweep that never read `g.n` at all) is gone with
 * the geometry it pinned; these tests assert the WP28 verify checklist instead:
 * skirt facet count === g.n, the crown stays smooth, the lap step and thickness are
 * real and disappear at zero, every join's fastener geometry differs sensibly, and a
 * dartless config renders without artefacts.
 */

function facetCount(config: FenderConfig): { skirt: number; crown: number; edges: number; risers: number } {
  const g = geo(config);
  const iso = buildIsometric(config, g);
  const nSkirt = Math.max(1, g.n);
  const skirt = 2 * nSkirt;
  const crown = nSkirt;
  const edges = g.t > 0 ? 2 * nSkirt : 0;
  const risers = g.lap > 0 && nSkirt > 1 ? 2 * (nSkirt - 1) : 0;
  expect(iso.facets.length).toBe(skirt + crown + edges + risers);
  return { skirt, crown, edges, risers };
}

describe('buildIsometric — skirt facet count (WP28 §28.1/§28.2)', () => {
  // WP31: the crown facets at `g.n` too. It kept a fixed `NS` sweep on the argument that
  // a bent sheet is a developable cylinder — true of the flat blank, false of the folded
  // part, which is a channel and creases at the dart slits rather than curving. Nothing
  // about the fender is drawn at a fixed segment count now.
  it('every band facets at g.n — skirt 2 per section, crown 1', () => {
    for (const flaps of [6, 22]) {
      const config = { ...DEFAULTS, flaps };
      const g = geo(config);
      const c = facetCount(config);
      expect(c.skirt).toBe(2 * g.n);
      expect(c.crown).toBe(g.n);
      expect(c.crown).not.toBe(NS);
    }
  });

  it('setting flaps to 6 vs 22 visibly changes the section count', () => {
    const six = buildIsometric({ ...DEFAULTS, flaps: 6 });
    const twentyTwo = buildIsometric({ ...DEFAULTS, flaps: 22 });
    expect(six.facets.length).not.toBe(twentyTwo.facets.length);
  });

  // WP31 inverts this: the crown tracks the flap count like everything else. A fender
  // whose crown looked identical at 6 and 22 sections was drawing a shape it never takes.
  it('crown facet count tracks flaps, exactly like the skirt', () => {
    const g6 = geo({ ...DEFAULTS, flaps: 6 });
    const g22 = geo({ ...DEFAULTS, flaps: 22 });
    const c6 = facetCount({ ...DEFAULTS, flaps: 6 });
    const c22 = facetCount({ ...DEFAULTS, flaps: 22 });
    expect(c6.crown).not.toBe(c22.crown);
    expect(c6.crown).toBe(g6.n);
    expect(c22.crown).toBe(g22.n);
    expect(c6.skirt).not.toBe(c22.skirt);
    expect(c6.skirt).toBe(2 * g6.n);
    expect(c22.skirt).toBe(2 * g22.n);
  });

  it('every preset renders with skirt facet count exactly 2 × its flap count', () => {
    for (const preset of PRESETS) {
      facetCount(preset.config);
    }
  });
});

describe('buildIsometric — real thickness and the lap step (WP28 §28.2)', () => {
  it('draws a free-edge thickness facet per skirt section when thick > 0, none at thick = 0', () => {
    const withThick = facetCount({ ...DEFAULTS, thick: 0.8 });
    const noThick = facetCount({ ...DEFAULTS, thick: 0 });
    expect(withThick.edges).toBeGreaterThan(0);
    expect(noThick.edges).toBe(0);
  });

  it('draws a riser facet at every interior dart when there is a real lap, none when dartless', () => {
    const withLap = facetCount({ ...DEFAULTS, flaps: 20 });
    expect(withLap.risers).toBeGreaterThan(0);
    expect(withLap.risers).toBe(2 * (withLap.skirt / 2 - 1));

    // A dartless config (WP23 §23.2's real branch, flaps <= 1) has no interior dart to
    // riser at all — one panel spans the whole arc, and geo() itself guards flaps <= 1
    // rather than only relying on the flaps slider's own floor (4) to keep it away.
    const dartless = facetCount({ ...DEFAULTS, flaps: 1 });
    expect(dartless.risers).toBe(0);
    expect(dartless.skirt).toBe(2);
  });

  it('a dartless config (flaps <= 1) renders without NaN/Infinity anywhere', () => {
    for (const flaps of [0, 1]) {
      const config = { ...DEFAULTS, flaps };
      const iso = buildIsometric(config);
      const allD = [
        ...iso.facets.map((f) => f.d),
        ...iso.edges.map((e) => e.d),
        ...iso.outline.map((o) => o.d),
        ...iso.wheel.map((w) => w.d)
      ].join(' ');
      expect(allD).not.toMatch(/NaN|Infinity/);
      expect(iso.viewBox).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('buildIsometric — join fastener geometry (WP23 §23.3/§23.6 in 3D)', () => {
  const base = DEFAULTS;

  it('the punched tongue is ONE opening per side per dart, not two (WP29 §29.3)', () => {
    const g = geo(base);
    const darts = g.n - 1;
    const none = buildIsometric({ ...base, join: 'none' });
    const cinch = buildIsometric({ ...base, join: 'cinch' });
    const zip = buildIsometric({ ...base, join: 'zip' });
    const rivet = buildIsometric({ ...base, join: 'rivet' });
    const slot = buildIsometric({ ...base, join: 'slot' });

    expect(none.slots).toEqual([]);
    expect(cinch.slots).toEqual([]);
    expect(zip.slots).toEqual([]);
    expect(rivet.slots).toEqual([]);
    // The tongue passes THROUGH its slot, so on the assembled fender they occupy one
    // place — one quad per side. Round 3 drew two, at ±lap/4, which is the flat-pattern
    // pair transcribed into 3D: a tongue that never met its own slot. They separate only
    // when the two panels are unrolled, and there the blank does carry both.
    expect(slot.slots.length).toBe(darts * 2);
  });

  it('none pierces nothing; cinch/rivet/zip/slot each add real fastener geometry', () => {
    const none = buildIsometric({ ...base, join: 'none' });
    const cinch = buildIsometric({ ...base, join: 'cinch' });
    const zip = buildIsometric({ ...base, join: 'zip' });
    const rivet = buildIsometric({ ...base, join: 'rivet' });
    const slot = buildIsometric({ ...base, join: 'slot' });

    // 'none' and 'slot' pierce no holes at the dart at all (slot's fastener is the
    // tongue/slot quads above, not circular holes) — both differ from cinch/zip/rivet
    // only by strut-hole count, so they must be equal to each other.
    expect(slot.holes.length).toBe(none.holes.length);
    expect(cinch.holes.length).toBeGreaterThan(none.holes.length);
    expect(rivet.holes.length).toBeGreaterThan(none.holes.length);
    // A zip stitch and a cinch tie draw the SAME number of openings in 3D, for different
    // reasons: zip has two depths each piercing both layers at one point, cinch has one
    // hole on each of the two panels. Round 3 had zip drawing twice as many, because a
    // through-lap fastener was placed at two arc positions when the built fender has one
    // (§9.36) — so `zip > cinch` was an assertion about the bug.
    expect(zip.holes.length).toBe(cinch.holes.length);
    expect(zip.holes.length).toBeGreaterThan(none.holes.length);
  });

  it('a dart seam line is drawn for every dart regardless of join', () => {
    const g = geo(base);
    const iso = buildIsometric(base);
    expect(iso.seams.length).toBe(2 * (g.n - 1));
  });
});

describe('isometric invariants', () => {
  const base = DEFAULTS;

  it('spin changes the projection: spin=0 and the default (18) differ', () => {
    const flat = buildIsometric(base, undefined, 0);
    const defaulted = buildIsometric(base);
    expect(defaulted.outline[0]!.d).not.toBe(flat.outline[0]!.d);
    expect(defaulted.edges.map((e) => e.d)).not.toEqual(flat.edges.map((e) => e.d));
  });

  it('omitting spin uses the source default of 18°', () => {
    expect(buildIsometric(base)).toEqual(buildIsometric(base, undefined, 18));
  });

  it('mudflap is present iff config.mudflap > 0', () => {
    expect(buildIsometric({ ...base, mudflap: 0 }).mudflap).toEqual([]);
    expect(buildIsometric({ ...base, mudflap: 100 }).mudflap.length).toBe(1);
  });

  it('two strut fastener holes and one strut quad per side, per strut in blank.strutFrac', () => {
    const blank = buildBlank(base, geo(base));
    const iso = buildIsometric(base, geo(base), 18, blank);
    expect(iso.struts.length).toBe(blank.strutFrac.length * 2);
  });

  it('the isometric struts use the SAME arc positions as the blank, not a recomputation', () => {
    const g = geo(base);
    const realBlank = buildBlank(base, g);
    const drifted = { ...realBlank, strutFrac: realBlank.strutFrac.map((fr) => fr * 0.5) };
    const real = buildIsometric(base, g, 18, realBlank);
    const withDrifted = buildIsometric(base, g, 18, drifted);
    expect(withDrifted.struts.map((p) => p.d)).not.toEqual(real.struts.map((p) => p.d));
  });
});

// PLAN §14 — the wheel ghost is drawn from tyreR/tyre/spin alone, never from
// crown/skirt/clear, so it must render byte-identical while those change; the viewBox
// is floored on that same wheel extent, so a config that stays within it must not move.
describe('buildIsometric viewBox envelope (PLAN §14)', () => {
  it('the wheel ghost is independent of crown, skirt and clearance', () => {
    const a = buildIsometric(DEFAULTS);
    const wideCrown = buildIsometric({ ...DEFAULTS, crown: 140 });
    const deepSkirt = buildIsometric({ ...DEFAULTS, skirt: 70 });
    const bigClear = buildIsometric({ ...DEFAULTS, clear: 40 });

    expect(wideCrown.wheel).toEqual(a.wheel);
    expect(deepSkirt.wheel).toEqual(a.wheel);
    expect(bigClear.wheel).toEqual(a.wheel);
  });

  it('the wheel ghost does change with tyre width, since that IS the wheel', () => {
    const a = buildIsometric(DEFAULTS);
    const wideTyre = buildIsometric({ ...DEFAULTS, tyre: 90 });
    expect(wideTyre.wheel).not.toEqual(a.wheel);
  });

  it('viewBox width holds steady for a crown change that stays within the wheel envelope', () => {
    // No struts/mudflap and a small arc, so the model's own content stays under the
    // wheel-anchored floor across this crown range, demonstrating the floor holds.
    const small: FenderConfig = {
      ...DEFAULTS,
      lead: 10,
      trail: 10,
      mudflap: 0,
      struts: 0,
      strutLen: 0,
      skirt: 0,
      crown: 30
    };
    const wideCrown: FenderConfig = { ...small, crown: 90 };
    const bw = (vb: string) => Number(vb.split(' ')[2]);
    expect(bw(buildIsometric(wideCrown).viewBox)).toBe(bw(buildIsometric(small).viewBox));
  });

  it('widens once the fender genuinely exceeds the wheel envelope', () => {
    const small = buildIsometric({ ...DEFAULTS, crown: 30 });
    const huge = buildIsometric({ ...DEFAULTS, crown: 140 });
    expect(huge.viewBox).not.toBe(small.viewBox);
  });
});
