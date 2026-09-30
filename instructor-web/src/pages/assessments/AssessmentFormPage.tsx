import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { PrimaryButton, SecondaryButton } from '../../components/ui';
import { FormModal, fieldLabelStyle, inputStyle } from '../../components/Modal';
import { ApiError, apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import type { ClassRecord } from '../../data/classOptions';
import QuestionEditor from './QuestionEditor';
import { QUESTION_TYPES, kindLabel, kindPlural, listPath, newQuestion } from './assessmentTypes';
import type { AssessmentDetail, AssessmentKind, Question } from './assessmentTypes';

const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 };

// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const DEFAULTS: Record<AssessmentKind, { timeLimitMinutes: number | null; maxAttempts: number | null; showAnswers: boolean }> = {
  QUIZ: { timeLimitMinutes: null, maxAttempts: null, showAnswers: true },
  EXAM: { timeLimitMinutes: 60, maxAttempts: 1, showAnswers: false },
};

// /classes/:id/assessments/new?kind=QUIZ|EXAM and /classes/:id/assessments/:assessmentId/edit
export default function AssessmentFormPage() {
  const { id: classId, assessmentId } = useParams<{ id: string; assessmentId?: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(assessmentId);
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const startKind: AssessmentKind = searchParams.get('kind') === 'EXAM' ? 'EXAM' : 'QUIZ';
  const [cls, setCls] = useState<ClassRecord | null>(null);
  const [loaded, setLoaded] = useState(!isEdit);
  const [kind, setKind] = useState<AssessmentKind>(startKind);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [timeLimit, setTimeLimit] = useState<number | null>(DEFAULTS[startKind].timeLimitMinutes);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(DEFAULTS[startKind].maxAttempts);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [showAnswers, setShowAnswers] = useState(DEFAULTS[startKind].showAnswers);
  const [published, setPublished] = useState(false);
  const [submissions, setSubmissions] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiRequest<{ class: ClassRecord }>(`/api/instructor/classes/${classId}`, { token: accessToken })
      .then((d) => setCls(d.class))
      .catch(() => undefined);
    if (!assessmentId) return;
    apiRequest<{ assessment: AssessmentDetail }>(`/api/instructor/classes/${classId}/assessments/${assessmentId}`, { token: accessToken })
      .then(({ assessment: a }) => {
        setKind(a.kind);
        setTitle(a.title);
        setInstructions(a.instructions ?? '');
        setQuestions(a.questions);
        setTimeLimit(a.timeLimitMinutes);
        setMaxAttempts(a.maxAttempts);
        setOpensAt(toLocalInput(a.opensAt));
        setClosesAt(toLocalInput(a.closesAt));
        setShowAnswers(a.showAnswers);
        setPublished(a.published);
        setSubmissions(a.submissions);
        setLoaded(true);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Unable to load'));
  }, [classId, assessmentId, accessToken]);

  const locked = submissions > 0;
  const total = questions.reduce((sum, q) => sum + q.points, 0);
  // Back to the Quizzes or Exams tab this belongs to.
  const listUrl = listPath(classId, kind);

  function chooseKind(next: AssessmentKind) {
    setKind(next);
    // A brand-new one takes the new kind's usual settings; an existing one keeps what was set.
    if (!isEdit) {
      setTimeLimit(DEFAULTS[next].timeLimitMinutes);
      setMaxAttempts(DEFAULTS[next].maxAttempts);
      setShowAnswers(DEFAULTS[next].showAnswers);
    }
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    setQuestions((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save(publish: boolean) {
    setSaving(true);
    setError(null);
    const body = {
      kind,
      title: title.trim(),
      instructions: instructions.trim() || null,
      questions,
      timeLimitMinutes: timeLimit,
      maxAttempts,
      opensAt: fromLocalInput(opensAt),
      closesAt: fromLocalInput(closesAt),
      showAnswers,
      published: publish,
    };
    try {
      if (isEdit) await apiRequest(`/api/instructor/classes/${classId}/assessments/${assessmentId}`, { method: 'PUT', token: accessToken, body });
      else await apiRequest(`/api/instructor/classes/${classId}/assessments`, { method: 'POST', token: accessToken, body });
      navigate(listUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save');
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await apiRequest(`/api/instructor/classes/${classId}/assessments/${assessmentId}`, { method: 'DELETE', token: accessToken });
      navigate(listUrl, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const noun = kindLabel(kind).toLowerCase();

  return (
    <Layout>
      <nav style={{ fontSize: 13, marginBottom: 14, display: 'flex', gap: 8 }}>
        <Link to="/classes">My Classes</Link>
        <span style={{ color: 'var(--text-faint)' }}>›</span>
        <Link to={`/classes/${classId}`}>{cls ? `${cls.subjectCode} · Section ${cls.section}` : 'Class'}</Link>
        <span style={{ color: 'var(--text-faint)' }}>›</span>
        <Link to={listUrl}>{kindPlural(kind)}</Link>
        <span style={{ color: 'var(--text-faint)' }}>›</span>
        <span style={{ fontWeight: 600 }}>{isEdit ? `Edit ${noun}` : `New ${noun}`}</span>
      </nav>

      {loaded && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void save(published);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)' }}>{isEdit ? `Edit ${noun}` : `New ${noun}`}</div>
            <div role="radiogroup" aria-label="Type" style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 100, padding: 3 }}>
              {(['QUIZ', 'EXAM'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => chooseKind(k)}
                  style={{
                    border: 'none',
                    borderRadius: 100,
                    padding: '6px 16px',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    background: kind === k ? 'var(--primary)' : 'transparent',
                    color: kind === k ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {kindLabel(k)}
                </button>
              ))}
            </div>
          </div>

          {locked && (
            <div style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              {submissions} submission{submissions === 1 ? '' : 's'} so far, so the questions are locked (changing them would change students’ marks). You can
              still change the title, instructions and settings.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: 18, alignItems: 'start' }}>
            <div style={card}>
              <label>
                <span style={fieldLabelStyle}>Title</span>
                <input required value={title} maxLength={160} placeholder={kind === 'EXAM' ? 'Midterm exam' : 'Chapter 2 quiz'} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
              </label>
              <label>
                <span style={fieldLabelStyle}>Instructions (optional)</span>
                <textarea rows={3} value={instructions} placeholder="Shown to students before they start" onChange={(e) => setInstructions(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
              </label>
            </div>

            <div style={card}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Settings</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={timeLimit !== null} onChange={(e) => setTimeLimit(e.target.checked ? 30 : null)} />
                Time limit
                {timeLimit !== null && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={timeLimit}
                      aria-label="Time limit in minutes"
                      onChange={(e) => setTimeLimit(Math.max(1, Math.min(600, Math.round(Number(e.target.value) || 1))))}
                      style={{ ...inputStyle, width: 80, padding: '6px 8px' }}
                    />
                    minutes
                  </>
                )}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                Attempts
                <select
                  value={maxAttempts === null ? '' : String(maxAttempts)}
                  onChange={(e) => setMaxAttempts(e.target.value ? Number(e.target.value) : null)}
                  style={{ ...inputStyle, width: 'auto', padding: '6px 8px' }}
                >
                  <option value="">Unlimited</option>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span style={fieldLabelStyle}>Opens (optional)</span>
                <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} style={inputStyle} />
              </label>
              <label>
                <span style={fieldLabelStyle}>Closes (optional)</span>
                <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
                Show students the correct answers after they submit
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              Questions <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({questions.length} · {total} points)</span>
            </div>
          </div>

          {questions.length === 0 && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              No questions yet. Add one of any type below — you can mix types.
            </div>
          )}
          {questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              question={q}
              index={i}
              count={questions.length}
              locked={locked}
              onChange={(next) => setQuestions((list) => list.map((x) => (x.id === q.id ? next : x)))}
              onMove={(delta) => moveQuestion(i, delta)}
              onRemove={() => setQuestions((list) => list.filter((x) => x.id !== q.id))}
            />
          ))}

          {!locked && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
              <div style={{ ...fieldLabelStyle, marginBottom: 10 }}>Add a question</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUESTION_TYPES.map((t) => (
                  <SecondaryButton key={t.type} title={t.hint} onClick={() => setQuestions((list) => [...list, newQuestion(t.type)])}>
                    + {t.label}
                  </SecondaryButton>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', position: 'sticky', bottom: 0, background: '#fff', padding: '12px 0', borderTop: '1px solid var(--border-light)' }}>
            {isEdit && (
              <SecondaryButton onClick={() => setConfirmDelete(true)} style={{ color: 'var(--danger-text)', marginRight: 'auto' }}>
                Delete {noun}
              </SecondaryButton>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>{published ? 'Published — students can see it' : 'Draft — students can’t see it yet'}</span>
            <SecondaryButton onClick={() => navigate(listUrl)} disabled={saving}>
              Cancel
            </SecondaryButton>
            {published ? (
              <>
                <SecondaryButton onClick={() => void save(false)} disabled={saving}>
                  Unpublish
                </SecondaryButton>
                <PrimaryButton type="button" onClick={() => void save(true)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </PrimaryButton>
              </>
            ) : (
              <>
                <SecondaryButton onClick={() => void save(false)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save draft'}
                </SecondaryButton>
                <PrimaryButton type="button" onClick={() => void save(true)} disabled={saving}>
                  Publish
                </PrimaryButton>
              </>
            )}
          </div>
        </form>
      )}
      {!loaded && error && <div style={{ color: 'var(--danger-text)' }}>{error}</div>}

      {confirmDelete && (
        <FormModal
          title={`Delete this ${noun}?`}
          submitLabel={`Delete ${kindLabel(kind)}`}
          busyLabel="Deleting…"
          danger
          busy={deleting}
          error={null}
          onSubmit={() => void remove()}
          onClose={() => setConfirmDelete(false)}
        >
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            This permanently deletes “{title || 'Untitled'}”{submissions ? ` and all ${submissions} student submission${submissions === 1 ? '' : 's'}` : ''}.
          </div>
        </FormModal>
      )}
    </Layout>
  );
}
