import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { PrimaryButton, Tag } from '../../components/ui';
import { fieldLabelStyle, inputStyle } from '../../components/Modal';
import { ApiError, apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { formatDateTime, kindPlural, listPath, score, typeLabel } from './assessmentTypes';
import type { AssessmentKind, Question } from './assessmentTypes';

interface AttemptView {
  id: string;
  student: { firstName: string; lastName: string; srCode: string | null };
  submittedAt: string;
  score: number | null;
  maxScore: number;
  needsGrading: boolean;
  assessment: { id: string; title: string; kind: AssessmentKind };
  questions: { question: Question; answer: unknown; result: { points: number; graded: boolean; feedback?: string } }[];
}

const LETTERS = 'ABCDEFGH';
const right = { color: 'var(--primary)', fontWeight: 700 } as const;
const wrong = { color: 'var(--danger-text)', fontWeight: 700 } as const;

function Line({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, padding: '3px 0' }}>
      <span style={ok === null ? { width: 14 } : ok ? { ...right, width: 14 } : { ...wrong, width: 14 }}>{ok === null ? '' : ok ? '✓' : '✗'}</span>
      <span>{children}</span>
    </div>
  );
}

// The student's answer against the key, per question type.
function AnswerView({ q, answer }: { q: Question; answer: unknown }) {
  const none = <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>No answer</div>;
  switch (q.type) {
    case 'MULTIPLE_CHOICE':
    case 'MULTIPLE_SELECT': {
      const picked = q.type === 'MULTIPLE_SELECT' ? (Array.isArray(answer) ? (answer as number[]) : []) : typeof answer === 'number' ? [answer] : [];
      const correct = q.type === 'MULTIPLE_SELECT' ? q.correct : [q.correct];
      return (
        <div>
          {q.choices.map((c, i) => (
            <Line key={i} ok={picked.includes(i) ? correct.includes(i) : null}>
              <b>{LETTERS[i]}.</b> {c}
              {correct.includes(i) && <span style={{ ...right, fontSize: 11, marginLeft: 8 }}>correct</span>}
              {picked.includes(i) && <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--text-muted)' }}>(student’s pick)</span>}
            </Line>
          ))}
        </div>
      );
    }
    case 'TRUE_FALSE':
      return typeof answer === 'boolean' ? (
        <Line ok={answer === q.correct}>
          Answered <b>{answer ? 'True' : 'False'}</b> · correct is <b>{q.correct ? 'True' : 'False'}</b>
        </Line>
      ) : (
        none
      );
    case 'SHORT_ANSWER':
      return (
        <div>
          {typeof answer === 'string' && answer.trim() ? <div style={{ fontSize: 14, fontWeight: 600 }}>“{answer}”</div> : none}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Accepted: {q.accepted.join(' · ')}</div>
        </div>
      );
    case 'ENUMERATION': {
      const given = Array.isArray(answer) ? (answer as string[]) : [];
      return (
        <div>
          {given.filter((g) => g.trim()).length === 0 ? none : given.map((g, i) => <Line key={i} ok={null}>{g || <span style={{ color: 'var(--text-faint)' }}>(blank)</span>}</Line>)}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Expected{q.ordered ? ' (in order)' : ''}: {q.answers.join(' · ')}
          </div>
        </div>
      );
    }
    case 'MATCHING': {
      const given = Array.isArray(answer) ? (answer as (string | null)[]) : [];
      return (
        <div>
          {q.pairs.map((p, i) => (
            <Line key={i} ok={given[i] ? given[i]!.trim().toLowerCase() === p.right.trim().toLowerCase() : false}>
              {p.left} → <b>{given[i] ?? '—'}</b>
              {given[i]?.trim().toLowerCase() !== p.right.trim().toLowerCase() && <span style={{ ...right, fontSize: 11, marginLeft: 8 }}>{p.right}</span>}
            </Line>
          ))}
        </div>
      );
    }
    case 'ESSAY':
      return (
        <div>
          {typeof answer === 'string' && answer.trim() ? (
            <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--table-header-bg)', borderRadius: 8, padding: 12 }}>{answer}</div>
          ) : (
            none
          )}
          {q.guide && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Your guide: {q.guide}</div>}
        </div>
      );
  }
}

