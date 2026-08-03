import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../fender/defaults';
import { geo } from '../../fender/geometry';
import { buildCrossSection } from '../../fender/crossSection';
import { buildParts } from '../../fender/parts';
import {
  buildEssentialSliders,
  buildFineTuningClusters,
  hemHint,
  partsFitNote,
  partsSizeLabel,
  stockNotes
} from '../controlText';

describe('buildEssentialSliders / buildFineTuningClusters', () => {
  const g = geo(DEFAULTS);
  const xsec = buildCrossSection(DEFAULTS, g);
  const essentials = buildEssentialSliders(DEFAULTS, g);
  const clusters = buildFineTuningClusters(DEFAULTS, g, xsec.finished);

  it('has the four fine-tuning clusters in order (§22.2)', () => {
    expect(clusters.map((c) => c.title)).toEqual([
      'Shape',
      'Coverage',
      'Construction',
      'Struts & mudflap'
    ]);
  });

  it('covers all 15 slider-bound config fields exactly once across essentials + clusters', () => {
    const keys = [
      ...essentials.map((i) => i.key),
      ...clusters.flatMap((c) => c.items.map((i) => i.key))
    ];
    expect(keys).toEqual([
      'tyre',
      'measuredR',
      'clear',
      'crown',
      'skirt',
      'angle',
      'taper',
      'taperAt',
      'lead',
      'trail',
      'flaps',
      'thick',
      'struts',
      'strutLen',
      'mudflap'
    ]);
  });

  it('reads "estimate" for measuredR at zero, and mm once set', () => {
    expect(essentials[1]!.display).toBe('estimate');
    const g2 = geo({ ...DEFAULTS, measuredR: 300 });
    const essentials2 = buildEssentialSliders({ ...DEFAULTS, measuredR: 300 }, g2);
    expect(essentials2[1]!.display).toBe('300 mm');
  });

  it('reads "none" for mudflap at zero', () => {
    const g2 = geo({ ...DEFAULTS, mudflap: 0 });
    const clusters2 = buildFineTuningClusters({ ...DEFAULTS, mudflap: 0 }, g2, xsec.finished);
    expect(clusters2[3]!.items[2]!.display).toBe('none');
  });

  it('bend allowance hint carries an explicit sign', () => {
    const construction = clusters.find((c) => c.title === 'Construction')!;
    const thickItem = construction.items.find((i) => i.key === 'thick')!;
    expect(thickItem.hint).toContain(`${g.bendComp >= 0 ? '+' : ''}`);
  });

  it('pulls slider bounds from PARAM_SPECS', () => {
    const tyreItem = essentials[0]!;
    expect(tyreItem).toMatchObject({ min: 20, max: 90, step: 1 });
  });
});

describe('hemHint', () => {
  it('prompts for a thickness when there is none', () => {
    expect(hemHint({ ...DEFAULTS, thick: 0 })).toBe('Set a material thickness first');
  });

  it('reports the fold-back distance once thickness is set', () => {
    expect(hemHint({ ...DEFAULTS, thick: 0.8 })).toBe(
      'Folds 6 mm back on itself: stiffer, no sharp edge'
    );
  });
});

describe('stockNotes', () => {
  it('reports single-sheet stock length and A4 panel count', () => {
    const g = geo(DEFAULTS);
    const notes = stockNotes(g);
    expect(notes.single).toMatch(/mm in one piece$/);
    expect(notes.a4).toMatch(/panels, 20 mm laps$/);
  });
});

describe('partsSizeLabel / partsFitNote', () => {
  it('summarises struts, mudflap and join hardware', () => {
    const g = geo(DEFAULTS);
    const parts = buildParts(DEFAULTS, g);
    expect(partsSizeLabel(DEFAULTS, parts)).toBe('2 struts, 1 mudflap');
  });

  it('adds hardware count for rivet/slot joins', () => {
    const config = { ...DEFAULTS, join: 'rivet' as const, mudflap: 0 };
    const g = geo(config);
    const parts = buildParts(config, g);
    expect(partsSizeLabel(config, parts)).toContain('butt strap');
  });

  it('flags when Sheet B is too wide for A4', () => {
    const config = { ...DEFAULTS, strutLen: 420, struts: 6 };
    const g = geo(config);
    const parts = buildParts(config, g);
    expect(partsFitNote(parts)).toBe(
      parts.fitsA4 ? 'fits A4 at full size' : 'wider than A4: cut struts by measurement'
    );
  });
});
