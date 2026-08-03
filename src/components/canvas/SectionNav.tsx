import type { RefObject } from 'react';

export type SectionKey = 'sheets' | 'print' | 'steps' | 'specs';

export interface SectionNavItem {
  key: SectionKey;
  label: string;
  ref: RefObject<HTMLDetailsElement | null>;
}

interface SectionNavProps {
  items: SectionNavItem[];
}

/**
 * WP22 §22.3: replaces `SheetTabs`. Not tabs — every section is a `<details>` that can be
 * open or closed independently; this nav just scrolls to a section and opens it. "One
 * drawing section open at a time by default" (§22.3) is the initial `open` prop each
 * `<details>` is given by its caller, not something this nav enforces on every click.
 */
export function SectionNav({ items }: SectionNavProps) {
  const goTo = (item: SectionNavItem) => {
    const el = item.ref.current;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="section-nav">
      {items.map((item) => (
        <button key={item.key} type="button" className="section-nav__btn" onClick={() => goTo(item)}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
