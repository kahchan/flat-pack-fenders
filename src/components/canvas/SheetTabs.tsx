import type { Tab } from '../../state/useFenderConfig';

interface SheetTabsProps {
  tab: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { k: Tab; label: string }[] = [
  { k: 'sheets', label: 'Construction sheets' },
  { k: 'assembly', label: 'Assembly & print pages' }
];

export function SheetTabs({ tab, onChange }: SheetTabsProps) {
  return (
    <div className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.k}
          className={`tab-btn${tab === t.k ? ' tab-btn--active' : ''}`}
          onClick={() => onChange(t.k)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
