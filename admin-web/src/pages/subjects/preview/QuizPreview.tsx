import { useState } from 'react';
import { CHOICE_LETTERS, cleanChoices } from '../subjectsData';
import type { QuizQuestion } from '../subjectsData';
import { MobileButton, MobileProgressBar, PreviewLayout, mobileFooter, mobileScroll } from './PhoneFrame';

// Which questions the app would show, and what's wrong with the rest (listed beside the phone).
export function quizPreviewParts(title: string, questions: QuizQuestion[]) {
  const notes: string[] = [];
  const shown: QuizQuestion[] = [];
  for (const [n, q] of questions.entries()) {
    const label = `Question ${n + 1}`;
    const cleaned = cleanChoices(q.choices, q.correctChoice);
    if (!q.prompt.trim()) notes.push(`${label} needs a prompt.`);
    else if (typeof cleaned === 'string') notes.push(`${label}: ${cleaned}.`);
    else shown.push({ prompt: q.prompt.trim(), ...cleaned });
  }
  if (!title.trim()) notes.unshift('The quiz needs a title.');
  return { shown, notes };
}

// The unsaved quiz as student-mobile's QuizScreen shows it: one question at a time, then the score and answer review.
// Incomplete questions are left out and listed beside the phone.
export default function QuizPreview(props: { title: string; crumb: string; questions: QuizQuestion[] }) {
  return (
    <PreviewLayout notes={quizPreviewParts(props.title, props.questions).notes}>
      <QuizScreen {...props} />
    </PreviewLayout>
  );
}

// The phone screen itself; the module preview passes onClose/onSubmitted to walk through a module.
export function QuizScreen({
  title,
  crumb,
  questions,
  onClose,
  onSubmitted,
}: {
  title: string;
  crumb: string;
  questions: QuizQuestion[];
  onClose?: () => void;
  onSubmitted?: () => void;
}) {
  const { shown } = quizPreviewParts(title, questions);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const i = Math.min(index, Math.max(shown.length - 1, 0));
  const q = shown[i];
  const selected = answers[i] ?? null;
  const isLast = i === shown.length - 1;
  const allAnswered = shown.every((_, qi) => answers[qi] !== null && answers[qi] !== undefined);
  const score = shown.filter((sq, qi) => answers[qi] === sq.correctChoice).length;

  function restart() {
    setAnswers([]);
    setIndex(0);
    setSubmitted(false);
  }

  const header = (
    <div style={{ padding: 16, paddingLeft: 20, paddingRight: 20, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', overflowWrap: 'anywhere' }}>{title.trim() || 'Quiz'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{crumb}</div>
        </div>
        <button
          type="button"
          aria-label="Close quiz"
          onClick={onClose}
          style={{ border: 'none', background: 'none', padding: 0, alignSelf: 'flex-start', fontSize: 18, fontWeight: 600, color: 'var(--text-muted)', cursor: onClose ? 'pointer' : 'default' }}
        >
          ✕
        </button>
      </div>
      {!submitted && shown.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MobileProgressBar pct={((i + 1) / shown.length) * 100} />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
            Q{i + 1} of {shown.length}
          </span>
        </div>
      )}
    </div>
  );

  if (shown.length === 0) {
    return (
      <>
        {header}
        <div style={{ ...mobileScroll, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontSize: 14, fontWeight: 500, color: 'var(--danger-text)' }}>
          This quiz doesn't have any questions yet.
        </div>
      </>
    );
  }

  if (submitted) {
    const pct = Math.round((score / shown.length) * 100);
    return (
      <>
        {header}
        <div style={{ ...mobileScroll, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--primary-light)', borderRadius: 16, padding: 20, textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--primary)' }}>
              {score}/{shown.length}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{pct}%</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {pct === 100 ? 'Perfect score!' : pct >= 75 ? 'Nice work.' : 'Review the answers below and try again.'}
            </div>
          </div>
          {shown.map((sq, qi) => (
            <div key={qi} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '20px', color: 'var(--text)' }}>
                {qi + 1}. {sq.prompt}
              </div>
              {sq.choices.map((choice, ci) => {
                const isCorrect = ci === sq.correctChoice;
                const isChosen = ci === answers[qi];
                return (
                  <div
                    key={ci}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderRadius: 8,
                      padding: '8px 10px',
                      background: isCorrect ? 'var(--primary-light)' : isChosen ? 'var(--danger-bg)' : undefined,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: 14 }}>{CHOICE_LETTERS[ci]}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{choice}</span>
                    {isCorrect && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>Correct</span>}
                    {isChosen && !isCorrect && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger-text)' }}>Your answer</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ ...mobileFooter, gap: 10 }}>
          <MobileButton secondary label="Retake quiz" onClick={restart} />
          <MobileButton label="Done" onClick={onClose ?? restart} />
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div style={{ ...mobileScroll, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{q.prompt}</div>
        {q.choices.map((choice, ci) => {
          const active = ci === selected;
          return (
            <button
              key={ci}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() =>
                setAnswers((prev) => {
                  const next = [...prev];
                  next[i] = ci;
                  return next;
                })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: active ? 'var(--primary-light)' : '#fff',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  flexShrink: 0,
                  border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                  background: active ? 'var(--primary)' : undefined,
                }}
              />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{choice}</span>
            </button>
          );
        })}
      </div>
      <div style={{ ...mobileFooter, flexDirection: 'row', gap: 10 }}>
        {i > 0 && (
          <div style={{ flex: 1 }}>
            <MobileButton secondary label="Back" onClick={() => setIndex(i - 1)} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          {isLast ? (
            <MobileButton label={allAnswered ? 'Submit' : 'Answer every question'} disabled={!allAnswered} onClick={() => {
                setSubmitted(true);
                onSubmitted?.();
              }}
            />
          ) : (
            <MobileButton label="Next" disabled={selected === null} onClick={() => setIndex(i + 1)} />
          )}
        </div>
      </div>
    </>
  );
}
