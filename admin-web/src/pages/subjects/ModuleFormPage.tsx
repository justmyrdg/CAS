import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../../components/ui';
import { fieldLabelStyle, inputStyle } from '../../components/Modal';
import { apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { FormPage, IconButton, SavedNote, Tabs } from './components';
import { contentPath, useReportDirty, useWorkspace } from './ModuleWorkspace';
import { errorMessage, plural } from './subjectsData';
import type { ContentOutline, ModuleItem } from './subjectsData';
import ModuleOverview from './preview/ModuleOverview';
import ModulePreview from './preview/ModulePreview';
import { useModuleContent } from './preview/moduleView';
import type { ModuleView } from './preview/moduleView';

// A chapter row in the editor. `key` is local-only (new rows have no id until saved).
interface ChapterDraft {
  key: number;
  id?: string;
  title: string;
  description: string;
}

interface SavedModule {
  id: string;
}

// Rendered inside ModuleWorkspace.
// /subjects/:subjectId/modules/new  — module title/description + chapters.
// /subjects/:subjectId/modules/:moduleId/edit — "Module details" in the outline: opens read-only (Overview /
// Student preview tabs); "Edit Module" switches to the form, whose Overview / Student preview tabs show the
// unsaved draft. Chapter edits are drafts until "Save Module"; lessons and quizzes are opened from the outline.
export default function ModuleFormPage() {
  const { subjectId, moduleId } = useParams<{ subjectId: string; moduleId: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(moduleId);
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { subject, module: existing, moduleIndex, reload, go } = useWorkspace();

  const nextKey = useRef(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  // The saved module the form was last filled from; unsaved changes are measured against it.
  const [base, setBase] = useState<ModuleItem | null>(null);
  // Set after each save so new chapters pick up their ids (without unmounting the form).
  const [needsFill, setNeedsFill] = useState(isEdit);
  const ready = !isEdit || base !== null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  // A saved module opens read-only; new modules go straight to the form.
  const [editing, setEditing] = useState(!isEdit);
  const [viewTab, setViewTab] = useState('Overview');
  const content = useModuleContent(existing?.chapters.flatMap((c) => c.items) ?? [], accessToken);

  const moduleNumber = moduleIndex + 1;
  const subjectUrl = `/subjects/${subjectId}`;

  const filledChapters = () => chapters.filter((c) => c.title.trim() || c.description.trim());

  const dirty = isEdit
    ? !!base &&
      (title !== base.title ||
        description !== (base.description ?? '') ||
        filledChapters().length !== base.chapters.length ||
        filledChapters().some((c, i) => {
          const saved = base.chapters[i];
          return c.id !== saved.id || c.title !== saved.title || c.description !== (saved.description ?? '');
        }))
    : Boolean(title.trim() || description.trim() || filledChapters().length);
  useReportDirty(dirty);

  // Fill the form from the saved module: on load, after each save, and whenever the module changes
  // elsewhere (e.g. a chapter added from the outline) while there are no unsaved edits here.
  function fillFrom(saved: ModuleItem) {
    setTitle(saved.title);
    setDescription(saved.description ?? '');
    setChapters(saved.chapters.map((c) => ({ key: nextKey.current++, id: c.id, title: c.title, description: c.description ?? '' })));
    setBase(saved);
    setNeedsFill(false);
  }

  useEffect(() => {
    if (!existing || (!needsFill && (existing === base || dirty))) return;
    fillFrom(existing);
  }, [needsFill, existing, base, dirty]);

  function updateChapter(key: number, patch: Partial<ChapterDraft>) {
    setChapters((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function moveChapter(index: number, delta: -1 | 1) {
    setChapters((rows) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit() {
    const filled = filledChapters();
    const missingTitle = filled.find((c) => !c.title.trim());
    if (missingTitle) {
      setError(`Chapter ${chapters.indexOf(missingTitle) + 1} needs a title.`);
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      description: description.trim(),
      chapters: filled.map((c) => ({ ...(c.id ? { id: c.id } : {}), title: c.title.trim(), description: c.description.trim() })),
    };
    try {
      if (isEdit) {
        await apiRequest<{ module: SavedModule }>(`/api/admin/catalog/modules/${moduleId}`, { method: 'PUT', token: accessToken, body });
        await reload();
        setNeedsFill(true);
        setSavedNote(true);
        setSaving(false);
        setEditing(false);
      } else {
        const data = await apiRequest<{ module: SavedModule }>(`/api/admin/catalog/subjects/${subjectId}/modules`, { method: 'POST', token: accessToken, body });
        // A brand-new module goes straight to its edit page so lessons and quizzes can be added.
        navigate(`${subjectUrl}/modules/${data.module.id}/edit?created=1`, { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err, 'Unable to save module'));
      setSaving(false);
    }
  }

  const removedWithContent =
    existing?.chapters.filter((c) => c.items.length > 0 && !chapters.some((d) => d.id === c.id)).length ?? 0;

  if (!ready) return null;

  // What the Overview / Student preview tabs draw: the form's current (possibly unsaved) state.
  const view: ModuleView = {
    number: moduleNumber,
    title,
    description,
    chapters: filledChapters().map((c) => ({
      key: String(c.key),
      title: c.title,
      description: c.description,
      items: existing?.chapters.find((s) => s.id === c.id)?.items ?? [],
    })),
  };
  const draftNotes = [
    ...(dirty ? ['Showing unsaved changes — save the module to keep them.'] : []),
    ...(removedWithContent > 0 ? [`${plural(removedWithContent, 'removed chapter', 'removed chapters')} and their lessons/quizzes will be deleted when you save.`] : []),
  ];
  const openItem = (item: ContentOutline) => go(`${subjectUrl}/${contentPath(item.type)}/${item.id}/edit`);
  const overview = () => (
    <ModuleOverview view={view} details={content.details} arModelNames={content.arModelNames} error={content.error} notes={draftNotes} onEditItem={openItem} />
  );
  const studentPreview = () => (
    <ModulePreview view={view} subjectCode={subject.code} subjectName={subject.name} details={content.details} arModelNames={content.arModelNames} notes={draftNotes} />
  );
  const createdBanner = searchParams.get('created') === '1' && (
    <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
      Module created. Use “+ Lesson” and “+ Quiz” under each chapter in the outline to add content.
    </div>
  );
  const subtitle = `${subject.code} — ${subject.name}${isEdit ? ` · module ${moduleNumber}` : ` · will be added as module ${moduleNumber}`}`;

  if (!editing) {
    return (
      <div>
        {createdBanner}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)', marginBottom: 4 }}>Module details</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {savedNote && <SavedNote />}
            <PrimaryButton
              onClick={() => {
                setEditing(true);
                setSavedNote(false);
              }}
            >
              Edit Module
            </PrimaryButton>
          </div>
        </div>
        <Tabs label="Module view" tabs={['Overview', 'Student preview']} value={viewTab} onChange={setViewTab} />
        {viewTab === 'Overview' ? overview() : studentPreview()}
      </div>
    );
  }

  return (
    <>
      {createdBanner}

      <FormPage
        title={isEdit ? 'Module details' : 'New Module'}
        subtitle={subtitle}
        error={error}
        saving={saving}
        saveLabel={isEdit ? 'Save Module' : 'Create Module'}
        onCancel={() => {
          if (!isEdit) {
            navigate(subjectUrl);
            return;
          }
          // Back to the read-only view, dropping the draft.
          if (existing) fillFrom(existing);
          setError(null);
          setEditing(false);
        }}
        onSubmit={() => void submit()}
        previews={[
          { label: 'Overview', render: overview },
          { label: 'Student preview', render: studentPreview },
        ]}
      >
        <label>
          <span style={fieldLabelStyle}>Module title</span>
          <input required autoFocus={!isEdit} placeholder="Trees & Graphs" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </label>
        <label>
          <span style={fieldLabelStyle}>Description (optional)</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Chapters</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                In the order students will see them. Each chapter holds lessons and/or quizzes.
              </div>
            </div>
            <SecondaryButton onClick={() => setChapters((rows) => [...rows, { key: nextKey.current++, title: '', description: '' }])}>
              + Add Chapter
            </SecondaryButton>
          </div>

          {chapters.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              No chapters yet. Add one to start adding lessons and quizzes.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chapters.map((c, index) => {
                const items = existing?.chapters.find((s) => s.id === c.id)?.items ?? [];
                const quizzes = items.filter((i) => i.type === 'QUIZ').length;
                return (
                  <div key={c.key} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', minWidth: 34, paddingTop: 11 }}>
                      {moduleNumber}.{index + 1}
                    </span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                      <input
                        aria-label={`Chapter ${index + 1} title`}
                        placeholder="Chapter title"
                        value={c.title}
                        onChange={(e) => updateChapter(c.key, { title: e.target.value })}
                        style={{ ...inputStyle, fontWeight: 600 }}
                      />
                      <input
                        aria-label={`Chapter ${index + 1} description`}
                        placeholder="Short description (optional)"
                        value={c.description}
                        onChange={(e) => updateChapter(c.key, { description: e.target.value })}
                        style={{ ...inputStyle, fontSize: 13, padding: '8px 12px' }}
                      />
                      {items.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {plural(items.length - quizzes, 'lesson')} · {plural(quizzes, 'quiz', 'quizzes')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, paddingTop: 5 }}>
                      <IconButton label="Move chapter up" disabled={index === 0} onClick={() => moveChapter(index, -1)}>
                        ↑
                      </IconButton>
                      <IconButton label="Move chapter down" disabled={index === chapters.length - 1} onClick={() => moveChapter(index, 1)}>
                        ↓
                      </IconButton>
                      <IconButton label="Remove chapter" onClick={() => setChapters((rows) => rows.filter((r) => r.key !== c.key))}>
                        ✕
                      </IconButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isEdit && chapters.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              After you create the module you'll be able to add lessons and quizzes to each chapter.
            </div>
          )}
          {isEdit && dirty && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              You have unsaved changes. New chapters appear in the outline once you save.
            </div>
          )}
          {removedWithContent > 0 && (
            <div style={{ fontSize: 12, color: 'var(--warning-text)', marginTop: 6 }}>
              {plural(removedWithContent, 'removed chapter has', 'removed chapters have')} lessons or quizzes — they'll be deleted when you save.
            </div>
          )}
        </div>
      </FormPage>
    </>
  );
}
