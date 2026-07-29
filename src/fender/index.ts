import { geo } from './geometry';
import { buildIsometric, SPIN_DEFAULT } from './isometric';
import { buildCrossSection } from './crossSection';
import { buildNotes, buildSteps } from './notes';
import { buildBlank } from './pattern';
import { buildParts } from './parts';
import { assembledLabel, buildSpecs, printSpecLine } from './specs';
import { buildTiling } from './tiling';
import { buildWarnings } from './warnings';
import type { DrawingModel, FenderConfig } from './types';

/**
 * Single entry point — composes the per-section builders above into the one
 * `DrawingModel` every downstream consumer (screen, print, exports, thumbnails) reads.
 * No geometry or drawing logic lives here; see PLAN §3.
 *
 * `spin` is the isometric rotate-slider's view state, not a fender parameter — see
 * `buildIsometric`'s doc comment in isometric.ts.
 *
 * `baseName` reproduces the design source's `baseName()` (fender.html:502-505) exactly:
 * `Math.round(L)`/`Math.round(Wd)`, not the f0/f1 string formatters used elsewhere.
 */
export function buildModel(config: FenderConfig, spin: number = SPIN_DEFAULT): DrawingModel {
  const g = geo(config);
  const blank = buildBlank(config, g);
  const parts = buildParts(config, g);
  const iso = buildIsometric(config, g, spin, blank);
  const xsec = buildCrossSection(config, g);
  const tiling = buildTiling(config, g, blank);
  const warnings = buildWarnings(config, g, parts);
  const notes = buildNotes(config, g, blank);
  const steps = buildSteps(config, g, blank, tiling);
  const specs = buildSpecs(config, g, blank, xsec, tiling);

  return {
    config,
    geo: g,
    blank,
    parts,
    iso,
    xsec,
    tiling,
    warnings,
    notes,
    steps,
    specs,
    assembledLabel: assembledLabel(config, g, xsec),
    printSpecLine: printSpecLine(config, g),
    baseName: `fender-${config.side}-${config.wheel}-${Math.round(g.L)}x${Math.round(g.Wd)}mm`
  };
}
