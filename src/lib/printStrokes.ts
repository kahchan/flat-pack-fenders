/**
 * Print-only stroke weights and shared strings. Print sheets use thinner lines than
 * the screen views, and folds/scores swap to `--draw-fold-print` — a greyer tone that
 * still separates from cut lines when a printer renders everything in black. Source
 * lines ~381-402 (print tile) and ~409-423 (Sheet B print). Centralised here so the
 * print components and their tests share one set of numbers instead of six copies.
 */
export const PRINT_STROKE = {
  frame: 0.4,
  ruler: 0.6,
  outline: 0.9,
  seam: 0.7,
  lap: 0.5,
  fold: 0.6,
  score: 0.5,
  hole: 0.6,
  slot: 0.6
} as const;

/**
 * Printed beside the 100 mm ruler on every tile — source line 1004.
 *
 * PLAN FEEDBACK WP17 (decision A3) — the source's em-dash is now a colon (it introduces
 * the instruction, same as notes.ts's scheme); see printStrokes.test.ts for the original.
 */
export const RULER_CAPTION = '100 mm: measure to check scale';
