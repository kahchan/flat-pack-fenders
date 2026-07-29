import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildNotes, buildSteps } from '../notes';
import type { FenderConfig } from '../types';

/**
 * golden.json's `steps` and `engNotes` are a verbatim transcription of the design
 * source (renderVals() lines ~1126–1156), including the two sentences PLAN §9.9 and
 * §9.4 correct. Everything except those two note bodies is asserted for exact string
 * equality against the fixture; the two corrections get their own tests below.
 */

type StepFixture = { n: string; title: string; body: string };
type NoteFixture = { title: string; body: string; formula: string };
type Case = { config: FenderConfig; steps: StepFixture[]; engNotes: NoteFixture[] };

const CASES = Object.entries(golden as unknown as Record<string, Case>);

describe.each(CASES)('buildSteps(%s)', (_name, c) => {
  it('matches the design source exactly, including conditional numbering', () => {
    expect(buildSteps(c.config)).toEqual(c.steps);
  });
});

// Index 9 = "Nesting" (PLAN §9.4), index 11 = "Bend allowance, properly" (PLAN §9.9).
// Both indices are 0-based positions in the 16-note engNotes array.
const CORRECTED_INDICES = new Set([9, 11]);

describe.each(CASES)('buildNotes(%s)', (_name, c) => {
  const notes = buildNotes(c.config);

  it('same titles, same order, same count as the design source', () => {
    expect(notes.map((n) => n.title)).toEqual(c.engNotes.map((n) => n.title));
  });

  it('formula strings match the design source exactly', () => {
    expect(notes.map((n) => n.formula)).toEqual(c.engNotes.map((n) => n.formula));
  });

  it('every body EXCEPT the two corrected notes matches the design source verbatim', () => {
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
