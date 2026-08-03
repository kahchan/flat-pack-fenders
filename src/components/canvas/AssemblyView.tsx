import { AssemblySteps } from './AssemblySteps';
import type { AssemblyStep } from '../../fender/types';

interface AssemblyViewProps {
  steps: AssemblyStep[];
}

/** "Instructions" section (WP22 §22.3) — print pages split out into their own section
 * (`PrintTiles`, rendered directly by `CanvasPane` now that `SheetTabs` is gone). */
export function AssemblyView({ steps }: AssemblyViewProps) {
  return (
    <div className="assembly-stack">
      <AssemblySteps steps={steps} />
    </div>
  );
}
