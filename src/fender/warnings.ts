import { PW, f0, f1 } from './defaults';
import { flapsForLap, geo, joinFits, skirtForLap, strutMount } from './geometry';
import { buildParts } from './parts';
import { buildBlank } from './pattern';
import type { BlankModel, FenderConfig, Geometry, PartsModel, Warning } from './types';

/**
 * Conditional warnings, transcribed verbatim from the design source (lines ~986–994),
 * plus two new ones added for PLAN §13.2 and §13.4 — neither is in the design source,
 * so both are appended after the transcribed checks rather than interleaved, and their
 * ids sit last in warnings.test.ts's `ID_ORDER` for the same reason.
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
  parts: PartsModel = buildParts(s, g),
  blank: BlankModel = buildBlank(s, g)
): Warning[] {
  const warnings: Warning[] = [];

  if (g.cov > 220) {
    warnings.push({
      id: 'coverage-exceeds-frame',
      text: `${f0(g.cov)}° of coverage wraps past the frame. Measure from the tyre to the fork crown (front) or seat tube (rear) before cutting: most frames foul somewhere between 200° and 240°.`
    });
  }

  if (s.measuredR === 0) {
    warnings.push({
      id: 'radius-estimated',
      text: `Tyre radius is estimated at ${f0(g.tyreRcalc)} mm from BSD + section width. Measure the real thing and set “Measured tyre radius”: a 5 mm error here shifts every dart.`
    });
  }

  if (g.crownTail < s.tyre + 6) {
    // PLAN §9.17 — the source's expression goes negative once the tyre alone exceeds
    // crown width (reachable on the Tyre width slider), printing nonsense like "keep
    // the taper under -56%". Clamped at 0 and the advice switched to widening the
    // crown, since at that point no taper value can help.
    const taperPct = (1 - (s.tyre + 6) / g.crown0) * 100;
    const advice =
      taperPct > 0
        ? `keep the taper under ${f0(taperPct)}% or widen the crown`
        : 'no taper helps here: widen the crown instead';
    warnings.push({
      id: 'tail-narrower-than-tyre',
      text: `Tapered tail is ${f0(g.crownTail)} mm, narrower than the ${s.tyre} mm tyre. It will throw spray sideways at the very end: ${advice}.`
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
      text: `A part is ${f0(longest)} mm long: longer than the ${PW} mm print page in any orientation. Shorten it to about ${f0(PW - 8)} mm, or cut it from stock by measurement instead.`
    });
  }

  // PLAN §13.2 — new, not in the design source. The `crownTail < tyre + 6` check above
  // only catches the tapered TAIL; nothing previously caught a tyre too wide for the
  // fender's full-width section. The real constraint is the tyre plus clearance on both
  // sides fitting inside the crown plus both skirt projections.
  const required = s.tyre + 2 * s.clear;
  const available = g.crown0 + 2 * g.proj;
  if (required > available) {
    const crownNeeded = required - 2 * g.proj;
    warnings.push({
      id: 'tyre-too-wide',
      text: `The ${f0(s.tyre)} mm tyre plus ${f0(s.clear)} mm clearance each side needs ${f0(required)} mm across, but the crown and skirts only give ${f0(available)} mm. Widen the crown to at least ${f0(crownNeeded)} mm.`
    });
  }

  // PLAN §13.4 — new, not in the design source. isometric.ts used to clamp the drawn
  // strut to the real mount distance, so a strut longer than that just stopped growing
  // on screen past ~290 mm without telling you. Now it draws true length and overshoots
  // visibly; this is the warning that tells you it needs cutting.
  if (blank.strutFrac.length > 0) {
    const mountLens = blank.strutFrac.map((fr) => strutMount(s, g, fr, 0).len);
    const minMount = Math.min(...mountLens);
    if (s.strutLen > minMount * 1.1) {
      warnings.push({
        id: 'strut-too-long',
        text: `Strut length is ${f0(s.strutLen)} mm but the nearest mount point is only about ${f0(minMount)} mm away. Cut roughly ${f0(s.strutLen - minMount)} mm off before fitting, or it will foul the hub.`
      });
    }
  }

  // WP23 §23.4 — new, not in the design source. C3's whole point is that a join that
  // doesn't fit is a warning, not a clamp: the selector still lets you pick it, so this
  // is the one place that says so, naming both remedy levers (flaps down, or skirt up)
  // computed from the same geometry the fit check itself reads.
  const fit = joinFits(g).find((f) => f.join === s.join)!;
  if (!fit.fits) {
    const maxFlaps = flapsForLap(g, fit.needed);
    const neededSkirt = skirtForLap(g, fit.needed);
    const remedies = [
      maxFlaps !== null && maxFlaps < s.flaps ? `${maxFlaps} sections` : null,
      neededSkirt !== null ? `a ${f0(neededSkirt)} mm skirt` : null
    ].filter((r): r is string => r !== null);
    const remedyText = remedies.length > 0 ? remedies.join(' or ') + ' would do it' : 'fewer sections or a deeper skirt would do it';
    warnings.push({
      id: 'join-lacks-lap',
      text: `${s.join} needs ${f0(fit.needed)} mm of lap, but this fender has ${f1(g.lap)} mm at ${g.n} sections: ${remedyText}.`
    });
  }

  return warnings;
}
