import type { Label } from '../../fender/types';

interface DrawingLabelsProps {
  labels: Label[];
  /** Screen views render labels at 2.4x the print size (design source line 1083) — print
   * sheets are physically 1:1 so the same label reads full-size there. */
  scale?: number;
  /** Overrides every label's own fill, e.g. Sheet B dims its labels on screen but not
   * in print (source lines 1084-1085). */
  fill?: string;
}

export function DrawingLabels({ labels, scale = 1, fill }: DrawingLabelsProps) {
  return (
    <>
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          fontSize={l.size * scale}
          fill={fill ?? l.fill ?? 'var(--draw-label)'}
          textAnchor={l.anchor ?? 'start'}
          fontFamily="var(--font-mono)"
        >
          {l.text}
        </text>
      ))}
    </>
  );
}
