import { useEffect, useState } from 'react';

export type Breakpoint = 'desk' | 'tablet' | 'phone';

/**
 * PLAN §4's three breakpoints: desk ≥1100px, tablet 760-1099px, phone <760px. Not a pure
 * module — it reads `window.matchMedia` — so it lives alongside the components that
 * consume it rather than in `src/lib/`, and is verified by driving the dev server
 * (no `jsdom`, per the constraint) rather than by a Node unit test.
 */
function computeBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desk';
  if (window.matchMedia('(max-width: 759px)').matches) return 'phone';
  if (window.matchMedia('(max-width: 1099px)').matches) return 'tablet';
  return 'desk';
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(computeBreakpoint);

  useEffect(() => {
    const mqPhone = window.matchMedia('(max-width: 759px)');
    const mqTablet = window.matchMedia('(max-width: 1099px)');
    const update = () => setBreakpoint(computeBreakpoint());
    mqPhone.addEventListener('change', update);
    mqTablet.addEventListener('change', update);
    return () => {
      mqPhone.removeEventListener('change', update);
      mqTablet.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}
