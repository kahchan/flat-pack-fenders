import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { WHEELS } from '../defaults';
import { geo } from '../geometry';
import { buildNotes, buildSteps } from '../notes';
import { buildBlank } from '../pattern';
import type { FenderConfig, WheelKey } from '../types';

/**
 * golden.json's `steps` and `engNotes` are a verbatim transcription of the design
 * source (renderVals() lines ~1126–1156), including the sentences PLAN §9.3, §9.4 and
 * §9.9 correct for factual reasons, and the wider copy pass PLAN FEEDBACK WP17 reworded
 * for style (dropping em-dashes/`·`, cutting AI-writing tells). Everything else is
 * asserted for exact string equality against the fixture; every divergence gets its own
 * entry in the index sets below, or its own test in the "corrected prose" block.
 */

type StepFixture = { n: string; title: string; body: string };
type NoteFixture = { title: string; body: string; formula: string };
type Case = { config: FenderConfig; steps: StepFixture[]; engNotes: NoteFixture[] };

const CASES = Object.entries(golden as unknown as Record<string, Case>);

// PLAN FEEDBACK WP17 — every step body below except "Tape the tiles" (1), "Fold the
// skirts" (4) and "Fit to the bike" (last) lost an em-dash, either split into two
// sentences or rejoined with a colon. Step 5, "Close the darts", reads from
// joinNote() (rivet/slot variants), which also lost one each. None of this changes
// numbering or count, only wording, so it stays out of the golden fixture (kept as
// the historical verbatim source) and is excluded here instead.
// WP19 §19.1/§19.5 adds index 1 ("Tape the tiles" — a4 stock's trim line is now the
// panel seam, so the step text says so) on top of the WP17 set above.
const CORRECTED_STEP_INDICES = new Set([0, 1, 2, 5, 6, 7, 8]);

describe.each(CASES)('buildSteps(%s)', (_name, c) => {
  it('matches the design source exactly, except the WP17 copy-pass steps (see CORRECTED_STEP_INDICES)', () => {
    const steps = buildSteps(c.config);
    steps.forEach((s, i) => {
      if (CORRECTED_STEP_INDICES.has(i) && i < steps.length - 1) return;
      expect(s, `step ${i} (${s.n} ${s.title})`).toEqual(c.steps[i]);
    });
  });

  it('numbering and titles still match the design source exactly, including conditional numbering', () => {
    const steps = buildSteps(c.config);
    expect(steps.map((s) => ({ n: s.n, title: s.title }))).toEqual(
      c.steps.map((s) => ({ n: s.n, title: s.title }))
    );
  });
});

// Index 8 = "Nesting" (PLAN §9.4), index 10 = "Bend allowance, properly" (PLAN §9.9).
// Both indices are 0-based positions in the 15-note engNotes array — one shorter than
// the design source's 16 since WP21 §21.2/§21.3 deletes "Sacrificial strut end"
// (formerly index 8) outright with the feature, rather than reworking it in place the
// way "Nesting" was for WP20. Every index at or after the old index 8 in the sets below
// is one lower than it would read in golden.json's (unmodified, 16-note) fixture.
//
// PLAN FEEDBACK WP17 extends this set with every other note whose body lost an
// em-dash: 1 "Radius chain", 2 "Taper is local, not global", 4 "Rear mounting", 6 "What
// a butt strap is", 11 "Darts get wider with thickness", 13 "Export", 14 "Still open".
// Only 0, 3, 5, 7, 9 and 12 keep their design-source body verbatim.
// WP19 §19.1/§19.5 adds 5 ("How the panel seam works" — OV/OVERLAP collapse to LAP,
// reworded in built terms) and 9 ("Print geometry" — tile overlap is now stock-
// dependent) on top of the WP17 set above.
// WP23 §23.1/§23.2 adds 0 ("Why the darts exist" → "Why the shingle exists": the
// surplus is now absorbed as lap, not cut away) — a factual correction, same category
// as §9.3/§9.4/§9.9, not a wording pass.
const CORRECTED_INDICES = new Set([0, 1, 2, 4, 5, 6, 8, 9, 10, 11, 13, 14]);

