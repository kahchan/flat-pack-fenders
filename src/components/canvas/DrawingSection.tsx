import { useState, type ReactNode, type RefObject } from 'react';

interface DrawingSectionProps {
  sectionRef: RefObject<HTMLDetailsElement | null>;
  label: string;
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * One accordion section under the 3D view (WP22 §22.3), replacing `SheetTabs`. Content
 * only mounts while open — `PrintTiles` used to mount every tile SVG regardless of which
 * tab was showing (§22.3's stated render win), and this fixes that for every section, not
 * just print pages.
 */
export function DrawingSection({ sectionRef, label, meta, defaultOpen = false, children }: DrawingSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      ref={sectionRef}
      className="drawing-section"
      open={defaultOpen}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="section-heading">
        <h2>{label}</h2>
        {meta && <span className="meta">{meta}</span>}
      </summary>
      {open && <div className="drawing-section__body">{children}</div>}
    </details>
  );
}
