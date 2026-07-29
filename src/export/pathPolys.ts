/**
 * SVG path `d` → polylines, in the same millimetre user units as the model.
 *
 * The one function in `src/export/` allowed to touch the DOM — `getTotalLength()` and
 * `getPointAtLength()` have no pure-JS equivalent for arcs and quadratics. Only
 * `PartsModel.outlines` and `PartsModel.folds` contain curves (strut pill `a` arcs,
 * mudflap `q` corners); the blank is pure `M`/`L`, so any subpath without an
 * `[acqst]` command is walked exactly by the tokeniser below and never touches the
 * DOM — see PLAN §9.2. That is why the blank half of both exports is exact and only
 * the parts sheet is sampled, at a 0.4 mm step.
 *
 * Ported verbatim from the design source (fender.html:538-600); only the types are new.
 */
export function pathPolys(d: string): [number, number][][] {
  const subs = d
    .split(/(?=[Mm])/)
    .map((x) => x.trim())
    .filter(Boolean);
  const polys: [number, number][][] = [];

  let svg: SVGSVGElement | null = null;
  let el: SVGPathElement | null = null;
  const ensureDom = () => {
    if (el) return;
    const NS = 'http://www.w3.org/2000/svg';
    svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    el = document.createElementNS(NS, 'path') as SVGPathElement;
    svg.appendChild(el);
    document.body.appendChild(svg);
  };

  try {
    for (const sub of subs) {
      if (/[acqst]/i.test(sub)) {
        // Real curves — sample finely, cap high enough that the step stays sub-millimetre.
        ensureDom();
        el!.setAttribute('d', sub);
        const len = el!.getTotalLength();
        if (!(len > 0)) continue;
        const steps = Math.max(2, Math.min(6000, Math.ceil(len / 0.4)));
        const pts: [number, number][] = [];
        let prev: [number, number] | null = null;
        for (let i = 0; i <= steps; i++) {
          const p = el!.getPointAtLength((len * i) / steps);
          if (!prev || Math.hypot(p.x - prev[0], p.y - prev[1]) > 0.05) {
            pts.push([p.x, p.y]);
            prev = [p.x, p.y];
          }
        }
        if (pts.length > 1) polys.push(pts);
        continue;
      }

      // Only M/L/H/V/Z — walk the commands and keep every exact vertex.
      const pts: [number, number][] = [];
      let cx = 0;
      let cy = 0;
      let cmd = 'M';
      const re = /([MLHVZmlhvz])|(-?\d*\.?\d+(?:e-?\d+)?)/g;
      const nums: number[] = [];
      let m: RegExpExecArray | null;
      const push = () => {
        if (!nums.length) return;
        if (cmd === 'M' || cmd === 'L' || cmd === 'm' || cmd === 'l') {
          for (let i = 0; i + 1 < nums.length; i += 2) {
            if (cmd === 'M' || cmd === 'L') {
              cx = nums[i]!;
              cy = nums[i + 1]!;
            } else {
              cx += nums[i]!;
              cy += nums[i + 1]!;
            }
            pts.push([cx, cy]);
          }
        } else if (cmd === 'H' || cmd === 'h') {
          for (const n of nums) {
            cx = cmd === 'H' ? n : cx + n;
            pts.push([cx, cy]);
          }
        } else if (cmd === 'V' || cmd === 'v') {
          for (const n of nums) {
            cy = cmd === 'V' ? n : cy + n;
            pts.push([cx, cy]);
          }
        }
        nums.length = 0;
      };
      while ((m = re.exec(sub))) {
        if (m[1]) {
          push();
          cmd = m[1];
        } else {
          nums.push(parseFloat(m[2]!));
        }
      }
      push();
      if (pts.length > 1) polys.push(pts);
    }
  } finally {
    if (svg) (svg as SVGSVGElement).remove();
  }

  return polys;
}
