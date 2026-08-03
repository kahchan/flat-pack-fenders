import type { ReactNode } from 'react';
import { ControlHeader } from './ControlHeader';
import { useBottomSheet } from './useBottomSheet';
import type { FenderConfig } from '../../fender/types';

interface BottomSheetProps {
  config: FenderConfig;
  applyPreset: (id: string) => void;
  children: ReactNode;
}

/**
 * The phone (<760px) control sheet, PLAN §4: three snap points (peek 96px, half 55vh,
 * full 92vh), momentum-aware drag, interruptible mid-flight, `prefers-reduced-motion`
 * snaps instantly — all handled by `useBottomSheet`. Only the drag handle region moves
 * the sheet; the body scrolls its own content once past peek.
 *
 * WP22 B4: the peek is the shared `ControlHeader`, not a bespoke handle/specline/preset
 * row — the preset choice sits in `ControlHeader` as the one dropdown (B5), and the peek
 * line is the preset name, not the assembled spec (that already sits under the 3D view).
 */
export function BottomSheet({ config, applyPreset, children }: BottomSheetProps) {
  const { height, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useBottomSheet();

  return (
    <div className="bottom-sheet screen-only" style={{ height }}>
      <ControlHeader
        variant="peek"
        config={config}
        applyPreset={applyPreset}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
      <div className="bottom-sheet__body">{children}</div>
    </div>
  );
}
