import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { buildCrossSection } from '../crossSection';
import { DEFAULTS } from '../defaults';
import { geo } from '../geometry';
import type { FenderConfig } from '../types';

type XsecPathFixture = { d: string; fill: string; stroke: string; sw: number; dash: string };
type LabelFixture = {
  x: number | string;
  y: number | string;
  size: number;
  fill: string;
  anchor: string;
  text: string;
};
type Case = {
  config: FenderConfig;
  xsec: { paths: XsecPathFixture[]; labels: LabelFixture[]; viewBox: string; finished: number };
};

const CASES = Object.entries(golden as unknown as Record<string, Case>);

// The fixture (extract-golden.mjs) stores the source's raw hex, since it's a verbatim
// transcription. The port returns `var(--draw-*)` tokens instead (hard rule: colours are
// tokens, never hex). Rather than compare colours as opaque strings, map the fixture's
// hex to the token we expect and assert on the mapped value — see PLAN §9 / task brief.
const HEX_TO_TOKEN: Record<string, string> = {
  '#EDE8DC': 'var(--draw-xsec-tyre)',
  '#A8A49C': 'var(--draw-ghost)',
  '#FAF8F3': 'var(--draw-xsec-rim)',
  '#8898A8': 'var(--draw-label-dim)',
  '#D4614E': 'var(--draw-xsec-gap)',
  '#1A2232': 'var(--draw-cut)' // path stroke; see LABEL_HEX_TO_TOKEN for the label fill
};

// The "FINISHED" label uses the same #1A2232 hex as the cut-line stroke, but semantically
// it's text, not a cut line — mapped to the dedicated label token instead.
const LABEL_HEX_TO_TOKEN: Record<string, string> = {
  ...HEX_TO_TOKEN,
  '#1A2232': 'var(--draw-label)'
};

describe.each(CASES)('buildCrossSection(%s)', (_name, c) => {
  const xs = buildCrossSection(c.config);
  const fixture = c.xsec;
  const g = geo(c.config);

  it('path geometry (d, sw, dash) matches exactly', () => {
    expect(xs.paths.map((p) => ({ d: p.d, sw: p.sw, dash: p.dash }))).toEqual(
      fixture.paths.map((p) => ({ d: p.d, sw: p.sw, dash: p.dash }))
    );
  });

  it('path colours map to the expected draw tokens', () => {
    expect(xs.paths.map((p) => p.fill)).toEqual(
      fixture.paths.map((p) => (p.fill === 'none' ? 'none' : HEX_TO_TOKEN[p.fill]))
    );
    expect(xs.paths.map((p) => p.stroke)).toEqual(fixture.paths.map((p) => HEX_TO_TOKEN[p.stroke]));
  });

  // The SKIRT label deliberately diverges — see the dedicated test below and PLAN §9.12.
  const isSkirtLabel = (text: string) => text.startsWith('SKIRT ');

  it('labels match exactly, colours mapped to tokens', () => {
    const strip = (l: {
      x: unknown;
      y: unknown;
      size: unknown;
      anchor?: unknown;
      text: string;
    }) => ({
      x: l.x,
      y: l.y,
      size: l.size,
      anchor: l.anchor,
      text: l.text
    });
    expect(xs.labels.filter((l) => !isSkirtLabel(l.text)).map(strip)).toEqual(
      fixture.labels.filter((l) => !isSkirtLabel(l.text)).map(strip)
    );
    expect(xs.labels.map((l) => l.fill)).toEqual(
      fixture.labels.map((l) => LABEL_HEX_TO_TOKEN[l.fill])
    );
  });

  it('labels the skirt with the FINISHED length, not the flat one (PLAN §9.12)', () => {
    // The design labelled this `g.skirt` — the bend-compensated flat dimension — while
    // drawing the profile from the true folded length, so the label contradicted the line
    // it annotated. Worst case in the fixtures is the hemmed 650b: drawn 32 mm, labelled
    // 38 mm. A cross-section describes the finished object, so it gets the finished number.
    const ours = xs.labels.find((l) => isSkirtLabel(l.text))!;
    const theirs = fixture.labels.find((l) => isSkirtLabel(l.text))!;

    expect(ours.text).toBe(`SKIRT ${Math.round(g.skirtTrue)} @ ${c.config.angle}°`);
    // Position and styling are untouched — only the number changed.
    expect({ x: ours.x, y: ours.y, size: ours.size, anchor: ours.anchor }).toEqual({
      x: theirs.x,
      y: theirs.y,
      size: theirs.size,
      anchor: theirs.anchor
    });
    // And it now agrees with the geometry it points at, which is the whole point.
    expect(Math.round(g.skirtTrue)).toBe(Math.round(Math.hypot(g.proj, g.drop)));
  });

  it('viewBox and finished width match', () => {
    expect(xs.viewBox).toBe(fixture.viewBox);
    expect(xs.finished).toBeCloseTo(fixture.finished, 10);
  });
});

// PLAN §14 — the viewBox is pinned to the tyre + clearance envelope, not to `finished`,
// so crown/skirt changes that stay inside that envelope must not move the viewBox, and
// the tyre section circle must track `tyre` alone.
describe('buildCrossSection viewBox envelope (PLAN §14)', () => {
  it('is identical for two configs differing only in crown width within the envelope', () => {
    // tyre=90 gives an envelope wide enough that a modest crown/skirt=0 combination
    // never exceeds it, so both should land on exactly the same rounded viewBox.
    const base: FenderConfig = { ...DEFAULTS, tyre: 90, skirt: 0, crown: 30 };
    const wide: FenderConfig = { ...base, crown: 50 };
    expect(buildCrossSection(wide).viewBox).toBe(buildCrossSection(base).viewBox);
  });

  it('widens the viewBox once the fender genuinely exceeds the envelope', () => {
    const small: FenderConfig = { ...DEFAULTS, tyre: 90, skirt: 0, crown: 30 };
    const huge: FenderConfig = { ...small, crown: 140 };
    expect(buildCrossSection(huge).viewBox).not.toBe(buildCrossSection(small).viewBox);
  });

  it("the tyre section circle's diameter is proportional to tyre and independent of crown", () => {
    const tyreCircle = (s: FenderConfig) => buildCrossSection(s).paths[0]!.d;

    const narrow = tyreCircle({ ...DEFAULTS, crown: 30 });
    const wide = tyreCircle({ ...DEFAULTS, crown: 140 });
    expect(wide).toBe(narrow);

    const smallTyre = tyreCircle({ ...DEFAULTS, tyre: 20 });
    const bigTyre = tyreCircle({ ...DEFAULTS, tyre: 90 });
    expect(bigTyre).not.toBe(smallTyre);
  });
});
