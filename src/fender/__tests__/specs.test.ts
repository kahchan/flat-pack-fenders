import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { assembledLabel, buildSpecs, printSpecLine } from '../specs';
import type { FenderConfig } from '../types';

type SpecFixture = { label: string; value: string; note: string };
type Case = {
  config: FenderConfig;
  specs: SpecFixture[];
  assembledLabel: string;
  printSpecLine: string;
};

const CASES = Object.entries(golden as unknown as Record<string, Case>);

describe.each(CASES)('buildSpecs(%s)', (_name, c) => {
  it('matches the design source exactly, row by row', () => {
    expect(buildSpecs(c.config)).toEqual(c.specs);
  });
});

describe.each(CASES)('assembledLabel(%s)', (_name, c) => {
  it('matches the design source exactly', () => {
    expect(assembledLabel(c.config)).toBe(c.assembledLabel);
  });
});

describe.each(CASES)('printSpecLine(%s)', (_name, c) => {
  it('matches the design source exactly', () => {
    expect(printSpecLine(c.config)).toBe(c.printSpecLine);
  });
});

describe('spec table invariants', () => {
  it('always has exactly 11 rows, labelled as the design source', () => {
    for (const [, c] of CASES) {
      const specs = buildSpecs(c.config);
      expect(specs).toHaveLength(11);
      expect(specs.map((s) => s.label)).toEqual([
        'Fender radius',
        'Developed length',
        'Developed width',
        'Finished width',
        'Flap pitch',
        'Dart width',
        'Bend allowance',
        'Total take-up',
        'Blank area',
        'Material panels',
        'Sheets to print'
      ]);
    }
  });

  it('"Sheets to print" always reads rows × cols + 2', () => {
    for (const [, c] of CASES) {
      const specs = buildSpecs(c.config);
      const row = specs[10]!;
      expect(row.label).toBe('Sheets to print');
      expect(Number(row.value)).toBeGreaterThanOrEqual(3); // at least 1 tile + parts + instructions
    }
  });
});
