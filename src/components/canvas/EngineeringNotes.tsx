import type { EngNote } from '../../fender/types';

interface EngineeringNotesProps {
  notes: EngNote[];
}

/** Design source lines 184-195. */
export function EngineeringNotes({ notes }: EngineeringNotesProps) {
  return (
    <section>
      <h2
        style={{
          fontSize: 'var(--text-label-size)',
          letterSpacing: 'var(--text-label-track)',
          textTransform: 'uppercase',
          margin: '0 0 14px',
          fontWeight: 'var(--text-label-weight)'
        }}
      >
        Notes for the engineer
      </h2>
      <div className="panel panel--notes eng-note">
        {notes.map((n, i) => (
          <div key={i}>
            <div className="eng-note__title">{n.title}</div>
            <div className="eng-note__body">{n.body}</div>
            <div className="eng-note__formula mono">{n.formula}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
