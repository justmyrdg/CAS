import { inputStyle } from '../../components/Modal';
import { IconButton } from './components';
import { CHOICE_LETTERS, MAX_CHOICES, MIN_CHOICES } from './subjectsData';

interface Props {
  name: string; // unique radio-group name
  label: string; // e.g. "Question 2" or "Block 5", used in accessible names
  choices: string[];
  correctChoice: number;
  onChange: (next: { choices: string[]; correctChoice: number }) => void;
}

// Editable multiple-choice list with a radio for the correct answer.
export default function ChoiceEditor({ name, label, choices, correctChoice, onChange }: Props) {
  function setChoice(index: number, value: string) {
    onChange({ choices: choices.map((c, i) => (i === index ? value : c)), correctChoice });
  }

  function removeChoice(index: number) {
    // Keep the correct answer pointing at the same choice after the removal.
    const nextCorrect = correctChoice === index ? 0 : correctChoice > index ? correctChoice - 1 : correctChoice;
    onChange({ choices: choices.filter((_, i) => i !== index), correctChoice: nextCorrect });
  }

  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Choices — select the correct answer</div>
      <div role="radiogroup" aria-label={`${label} correct answer`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {choices.map((choice, ci) => {
          const correct = correctChoice === ci;
          return (
            <div
              key={ci}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: correct ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                background: correct ? 'var(--primary-light)' : '#fff',
                borderRadius: 8,
                padding: '4px 6px 4px 10px',
              }}
            >
              <input
                type="radio"
                name={name}
                aria-label={`Choice ${CHOICE_LETTERS[ci]} is correct`}
                checked={correct}
                onChange={() => onChange({ choices, correctChoice: ci })}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', width: 14 }}>{CHOICE_LETTERS[ci]}</span>
              <input
                aria-label={`${label} choice ${CHOICE_LETTERS[ci]}`}
                placeholder={`Choice ${CHOICE_LETTERS[ci]}`}
                value={choice}
                onChange={(e) => setChoice(ci, e.target.value)}
                style={{ ...inputStyle, border: 'none', background: 'transparent', padding: '6px 4px' }}
              />
              {correct && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>Correct</span>}
              <IconButton label={`Remove choice ${CHOICE_LETTERS[ci]}`} disabled={choices.length <= MIN_CHOICES} onClick={() => removeChoice(ci)}>
                ✕
              </IconButton>
            </div>
          );
        })}
      </div>
      {choices.length < MAX_CHOICES && (
        <button
          type="button"
          onClick={() => onChange({ choices: [...choices, ''], correctChoice })}
          style={{ marginTop: 8, border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          + Add choice
        </button>
      )}
    </>
  );
}
