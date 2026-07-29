import { f0, f1 } from './defaults';
import { geo } from './geometry';
import type { FenderConfig, Geometry, Label, XsecModel, XsecPath } from './types';

/**
 * The side-on cross-section: tyre, rim, clearance gap, folded skirt profile and the
 * finished outside-width dimension line.
 *
 * The SKIRT label reads `skirtTrue`, deliberately diverging from the design (PLAN §9.12).
 *
 * The source labelled it `g.skirt` — the flat, bend-compensated length — while drawing the
 * profile from `g.proj`/`g.drop`, which come from the true folded length. So the design's
 * default drew a 26 mm skirt and annotated it "SKIRT 25": the label contradicted the line
 * it pointed at. A cross-section is a picture of the finished object, so the finished
 * dimension is the correct one here; 25.44 is a flat-pattern number and belongs on Sheet A.
 *
 * The `skirt < 12` warning still reads the flat value, which is right — that warning is
 * about material around the fastener holes, which is a flat-pattern concern.
 */
export function buildCrossSection(s: FenderConfig, g: Geometry = geo(s)): XsecModel {
  const tR = s.tyre / 2;
  const tCy = s.clear + tR;
  const rimW = Math.max(15, s.tyre * 0.55);
  const rimH = Math.max(14, s.tyre * 0.42);
  const dimY = Math.max(g.drop, s.clear + s.tyre + rimH) + 14;
  const finished = g.crown0 + 2 * g.proj;

  const paths: XsecPath[] = [
    {
      d:
        `M ${f1(-tR)},${f1(tCy)} a ${f1(tR)} ${f1(tR)} 0 1 1 ${f1(s.tyre)} 0` +
        ` a ${f1(tR)} ${f1(tR)} 0 1 1 ${f1(-s.tyre)} 0 Z`,
      fill: 'var(--draw-xsec-tyre)',
      stroke: 'var(--draw-ghost)',
      sw: 0.9,
      dash: '0'
    },
    {
      d: `M ${f1(-rimW / 2)},${f1(tCy + tR * 0.55)} h ${f1(rimW)} v ${f1(rimH)} h ${f1(-rimW)} Z`,
      fill: 'var(--draw-xsec-rim)',
      stroke: 'var(--draw-label-dim)',
      sw: 0.9,
      dash: '0'
    },
    {
      d: `M 0,0 v ${f1(s.clear)} m -3,0 h 6 m -3,${f1(-s.clear)} m -3,0 h 6`,
      fill: 'none',
      stroke: 'var(--draw-xsec-gap)',
      sw: 0.7,
      dash: '0'
    },
    {
      d:
        `M ${f1(-g.crown0 / 2 - g.proj)},${f1(g.drop)} L ${f1(-g.crown0 / 2)},0` +
        ` L ${f1(g.crown0 / 2)},0 L ${f1(g.crown0 / 2 + g.proj)},${f1(g.drop)}`,
      fill: 'none',
      stroke: 'var(--draw-cut)',
      sw: 2.4,
      dash: '0'
    },
    {
      d: `M ${f1(-finished / 2)},${f1(dimY)} h ${f1(finished)} m 0,-4 v 8 m ${f1(-finished)},-8 v 8`,
      fill: 'none',
      stroke: 'var(--draw-label-dim)',
      sw: 0.7,
      dash: '0'
    }
  ];

  const labels: Label[] = [
    {
      x: 0,
      y: f1(dimY + 12),
      size: 7,
      fill: 'var(--draw-label)',
      anchor: 'middle',
      text: `FINISHED ${f0(finished)} mm`
    },
    {
      x: 0,
      y: -7,
      size: 6,
      fill: 'var(--draw-label-dim)',
      anchor: 'middle',
      text: `CROWN ${f0(g.crown0)}`
    },
    {
      x: f1(g.crown0 / 2 + g.proj + 6),
      y: f1(g.drop + 8),
      size: 6,
      fill: 'var(--draw-label-dim)',
      anchor: 'start',
      text: `SKIRT ${f0(g.skirtTrue)} @ ${s.angle}°`
    },
    {
      x: 16,
      y: f1(s.clear / 2 + 2),
      size: 6,
      fill: 'var(--draw-xsec-gap)',
      anchor: 'start',
      text: `GAP ${f0(s.clear)}`
    },
    {
      x: 0,
      y: f1(tCy + 2),
      size: 6,
      fill: 'var(--draw-label-dim)',
      anchor: 'middle',
      text: `TYRE ⌀${f0(s.tyre)}`
    },
    {
      x: 0,
      y: f1(tCy + tR * 0.55 + rimH + 8),
      size: 5.5,
      fill: 'var(--draw-label-dim)',
      anchor: 'middle',
      text: 'RIM'
    }
  ];

  const xw = finished + 130;
  const viewBox = `${f1(-xw / 2)} -22 ${f1(xw)} ${f1(dimY + 40)}`;

  return { paths, labels, viewBox, finished };
}
