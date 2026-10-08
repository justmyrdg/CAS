import type { CSSProperties, ReactNode } from 'react';
import { fieldLabelStyle, inputStyle } from '../../components/Modal';
import { typeLabel } from './assessmentTypes';
import type { Question } from './assessmentTypes';

const LETTERS = 'ABCDEFGH';
const small: CSSProperties = { ...inputStyle, padding: '8px 10px', fontSize: 13 };

function IconButton({ label, disabledReason, onClick, disabled, children }: { label: string; disabledReason?: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={disabled && disabledReason ? disabledReason : label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        border: '1px solid var(--border)',
        borderRadius: 7,
        background: '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function AddLink({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </button>
  );
}

// A list of text inputs with add/remove, used for accepted answers and enumeration answers.
function TextList({ values, min, max, placeholder, addLabel, onChange }: { values: string[]; min: number; max: number; placeholder: (i: number) => string; addLabel: string; onChange: (next: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}.</span>
          <input value={v} placeholder={placeholder(i)} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} style={small} />
          <IconButton label="Remove" disabledReason={`Needs at least ${min}`} disabled={values.length <= min} onClick={() => onChange(values.filter((_, j) => j !== i))}>
            ✕
          </IconButton>
        </div>
      ))}
      <AddLink disabled={values.length >= max} onClick={() => onChange([...values, ''])}>
        {addLabel}
      </AddLink>
    </div>
  );
}

export default function QuestionEditor({
  question: q,
  index,
  count,
  locked,
  onChange,
  onMove,
  onRemove,
}: {
  question: Question;
  index: number;
  count: number;
  locked: boolean;
  onChange: (q: Question) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  function body(): ReactNode {
    switch (q.type) {
      case 'MULTIPLE_CHOICE':
      case 'MULTIPLE_SELECT': {
        const multi = q.type === 'MULTIPLE_SELECT';
        const isCorrect = (i: number) => (q.type === 'MULTIPLE_SELECT' ? q.correct.includes(i) : q.correct === i);
        const toggle = (i: number) => {
          if (q.type === 'MULTIPLE_SELECT') onChange({ ...q, correct: q.correct.includes(i) ? q.correct.filter((x) => x !== i) : [...q.correct, i].sort() });
          else onChange({ ...q, correct: i });
        };
        const remove = (i: number) => {
          const choices = q.choices.filter((_, j) => j !== i);
          if (q.type === 'MULTIPLE_SELECT') onChange({ ...q, choices, correct: q.correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) });
          else onChange({ ...q, choices, correct: q.correct === i ? 0 : q.correct > i ? q.correct - 1 : q.correct });
        };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabelStyle}>Choices (at least 2) — {multi ? 'tick every correct one' : 'select the correct one'}</span>
            {q.choices.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={`correct-${q.id}`}
                  checked={isCorrect(i)}
                  onChange={() => toggle(i)}
                  aria-label={`Choice ${LETTERS[i]} is correct`}
                />
                <span style={{ width: 16, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{LETTERS[i]}</span>
                <input
                  value={c}
                  placeholder={`Choice ${LETTERS[i]}`}
                  onChange={(e) => onChange({ ...q, choices: q.choices.map((x, j) => (j === i ? e.target.value : x)) } as Question)}
                  style={{ ...small, borderColor: isCorrect(i) ? 'var(--primary)' : undefined }}
                />
                <IconButton label={`Remove choice ${LETTERS[i]}`} disabledReason="Needs at least 2 choices" disabled={q.choices.length <= 2} onClick={() => remove(i)}>
                  ✕
                </IconButton>
              </div>
            ))}
            <AddLink disabled={q.choices.length >= 8} onClick={() => onChange({ ...q, choices: [...q.choices, ''] } as Question)}>
              + Add choice
            </AddLink>
          </div>
        );
      }
      case 'TRUE_FALSE':
        return (
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <span style={{ ...fieldLabelStyle, marginBottom: 0 }}>Correct answer</span>
            {[true, false].map((v) => (
              <label key={String(v)} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input type="radio" name={`tf-${q.id}`} checked={q.correct === v} onChange={() => onChange({ ...q, correct: v })} />
                {v ? 'True' : 'False'}
              </label>
            ))}
          </div>
        );
      case 'SHORT_ANSWER':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabelStyle}>Accepted answers</span>
            <TextList values={q.accepted} min={1} max={10} placeholder={() => 'e.g. Photosynthesis'} addLabel="+ Add another accepted answer" onChange={(accepted) => onChange({ ...q, accepted })} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Capital letters, extra spaces and a final period don’t matter. Add spelling variants you’ll accept.</span>
          </div>
        );
      case 'ENUMERATION':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabelStyle}>Answers ({q.answers.length}, at least 2) — students get a share of the points for each one</span>
            <TextList values={q.answers} min={2} max={20} placeholder={(i) => `Answer ${i + 1}`} addLabel="+ Add answer" onChange={(answers) => onChange({ ...q, answers })} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={q.ordered} onChange={(e) => onChange({ ...q, ordered: e.target.checked })} />
              Answers must be in this order
            </label>
          </div>
        );
      case 'MATCHING':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={fieldLabelStyle}>Pairs (at least 2) — students see the matches shuffled</span>
            {q.pairs.map((pair, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 22, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}.</span>
                <input
                  value={pair.left}
                  placeholder="Item"
                  onChange={(e) => onChange({ ...q, pairs: q.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })}
                  style={small}
                />
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <input
                  value={pair.right}
                  placeholder="Its match"
                  onChange={(e) => onChange({ ...q, pairs: q.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })}
                  style={small}
                />
                <IconButton label="Remove pair" disabledReason="Needs at least 2 pairs" disabled={q.pairs.length <= 2} onClick={() => onChange({ ...q, pairs: q.pairs.filter((_, j) => j !== i) })}>
                  ✕
                </IconButton>
              </div>
            ))}
            <AddLink disabled={q.pairs.length >= 12} onClick={() => onChange({ ...q, pairs: [...q.pairs, { left: '', right: '' }] })}>
              + Add pair
            </AddLink>
          </div>
        );
      case 'ESSAY':
        return (
          <label>
            <span style={fieldLabelStyle}>Grading guide (only you see this)</span>
            <textarea
              rows={2}
              value={q.guide}
              placeholder="What a full-marks answer should include"
              onChange={(e) => onChange({ ...q, guide: e.target.value })}
              style={{ ...small, resize: 'vertical' }}
            />
          </label>
        );
    }
  }

  return (
    <fieldset disabled={locked} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <legend style={{ float: 'left', padding: 0, fontWeight: 700, fontSize: 14, color: 'var(--text)', flex: 1 }}>
          Question {index + 1} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>· {typeLabel(q.type)}</span>
        </legend>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          Points
          <input
            type="number"
            min={1}
            max={100}
            value={q.points}
            onChange={(e) => onChange({ ...q, points: Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))) })}
            style={{ ...small, width: 70 }}
            aria-label={`Question ${index + 1} points`}
          />
        </label>
        <IconButton label="Move question up" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </IconButton>
        <IconButton label="Move question down" disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </IconButton>
        <IconButton label="Remove question" onClick={onRemove}>
          ✕
        </IconButton>
      </div>
      <textarea
        rows={2}
        value={q.prompt}
        placeholder="Type the question…"
        aria-label={`Question ${index + 1}`}
        onChange={(e) => onChange({ ...q, prompt: e.target.value })}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
      {body()}
    </fieldset>
  );
}