// /classes/:id/assessments/:assessmentId/attempts/:attemptId — one submission: grade essays, override any mark.
export default function AttemptPage() {
  const { id: classId, assessmentId, attemptId } = useParams<{ id: string; assessmentId: string; attemptId: string }>();
  const { accessToken } = useAuth();
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [edits, setEdits] = useState<Record<string, { points: string; feedback: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const base = `/api/instructor/classes/${classId}/assessments/${assessmentId}/attempts/${attemptId}`;

  function load(view: AttemptView) {
    setAttempt(view);
    setEdits(Object.fromEntries(view.questions.map(({ question, result }) => [question.id, { points: result.graded ? String(result.points) : '', feedback: result.feedback ?? '' }])));
  }

  useEffect(() => {
    apiRequest<{ attempt: AttemptView }>(base, { token: accessToken })
      .then((d) => load(d.attempt))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Unable to load submission'));
  }, [base, accessToken]);

  async function save() {
    if (!attempt) return;
    const grades: Record<string, { points: number; feedback?: string }> = {};
    for (const { question, result } of attempt.questions) {
      const e = edits[question.id];
      if (!e || e.points.trim() === '') continue;
      const points = Number(e.points);
      if (!Number.isFinite(points) || points < 0 || points > question.points) {
        setError(`Points for question ${attempt.questions.findIndex((x) => x.question.id === question.id) + 1} must be between 0 and ${question.points}.`);
        return;
      }
      if (points !== result.points || !result.graded || e.feedback.trim() !== (result.feedback ?? '')) grades[question.id] = { points, feedback: e.feedback };
    }
    setSaving(true);
    setError(null);
    try {
      const d = await apiRequest<{ attempt: AttemptView }>(`${base}/grades`, { method: 'PUT', token: accessToken, body: { grades } });
      load(d.attempt);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save grades');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <nav style={{ fontSize: 13, marginBottom: 14, display: 'flex', gap: 8 }}>
        <Link to={attempt ? listPath(classId, attempt.assessment.kind) : `/classes/${classId}`}>{attempt ? kindPlural(attempt.assessment.kind) : 'Class'}</Link>
        <span style={{ color: 'var(--text-faint)' }}>›</span>
        <Link to={`/classes/${classId}/assessments/${assessmentId}`}>{attempt?.assessment.title ?? 'Results'}</Link>
      </nav>
      {error && !attempt && <div style={{ color: 'var(--danger-text)' }}>{error}</div>}
      {attempt && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 22 }}>
                {attempt.student.lastName}, {attempt.student.firstName}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {attempt.student.srCode} · submitted {formatDateTime(attempt.submittedAt)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 26, color: 'var(--primary)' }}>
                {score(attempt.score)} / {attempt.maxScore}
              </div>
              {attempt.needsGrading ? <Tag tone="warning">Essays to grade</Tag> : <Tag tone="success">Fully graded</Tag>}
            </div>
          </div>

          {attempt.questions.map(({ question: q, answer, result }, i) => (
            <div key={q.id} style={{ border: `1px solid ${result.graded ? 'var(--border)' : 'var(--warning-text)'}`, borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 18 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Question {i + 1} · {typeLabel(q.type)}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{q.prompt}</div>
                <AnswerView q={q} answer={answer} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label>
                  <span style={fieldLabelStyle}>Points (of {q.points})</span>
                  <input
                    type="number"
                    min={0}
                    max={q.points}
                    step="0.5"
                    value={edits[q.id]?.points ?? ''}
                    placeholder={result.graded ? '' : 'Grade'}
                    aria-label={`Question ${i + 1} points`}
                    onChange={(e) => {
                      setEdits((m) => ({ ...m, [q.id]: { ...m[q.id], points: e.target.value } }));
                      setSaved(false);
                    }}
                    style={{ ...inputStyle, padding: '8px 10px', borderColor: result.graded ? undefined : 'var(--warning-text)' }}
                  />
                </label>
                <label>
                  <span style={fieldLabelStyle}>Feedback (optional)</span>
                  <textarea
                    rows={2}
                    value={edits[q.id]?.feedback ?? ''}
                    onChange={(e) => {
                      setEdits((m) => ({ ...m, [q.id]: { ...m[q.id], feedback: e.target.value } }));
                      setSaved(false);
                    }}
                    style={{ ...inputStyle, padding: '8px 10px', fontSize: 13, resize: 'vertical' }}
                  />
                </label>
              </div>
            </div>
          ))}

          {error && (
            <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, position: 'sticky', bottom: 0, background: '#fff', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
            {saved && <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>✓ Grades saved</span>}
            <PrimaryButton onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save grades'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Layout>
  );
}
