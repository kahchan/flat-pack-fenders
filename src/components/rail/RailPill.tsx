interface RailPillProps {
  specLine: string;
  onOpen: () => void;
}

/** Tablet floating trigger for the rail drawer, PLAN §4 — bottom-right pill showing the
 * live spec line (the same `assembledLabel` shown above the isometric preview). */
export function RailPill({ specLine, onOpen }: RailPillProps) {
  return (
    <button type="button" className="rail-pill screen-only mono" onClick={onOpen}>
      {specLine}
    </button>
  );
}
