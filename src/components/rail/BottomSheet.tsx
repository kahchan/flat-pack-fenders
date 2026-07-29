import type { ReactNode } from 'react';
import { useBottomSheet } from './useBottomSheet';

interface BottomSheetProps {
  specLine: string;
  presetSlot: ReactNode;
  children: ReactNode;
}

/**
 * The phone (<760px) control sheet, PLAN §4: three snap points (peek 96px, half 55vh,
 * full 92vh), momentum-aware drag, interruptible mid-flight, `prefers-reduced-motion`
 * snaps instantly — all handled by `useBottomSheet`. Only the drag handle region moves
 * the sheet; the body scrolls its own content once past peek.
 */
export function BottomSheet({ specLine, presetSlot, children }: BottomSheetProps) {
  const { height, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useBottomSheet();

  return (
    <div className="bottom-sheet screen-only" style={{ height }}>
      {/* Only the handle + spec line are the drag surface — the preset chips below need
          their own taps/scrolls, and a drag starting on a chip must not also fire its
          click (apple-design's gesture-disambiguation point: recognize gestures from
          dedicated surfaces rather than fighting over one). */}
      <div
        className="bottom-sheet__grab"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="bottom-sheet__handle" />
        <div className="bottom-sheet__specline mono">{specLine}</div>
      </div>
      <div className="bottom-sheet__presets">{presetSlot}</div>
      <div className="bottom-sheet__body">{children}</div>
    </div>
  );
}
