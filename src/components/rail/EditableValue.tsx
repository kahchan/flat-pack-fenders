import { useEffect, useRef, useState } from 'react';

interface EditableValueProps {
  id: string;
  display: string;
  editValue: number;
  onCommit: (raw: string) => void;
}

/**
 * WP24 §24.2 (C8): the slider's value number IS the control — tapping/clicking it edits
 * in place, no pencil icon or dialog. Renders as a plain-looking button at rest (the
 * resting affordance is CSS-only, `.slider-item__value`) and swaps to a text input on
 * activation, seeded from `editValue` rather than the raw display string so the angle
 * and radius items can seed from a different number than they show at rest (D4; §24.1's
 * "estimate" state) without this component knowing why.
 *
 * Commits on blur or Enter; Escape reverts without committing. Parsing and clamping to
 * the item's live bounds is the caller's job (`clampSliderEdit` in `controlText.ts`) —
 * this component only owns focus/selection and the edit/rest swap.
 */
export function EditableValue({ id, display, editValue, onCommit }: EditableValueProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape must skip the commit that blur would otherwise fire when the input unmounts.
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    el?.focus();
    el?.select();
    // §24.3: a field near the bottom of the phone sheet/tablet drawer sits under the
    // on-screen keyboard once it opens. The keyboard isn't up yet at focus time, so
    // `nearest` would see the field as already visible and do nothing — `center` moves
    // it clear pre-emptively instead.
    el?.scrollIntoView({ block: 'center' });
  }, [editing]);

  const startEditing = () => {
    setText(String(editValue));
    skipCommitRef.current = false;
    setEditing(true);
  };

  const commit = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setEditing(false);
      return;
    }
    onCommit(text);
    setEditing(false);
  };

  const revert = () => {
    skipCommitRef.current = true;
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        id={id}
        className="slider-item__value slider-item__value--editing mono"
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            revert();
          }
        }}
      />
    );
  }

  return (
    <button type="button" id={id} className="slider-item__value mono" onClick={startEditing}>
      {display}
    </button>
  );
}
