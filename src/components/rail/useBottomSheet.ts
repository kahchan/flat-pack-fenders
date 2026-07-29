import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  clampDragHeight,
  resolveSnapTarget,
  snapHeights,
  springSettled,
  springStep,
  type SnapId
} from '../../lib/sheetPhysics';

// apple-design skill's "Drawer / sheet" spring: damping 0.8, response 0.3 — a little
// bounce is right here because a drag (with its own momentum) always precedes the settle.
const RESPONSE = 0.3;
const DAMPING = 0.8;
const VELOCITY_SAMPLE_WINDOW = 5;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Sample {
  y: number;
  t: number;
}

interface Target {
  id: SnapId;
  height: number;
}

/**
 * Drag + momentum wiring for the phone bottom sheet (PLAN §4). The physics itself
 * (projection, nearest-snap, spring stepping) is pure and lives in `lib/sheetPhysics.ts`;
 * this hook is just the pointer-event/rAF glue, which needs the DOM and so can't be unit
 * tested without `jsdom` — verified instead by dragging the sheet in the dev server.
 *
 * Interruptibility (apple-design §3): grabbing the sheet mid-settle cancels the running
 * spring and starts the drag from wherever the sheet actually is on screen, never from
 * the logical target.
 */
export function useBottomSheet() {
  const [height, setHeight] = useState(96);
  const [snap, setSnap] = useState<SnapId>('peek');
  const heightRef = useRef(height);
  const velocityRef = useRef(0);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const rafRef = useRef<number | null>(null);

  const commit = (h: number) => {
    heightRef.current = h;
    setHeight(h);
  };

  const stopAnimation = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const animateTo = (target: Target) => {
    stopAnimation();
    if (prefersReducedMotion()) {
      velocityRef.current = 0;
      commit(target.height);
      setSnap(target.id);
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const next = springStep(heightRef.current, velocityRef.current, target.height, RESPONSE, DAMPING, dt);
      velocityRef.current = next.velocity;
      if (springSettled(next.position, next.velocity, target.height)) {
        commit(target.height);
        velocityRef.current = 0;
        setSnap(target.id);
        rafRef.current = null;
        return;
      }
      commit(next.position);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const snapTo = (id: SnapId) => {
    const h = snapHeights(window.innerHeight);
    animateTo({ id, height: h[id] });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    stopAnimation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startHeight: heightRef.current };
    samplesRef.current = [{ y: e.clientY, t: performance.now() }];
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const h = snapHeights(window.innerHeight);
    const raw = drag.startHeight + (drag.startY - e.clientY);
    commit(clampDragHeight(raw, h));
    const samples = samplesRef.current;
    samples.push({ y: e.clientY, t: performance.now() });
    if (samples.length > VELOCITY_SAMPLE_WINDOW) samples.shift();
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const samples = samplesRef.current;
    let velocity = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0) velocity = -(last.y - first.y) / dt; // dragging up = positive height velocity
    }
    velocityRef.current = velocity;
    const h = snapHeights(window.innerHeight);
    animateTo(resolveSnapTarget(heightRef.current, velocity, h));
  };

  // Establish the real peek height once mounted (SSR-safe default of 96 above matches it
  // anyway, since peek is a fixed constant, but this keeps the source of truth in one place).
  useEffect(() => {
    const h = snapHeights(window.innerHeight);
    commit(h.peek);
    setSnap('peek');
    return stopAnimation;
    // Intentionally mount-only: this establishes the initial peek height once.
  }, []);

  // Re-settle on viewport resize (e.g. mobile browser chrome show/hide) without fighting
  // an in-progress gesture or animation.
  useEffect(() => {
    const onResize = () => {
      if (dragRef.current || rafRef.current !== null) return;
      const h = snapHeights(window.innerHeight);
      commit(h[snap]);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [snap]);

  return { height, snap, onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, snapTo };
}
