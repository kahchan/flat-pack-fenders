import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildNotes, buildSteps } from '../notes';
import type { FenderConfig } from '../types';

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
const CORRECTED_STEP_INDICES = new Set([0, 2, 5, 6, 7, 8]);

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

// Index 9 = "Nesting" (PLAN §9.4), index 11 = "Bend allowance, properly" (PLAN §9.9).
// Both indices are 0-based positions in the 16-note engNotes array.
//
// PLAN FEEDBACK WP17 extends this set with every other note whose body lost an
// em-dash: 1 "Radius chain", 2 "Taper is local, not global", 4 "Rear mounting", 6 "What
// a butt strap is", 12 "Darts get wider with thickness", 14 "Export", 15 "Still open".
// Only 0, 3, 5, 7, 8, 10 and 13 keep their design-source body verbatim.
const CORRECTED_INDICES = new Set([1, 2, 4, 6, 9, 11, 12, 14, 15]);

// Index 14 = "Export" (PLAN §9.3) — its `formula` line changes ("R12 ASCII" →
// "AC1015 (R2000)"); its body is ALSO reworded by WP17 (see CORRECTED_INDICES), unlike
// when this set was first written.
//
// PLAN FEEDBACK WP17 extends this set with every other note whose `formula` lost a `·`
// separator or used it for multiplication (now `,`/`;`/`×`): 4 "Rear mounting", 5 "How
// the panel seam works", 6 "What a butt strap is", 7 "Every hole is a crack initiator",
// 8 "Sacrificial strut end", 11 "Bend allowance, properly", 12 "Darts get wider with
// thickness", 13 "Hemmed edge".
const CORRECTED_FORMULA_INDICES = new Set([4, 5, 6, 7, 8, 11, 12, 13, 14]);

describe.each(CASES)('buildNotes(%s)', (_name, c) => {
  const notes = buildNotes(c.config);

  it('same titles, same order, same count as the design source', () => {
    expect(notes.map((n) => n.title)).toEqual(c.engNotes.map((n) => n.title));
  });

  it('formula strings match the design source exactly, except the DXF header wording (PLAN §9.3) and the WP17 copy pass', () => {
    notes.forEach((n, i) => {
      if (CORRECTED_FORMULA_INDICES.has(i)) return;
      expect(n.formula, `note ${i} (${n.title})`).toBe(c.engNotes[i]!.formula);
    });
  });

  it('every body EXCEPT the corrected/reworded notes matches the design source verbatim', () => {
    notes.forEach((n, i) => {
      if (CORRECTED_INDICES.has(i)) return;
      expect(n.body, `note ${i} (${n.title})`).toBe(c.engNotes[i]!.body);
    });
  });
});

describe('corrected prose', () => {
  const base = CASES[0]![1].config;
  const baseFixture = CASES[0]![1];

  it('"Nesting" drops the false "shared edge" claim — PLAN §9.4', () => {
    const nesting = buildNotes(base)[9]!;
    expect(nesting.title).toBe('Nesting');
    // The source's claim, which the geometry (translate(L, Wd·2+10) rotate(180)) does
    // not support — there's a 10 mm gap, not a shared edge.
    expect(nesting.body).not.toBe(baseFixture.engNotes[9]!.body);
    expect(nesting.body).not.toMatch(/cut the shared edge once/i);
    expect(nesting.body).toMatch(/10 mm/);
  });

  it('"Bend allowance, properly" drops the false zero-thickness claim — PLAN §9.9', () => {
    const bend = buildNotes(base)[11]!;
    expect(bend.title).toBe('Bend allowance, properly');
    expect(bend.body).not.toBe(baseFixture.engNotes[11]!.body);
    expect(bend.body).not.toMatch(/every term collapses to zero/);
    // New wording: the dart term reaches the ideal; the bend term does not reach zero.
    expect(bend.body).toMatch(/dart term reaches the ideal/);
    expect(bend.body).toMatch(/bend term falls to a few hundredths/);
  });

  it('"Export" formula drops the false "R12 ASCII" claim — PLAN §9.3', () => {
    const exportNote = buildNotes(base)[14]!;
    expect(exportNote.title).toBe('Export');
    // Body also lost an em-dash in the WP17 copy pass (colon now introduces the
    // "a laser wants..." reason), on top of the §9.3 formula fix below.
    expect(exportNote.body).not.toBe(baseFixture.engNotes[14]!.body);
    expect(exportNote.body).not.toMatch(/—/);
    expect(exportNote.formula).not.toBe(baseFixture.engNotes[14]!.formula);
    expect(exportNote.formula).not.toMatch(/R12 ASCII/);
    expect(exportNote.formula).toMatch(/AC1015 \(R2000\)/);
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
