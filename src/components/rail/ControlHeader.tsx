import type { PointerEventHandler } from 'react';
import { PresetSelect } from './PresetSelect';
import type { FenderConfig } from '../../fender/types';

interface ControlHeaderProps {
  config: FenderConfig;
  applyPreset: (id: string) => void;
  /** Desk/tablet: the rail's own sticky title bar. Phone: the bottom sheet's peek,
   * which also carries the drag handle instead of a title. */
  variant: 'rail' | 'peek';
  onPointerDown?: PointerEventHandler;
  onPointerMove?: PointerEventHandler;
  onPointerUp?: PointerEventHandler;
  onPointerCancel?: PointerEventHandler;
}

/**
 * B4: one header shared between the rail's sticky top and the phone bottom sheet's peek,
 * rather than three separate implementations (the rail's own title block, `RailPill`'s
 * spec line, and the sheet's peek header). Preset choice moves here as a dropdown (B5),
 * replacing `PresetStrip`/`PresetChipStrip`.
 */
export function ControlHeader({
  config,
  applyPreset,
  variant,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: ControlHeaderProps) {
  if (variant === 'peek') {
    return (
      <div
        className="control-header control-header--peek"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="bottom-sheet__handle" />
        <div className="control-header__row">
          <PresetSelect config={config} onApply={applyPreset} />
        </div>
      </div>
    );
  }

  return (
    <div className="control-header control-header--rail">
      <h1 className="rail-title">Flat-pack fender</h1>
      <PresetSelect config={config} onApply={applyPreset} className="control-header__preset" />
    </div>
  );
}