// Index 13 = "Export" (PLAN §9.3) — its `formula` line changes ("R12 ASCII" →
// "AC1015 (R2000)"); its body is ALSO reworded by WP17 (see CORRECTED_INDICES), unlike
// when this set was first written.
//
// PLAN FEEDBACK WP17 extends this set with every other note whose `formula` lost a `·`
// separator or used it for multiplication (now `,`/`;`/`×`): 4 "Rear mounting", 5 "How
// the panel seam works", 6 "What a butt strap is", 7 "Every hole is a crack initiator",
// 10 "Bend allowance, properly", 11 "Darts get wider with thickness", 12 "Hemmed edge".
// WP20 §20.1 adds 8 ("Nesting" — formula is now always "removed", not conditional on
// `s.nest`, since the feature no longer exists to condition on).
// WP23 §23.2 adds 0 ("Why the darts exist" — the formula now reports `lap`, not `notch`).
const CORRECTED_FORMULA_INDICES = new Set([0, 4, 5, 6, 7, 8, 10, 11, 12, 13]);

describe.each(CASES)('buildNotes(%s)', (_name, c) => {
  const notes = buildNotes(c.config);
  // WP21 §21.2/§21.3 — golden.json is the unmodified 16-note design-source transcription
  // (see the module doc comment); "Sacrificial strut end" is filtered out here so the
  // remaining 15 stay index-aligned with `notes`, the same way the note itself was
  // deleted from `buildNotes()` rather than reworked in place.
  const goldenNotes = c.engNotes.filter((n) => n.title !== 'Sacrificial strut end');

  it('same titles, same order, one fewer than the design source (Sacrificial strut end retired)', () => {
    expect(notes.map((n) => n.title)).toEqual(goldenNotes.map((n) => n.title));
  });

  it('formula strings match the design source exactly, except the DXF header wording (PLAN §9.3) and the WP17 copy pass', () => {
    notes.forEach((n, i) => {
      if (CORRECTED_FORMULA_INDICES.has(i)) return;
      expect(n.formula, `note ${i} (${n.title})`).toBe(goldenNotes[i]!.formula);
    });
  });

  it('every body EXCEPT the corrected/reworded notes matches the design source verbatim', () => {
    notes.forEach((n, i) => {
      if (CORRECTED_INDICES.has(i)) return;
      expect(n.body, `note ${i} (${n.title})`).toBe(goldenNotes[i]!.body);
    });
  });
});

describe('corrected prose', () => {
  const base = CASES[0]![1].config;
  const baseFixture = CASES[0]![1];

  it('"Nesting" states the feature is removed — WP20 §20.1', () => {
    const nesting = buildNotes(base)[8]!;
    expect(nesting.title).toBe('Nesting');
    expect(nesting.body).not.toBe(baseFixture.engNotes[9]!.body);
    expect(nesting.body).toMatch(/^Removed\./);
    expect(nesting.formula).toBe('removed');
  });

  it('"Bend allowance, properly" drops the false zero-thickness claim — PLAN §9.9', () => {
    const bend = buildNotes(base)[10]!;
    expect(bend.title).toBe('Bend allowance, properly');
    expect(bend.body).not.toBe(baseFixture.engNotes[11]!.body);
    expect(bend.body).not.toMatch(/every term collapses to zero/);
    // New wording: the dart term reaches the ideal; the bend term does not reach zero.
    expect(bend.body).toMatch(/dart term reaches the ideal/);
    expect(bend.body).toMatch(/bend term falls to a few hundredths/);
  });

  it('"Export" formula drops the false "R12 ASCII" claim — PLAN §9.3', () => {
    const exportNote = buildNotes(base)[13]!;
    expect(exportNote.title).toBe('Export');
    // Body also lost an em-dash in the WP17 copy pass (colon now introduces the
    // "a laser wants..." reason), on top of the §9.3 formula fix below.
    expect(exportNote.body).not.toBe(baseFixture.engNotes[14]!.body);
    expect(exportNote.body).not.toMatch(/—/);
    expect(exportNote.formula).not.toBe(baseFixture.engNotes[14]!.formula);
    expect(exportNote.formula).not.toMatch(/R12 ASCII/);
    expect(exportNote.formula).toMatch(/AC1015 \(R2000\)/);
  });

  // WP21 §21.2/§21.3 — "Sacrificial strut end" (golden.json index 8) is deleted with
  // the fuse feature it described, not reworked in place, so `buildNotes()` output has
  // one fewer note than the fixture and no note at that title exists any more.
  it('"Sacrificial strut end" is gone — WP21 §21.2/§21.3', () => {
    const notes = buildNotes(base);
    expect(notes.some((n) => n.title === 'Sacrificial strut end')).toBe(false);
    expect(notes.length).toBe(baseFixture.engNotes.length - 1);
  });

  it('"Bend the struts" names the actual strutEnd choice, not all three fastenings — WP21 §21.3', () => {
    const bolt = buildSteps({ ...base, strutEnd: 'bolt' }).find((s) => s.title === 'Bend the struts')!;
    const strap = buildSteps({ ...base, strutEnd: 'strap' }).find((s) => s.title === 'Bend the struts')!;
    expect(bolt.body).not.toBe(strap.body);
    expect(bolt.body).not.toMatch(/velcro/i);
    expect(strap.body).toMatch(/25 mm/);
    expect(strap.body).toMatch(/hook-and-loop/);
    expect(strap.body).not.toMatch(/velcro/i);
  });
});

