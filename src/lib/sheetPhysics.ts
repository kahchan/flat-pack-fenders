/**
 * Pure momentum/snap math for the phone bottom sheet (PLAN §4). Kept dependency-free and
 * DOM-free so it's unit-testable in Node — the pointer/rAF wiring that calls this lives
 * in `components/rail/useBottomSheet.ts`, which cannot be unit-tested without `jsdom`
 * (not installed, per the constraint) and is instead verified by driving the dev server.
 */

export type SnapId = 'peek' | 'half' | 'full';

/** Fixed peek height, PLAN §4 — the only snap that isn't a fraction of the viewport. */
export const PEEK_HEIGHT = 96;

export interface SnapHeights {
  peek: number;
  half: number;
  full: number;
}

/** Snap heights in px for a given viewport height — PLAN §4: peek 96px, half 55vh, full 92vh. */
export function snapHeights(viewportHeight: number): SnapHeights {
  return {
    peek: PEEK_HEIGHT,
    half: viewportHeight * 0.55,
    full: viewportHeight * 0.92
  };
}

export function snapList(h: SnapHeights): { id: SnapId; height: number }[] {
  return [
    { id: 'peek', height: h.peek },
    { id: 'half', height: h.half },
    { id: 'full', height: h.full }
  ];
}

/**
 * Apple's exponential-decay momentum projection (Designing Fluid Interfaces, WWDC 2018):
 * where a flick "wants" to land if let run to a stop, not the release point itself.
 * `decelerationRate` ~0.998 matches normal scroll feel.
 */
export function projectMomentum(velocityPxPerSec: number, decelerationRate = 0.998): number {
  return ((velocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Nearest snap (by height) to a given position. */
export function nearestSnap(
  position: number,
  snaps: { id: SnapId; height: number }[]
): { id: SnapId; height: number } {
  return snaps.reduce((best, s) => (Math.abs(s.height - position) < Math.abs(best.height - position) ? s : best));
}

/**
 * Given a release height + velocity (px/s, positive = dragging up/opening), decide which
 * snap point the sheet should settle to. Velocity is projected forward before choosing —
 * a fast enough flick can skip past the nearest snap to the one beyond it.
 */
export function resolveSnapTarget(
  currentHeight: number,
  velocityPxPerSec: number,
  h: SnapHeights
): { id: SnapId; height: number } {
  const projected = currentHeight + projectMomentum(velocityPxPerSec);
  return nearestSnap(projected, snapList(h));
}

/**
 * Apple's rubber-band formula (Designing Fluid Interfaces) — soft resistance past a
 * boundary instead of a hard stop. `overshoot` is the raw distance past the edge.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Clamp a dragged height into `[peek, full]`, applying rubberband beyond either bound. */
export function clampDragHeight(height: number, h: SnapHeights): number {
  if (height > h.full) return h.full + rubberband(height - h.full, h.full);
  if (height < h.peek) return h.peek - rubberband(h.peek - height, h.full);
  return height;
}

/**
 * SwiftUI-style spring step (`spring(response:dampingFraction:)`): `response` is the
 * settle time in seconds, `dampingRatio` 1.0 = critically damped (no overshoot), < 1.0
 * overshoots. Mass is fixed at 1. One call advances the simulation by `dt` seconds.
 */
export function springStep(
  position: number,
  velocity: number,
  target: number,
  response: number,
  dampingRatio: number,
  dt: number
): { position: number; velocity: number } {
  const omega = (2 * Math.PI) / response;
  const stiffness = omega * omega;
  const damping = 2 * dampingRatio * omega;
  const accel = -stiffness * (position - target) - damping * velocity;
  const v = velocity + accel * dt;
  const p = position + v * dt;
  return { position: p, velocity: v };
}

/** True once the spring is close enough to target with low enough velocity to stop the
 * rAF loop, instead of chasing floating-point noise forever. */
export function springSettled(position: number, velocity: number, target: number): boolean {
  return Math.abs(position - target) < 0.5 && Math.abs(velocity) < 5;
}
