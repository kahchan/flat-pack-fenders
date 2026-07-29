import type { ReactNode } from 'react';

interface RailDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Tablet (760-1099px) control rail: an overlay drawer sliding in from the right, PLAN §4
 * — 392px, `transform: translateX`, `--dur-slide` + `--ease-out`, scrim `--color-overlay`.
 * This is a plain CSS transition (not a drag gesture, per §4), so `prefers-reduced-motion`
 * is already handled by the global transition-duration override in `global.css` — no
 * extra JS needed here.
 */
export function RailDrawer({ open, onClose, children }: RailDrawerProps) {
  return (
    <>
      <div
        className={`rail-drawer-scrim screen-only${open ? ' rail-drawer-scrim--open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div className={`rail-drawer screen-only${open ? ' rail-drawer--open' : ''}`} aria-hidden={!open}>
        <button type="button" className="rail-drawer__close" onClick={onClose} aria-label="Close controls">
          ×
        </button>
        {children}
      </div>
    </>
  );
}