describe('note invariants', () => {
  it('every note has a non-empty title and body; only the last note may have an empty formula', () => {
    for (const [, c] of CASES) {
      const notes = buildNotes(c.config);
      notes.forEach((n, i) => {
        expect(n.title.length, `note ${i} title`).toBeGreaterThan(0);
        expect(n.body.length, `note ${i} body`).toBeGreaterThan(0);
        if (i < notes.length - 1) {
          expect(n.formula.length, `note ${i} (${n.title}) formula`).toBeGreaterThan(0);
        }
      });
      expect(notes[notes.length - 1]!.formula).toBe('');
    }
  });
});

describe('assembly step numbering', () => {
  const base = CASES[0]![1].config;

  const combos: [string, Partial<FenderConfig>][] = [
    ['panelled + mudflap', { stock: 'a4', mudflap: 100 }],
    ['panelled + no mudflap', { stock: 'a4', mudflap: 0 }],
    ['single + mudflap', { stock: 'single', mudflap: 100 }],
    ['single + no mudflap', { stock: 'single', mudflap: 0 }]
  ];

  it.each(combos)('%s renumbers contiguously from 01 and ends LAST', (_label, patch) => {
    const cfg: FenderConfig = { ...base, ...patch };
    const steps = buildSteps(cfg);

    expect(steps[0]!.n).toBe('01');
    expect(steps[steps.length - 1]!.n).toBe('LAST');

    const numeric = steps.slice(0, -1).map((s) => Number(s.n));
    numeric.forEach((n, i) => {
      expect(n, `step ${i}`).toBe(i + 1);
    });
  });

  it('panelling and mudflap each add exactly one extra step', () => {
    const neither = buildSteps({ ...base, stock: 'single', mudflap: 0 });
    const panelOnly = buildSteps({ ...base, stock: 'a4', mudflap: 0 });
    const mudflapOnly = buildSteps({ ...base, stock: 'single', mudflap: 100 });
    const both = buildSteps({ ...base, stock: 'a4', mudflap: 100 });

    expect(panelOnly.length).toBe(neither.length + 1);
    expect(mudflapOnly.length).toBe(neither.length + 1);
    expect(both.length).toBe(neither.length + 2);
  });
});

/**
 * WP33 §9.40 — `mountPositions()` in notes.ts used to recompute the pre-nudge mount x
 * itself, mirroring pattern.ts's private maths, so the assembly-steps copy could read up
 * to 15 mm off the slot `nudgeAway` actually cuts. `buildBlank` now resolves the nudge
 * once and `notes.ts` reads `blank.mounts` — these tests pin that reading, and the first
 * one specifically exercises a config where the nudge fires, not just an un-nudged one.
 */
