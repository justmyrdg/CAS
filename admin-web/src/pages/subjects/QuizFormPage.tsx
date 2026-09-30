import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SecondaryButton } from '../../components/ui';
import { fieldLabelStyle, inputStyle } from '../../components/Modal';
import { apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { ConfirmDeleteDialog, DangerButton, FormPage, IconButton, SavedNote } from './components';
import { useReportDirty } from './ModuleWorkspace';
import ChoiceEditor from './ChoiceEditor';
import QuizPreview from './preview/QuizPreview';
import { cleanChoices, errorMessage, plural } from './subjectsData';
import type { QuizQuestion } from './subjectsData';
import { useContentEditor } from './useContentEditor';

// `key` is local-only so React can track rows while they're added/removed/reordered.
interface QuestionDraft extends QuizQuestion {
  key: number;
}

// Compared against the last saved state to know whether there are unsaved changes (row keys don't count).
const snapshotOf = (title: string, questions: QuizQuestion[]) =>
  JSON.stringify([title, questions.map((q) => [q.prompt, q.choices, q.correctChoice])]);

// Keyed by route so switching quizzes in the module outline starts a fresh form.
export default function QuizFormPage() {
  const { itemId, chapterId } = useParams();
  return <QuizForm key={itemId ?? `new-${chapterId}`} />;
}

function QuizForm() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const routeState = useLocation().state as { created?: boolean } | null;
  const editor = useContentEditor(accessToken);
  const { isEdit, item, location, moduleUrl, subjectUrl, reload } = editor;

  const nextKey = useRef(0);
  const blankQuestion = (): QuestionDraft => ({ key: nextKey.current++, prompt: '', choices: ['', '', '', ''], correctChoice: 0 });

  const [title, setTitle] = useState('');
  // A new quiz starts with one blank question (fixed key: refs can't be read during render; later keys come from nextKey, which starts at 0).
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    isEdit ? [] : [{ key: -1, prompt: '', choices: ['', '', '', ''], correctChoice: 0 }],
  );
  const [filled, setFilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(routeState?.created ? 'Quiz created' : null);
  const [deleting, setDeleting] = useState(false);
  const deleted = useRef(false);

  const snapshot = snapshotOf(title, questions);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  useReportDirty(dirty);

  useEffect(() => {
    if (item && !filled) {
      setTitle(item.title);
      setQuestions(item.questions.map((q) => ({ key: nextKey.current++, prompt: q.prompt, choices: [...q.choices], correctChoice: q.correctChoice })));
      setSavedSnapshot(snapshotOf(item.title, item.questions));
      setFilled(true);
    }
  }, [item, filled]);

  function updateQuestion(key: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    setQuestions((qs) => {
      const target = index + delta;
      if (target < 0 || target >= qs.length) return qs;
      const next = [...qs];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // Blank choices are dropped; returns an error message, or the cleaned questions.
  function prepare(): string | QuizQuestion[] {
    if (questions.length === 0) return 'Add at least one question.';
    const cleaned: QuizQuestion[] = [];
    for (const [n, q] of questions.entries()) {
      const label = `Question ${n + 1}`;
      if (!q.prompt.trim()) return `${label} needs a prompt.`;
      const cleaned_ = cleanChoices(q.choices, q.correctChoice);
      if (typeof cleaned_ === 'string') return `${label}: ${cleaned_}.`;
      cleaned.push({ prompt: q.prompt.trim(), ...cleaned_ });
    }
    return cleaned;
  }

  async function save() {
    const prepared = prepare();
    if (typeof prepared === 'string') {
      setError(prepared);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { title: title.trim(), questions: prepared };
      if (isEdit && item) {
        await apiRequest(`/api/admin/catalog/content/${item.id}`, { method: 'PUT', token: accessToken, body: payload });
        setSavedSnapshot(snapshot);
        setSavedNote('Changes saved');
        setSaving(false);
        await reload();
      } else {
        const data = await apiRequest<{ item: { id: string } }>(`/api/admin/catalog/chapters/${editor.chapterId}/content`, {
          method: 'POST',
          token: accessToken,
          body: { type: 'QUIZ', ...payload },
        });
        // Reload first so the outline already has the new quiz when its edit page opens.
        await reload();
        navigate(`${subjectUrl}/quizzes/${data.item.id}/edit`, { replace: true, state: { created: true } });
      }
    } catch (err) {
      setError(errorMessage(err, 'Unable to save quiz'));
      setSaving(false);
    }
  }

  // The outline has the quiz as last saved (item is from when the editor opened).
  const saved = location?.chapter.items.find((i) => i.id === item?.id);

  return (
    <>
      {editor.loadError && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{editor.loadError}</div>}

      {editor.ready && location && (!isEdit || filled) && (
        <FormPage
          title={isEdit ? 'Edit Quiz' : 'New Quiz'}
          subtitle={`Chapter ${location.moduleIndex + 1}.${location.chapterIndex + 1} — ${location.chapter.title} · multiple choice, one correct answer per question`}
          error={error}
          saving={saving}
          saveLabel={isEdit ? 'Save Quiz' : 'Create Quiz'}
          onCancel={() => navigate(moduleUrl)}
          onSubmit={() => void save()}
          previews={[{ label: 'Preview', render: () => <QuizPreview title={title} crumb={location.chapter.title} questions={questions} /> }]}
          footerStart={
            <>
              {isEdit && <DangerButton onClick={() => setDeleting(true)}>Delete Quiz</DangerButton>}
              {savedNote && !dirty && <SavedNote>{savedNote}</SavedNote>}
            </>
          }
        >
          <label>
            <span style={fieldLabelStyle}>Quiz title</span>
            <input required autoFocus={!isEdit} placeholder="Chapter 2 check" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </label>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
              Questions <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({questions.length})</span>
            </div>

            {questions.map((q, qi) => (
              <fieldset key={q.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <legend style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', flex: 1, padding: 0, float: 'left' }}>Question {qi + 1}</legend>
                  <IconButton label="Move question up" disabled={qi === 0} onClick={() => moveQuestion(qi, -1)}>
                    ↑
                  </IconButton>
                  <IconButton label="Move question down" disabled={qi === questions.length - 1} onClick={() => moveQuestion(qi, 1)}>
                    ↓
                  </IconButton>
                  <IconButton label="Remove question" onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}>
                    ✕
                  </IconButton>
                </div>

                <textarea
                  aria-label={`Question ${qi + 1} prompt`}
                  rows={2}
                  placeholder="Type the question…"
                  value={q.prompt}
                  onChange={(e) => updateQuestion(q.key, { prompt: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }}
                />

                <ChoiceEditor
                  name={`correct-${q.key}`}
                  label={`Question ${qi + 1}`}
                  choices={q.choices}
                  correctChoice={q.correctChoice}
                  onChange={(next) => updateQuestion(q.key, next)}
                />
              </fieldset>
            ))}

            <div>
              <SecondaryButton onClick={() => setQuestions((qs) => [...qs, blankQuestion()])}>+ Add Question</SecondaryButton>
            </div>
          </div>
        </FormPage>
      )}

      {deleting && item && (
        <ConfirmDeleteDialog
          title="Delete quiz?"
          message={`This permanently deletes “${saved?.title ?? item.title}” and its ${plural(saved?.questionCount ?? item.questions.length, 'question')}.`}
          confirmLabel="Delete Quiz"
          remove={async () => {
            await apiRequest(`/api/admin/catalog/content/${item.id}`, { method: 'DELETE', token: accessToken });
            deleted.current = true;
          }}
          onClose={() => {
            setDeleting(false);
            if (!deleted.current) return;
            navigate(moduleUrl, { replace: true });
            void reload();
          }}
        />
      )}
    </>
  );
}
