import { PW, f0, f1 } from './defaults';
import { geo } from './geometry';
import { buildParts } from './parts';
import type { FenderConfig, Geometry, PartsModel, Warning } from './types';

/**
 * Conditional warnings, transcribed verbatim from the design source (lines ~986–994).
 *
 * Each fires independently on its own condition, in source order. `parts.oversizedParts`
 * comes straight from PartsModel (PLAN §12) rather than recomputing the Sheet-B packing
 * check a second time.
 *
 * Ids are new — the source keyed dismissal on the joined warning text (PLAN §9.8), which
 * re-surfaces the banner whenever the prose changes. Stable ids let dismissal key on
 * identity instead; see PLAN §9.8 and types.ts's Warning.id.
 */
export function buildWarnings(
  s: FenderConfig,
  g: Geometry = geo(s),
  parts: PartsModel = buildParts(s, g)
): Warning[] {
  const warnings: Warning[] = [];

  if (g.cov > 220) {
    warnings.push({
      id: 'coverage-exceeds-frame',
      text: `${f0(g.cov)}° of coverage wraps past the frame. Measure from the tyre to the fork crown (front) or seat tube (rear) before cutting — most frames foul somewhere between 200° and 240°.`
    });
  }

  if (s.measuredR === 0) {
    warnings.push({
      id: 'radius-estimated',
      text: `Tyre radius is estimated at ${f0(g.tyreRcalc)} mm from BSD + section width. Measure the real thing and set “Measured tyre radius” — a 5 mm error here shifts every dart.`
    });
  }

  if (g.crownTail < s.tyre + 6) {
    warnings.push({
      id: 'tail-narrower-than-tyre',
      text: `Tapered tail is ${f0(g.crownTail)} mm, narrower than the ${s.tyre} mm tyre. It will throw spray sideways at the very end — keep the taper under ${f0((1 - (s.tyre + 6) / g.crown0) * 100)}% or widen the crown.`
    });
  }

  if (g.notch > 8) {
    warnings.push({
      id: 'darts-too-wide',
      text: `Darts are ${f1(g.notch)} mm wide — the curve will read as facets and the gaps are hard to close cleanly. Add flaps.`
    });
  }

  if (g.skirt < 12 && s.join !== 'none') {
    warnings.push({
      id: 'skirt-too-short',
      text: `A ${f0(g.skirt)} mm skirt leaves almost no material around the fastener holes. Either lengthen the skirt or switch to the hole-free join.`
    });
  }

  if (s.stock === 'single' && g.L > 1000) {
    warnings.push({
      id: 'single-blank-too-long',
      text: `A single blank needs ${f0(g.L)} mm of stock in one piece. Switch to A4 panels unless you have a roll.`
    });
  }

  // PLAN §12 — Sheet B repacks onto as many PW × PARTS_PH pages as it needs, so needing
  // a second page is no longer a warning (it prints fine, just as more paper). The only
  // real constraint left is a single part too big for a page in EITHER orientation — in
  // practice, a strut longer than PW mm, since PARTS_PH < PW.
  if (parts.oversizedParts.length > 0) {
    const longest = Math.max(...parts.oversizedParts);
    warnings.push({
      id: 'sheet-b-too-wide',
      text: `A part is ${f0(longest)} mm long — longer than the ${PW} mm print page in any orientation. Shorten it to about ${f0(PW - 8)} mm, or cut it from stock by measurement instead.`
    });
  }

  return warnings;
}