describe('WP33 — engineering notes quote the actual, post-nudge mount x', () => {
  const wheels = Object.keys(WHEELS) as WheelKey[];
  const base = CASES[0]![1].config;

  // Nominal (pre-nudge) mount x, reproduced here ONLY to detect whether a given config's
  // nudge fired — never fed back into the app, per the plan's ban on a second copy of the
  // nudge logic in notes.ts itself.
  function nominalMountXs(s: FenderConfig, L: number, cov: number): number[] {
    const xTDC = (s.lead / Math.max(1, cov)) * L;
    return s.side === 'front' ? [xTDC] : [Math.min(xTDC * 0.4, L - 40), xTDC];
  }

  it('finds a config where a mount is actually nudged, then matches its slot within 0.05 mm', () => {
    let found: { cfg: FenderConfig; blank: ReturnType<typeof buildBlank> } | null = null;

    outer: for (const wheel of wheels) {
      for (const side of ['front', 'rear'] as const) {
        for (const stock of ['a4', 'single'] as const) {
          for (let flaps = 8; flaps <= 30; flaps++) {
            const cfg: FenderConfig = { ...base, wheel, side, stock, flaps };
            const g = geo(cfg);
            const b = buildBlank(cfg, g);
            const nominal = nominalMountXs(cfg, g.L, g.cov);
            const nudged = b.mounts.some((m, i) => Math.abs(m.x - nominal[i]!) > 0.01);
            if (nudged) {
              found = { cfg, blank: b };
              break outer;
            }
          }
        }
      }
    }

    expect(found, 'expected at least one config to trigger nudgeAway on a mount').not.toBeNull();
    const { cfg, blank } = found!;

    // Confirm the nudge really fired (not a false positive from float noise).
    const g = geo(cfg);
    const nominal = nominalMountXs(cfg, g.L, g.cov);
    const anyNudged = blank.mounts.some((m, i) => Math.abs(m.x - nominal[i]!) > 0.01);
    expect(anyNudged, 'sanity check: the found config must actually nudge a mount').toBe(true);

    const notes = buildNotes(cfg, g, blank);
    const mountNote = notes.find((n) => n.title === 'Front mounting' || n.title === 'Rear mounting')!;

    blank.mounts.forEach((m) => {
      const slot = blank.slots.find((s) => Math.abs(Number(s.x) + 8 - m.x) < 0.06);
      expect(slot, `no matching slot for mount "${m.label}" at x=${m.x}`).toBeDefined();
      expect(Number(slot!.x) + 8, `slot x for "${m.label}"`).toBeCloseTo(m.x, 1);

      const quoted = mountNote.formula.match(new RegExp(`${m.label} at (-?[\\d.]+) mm`));
      expect(quoted, `"${m.label}" not quoted in formula: ${mountNote.formula}`).not.toBeNull();
      const quotedX = Number(quoted![1]);
      expect(Math.abs(quotedX - (Number(slot!.x) + 8)), `${m.label} quoted vs slot`).toBeLessThanOrEqual(0.5);
    });
  });

  it('pins engineering-notes mount numbers against blank.slots directly, for every golden case', () => {
    let checked = 0;
    for (const [name, c] of CASES) {
      const g = geo(c.config);
      const blank = buildBlank(c.config, g);
      const notes = buildNotes(c.config, g, blank);
      const mountNote = notes.find((n) => n.title === 'Front mounting' || n.title === 'Rear mounting');
      if (!mountNote) continue;

      blank.mounts.forEach((m) => {
        const slot = blank.slots.find((s) => Math.abs(Number(s.x) + 8 - m.x) < 0.06);
        expect(slot, `${name}: no matching slot for "${m.label}"`).toBeDefined();

        const quoted = mountNote.formula.match(new RegExp(`${m.label} at (-?[\\d.]+) mm`));
        expect(quoted, `${name}: "${m.label}" not quoted in formula: ${mountNote.formula}`).not.toBeNull();
        const quotedX = Number(quoted![1]);
        expect(Math.abs(quotedX - (Number(slot!.x) + 8)), `${name} ${m.label}`).toBeLessThanOrEqual(0.5);
      });
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
