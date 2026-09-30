import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/apiClient';
import type { MouseEvent, ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { FormModal, inputStyle } from '../../components/Modal';
import { useAuth } from '../../state/AuthContext';
import { Breadcrumbs } from './components';
import { errorMessage, locateChapter, locateContent, plural, saveMove, useSubjectDetail } from './subjectsData';
import type { ChapterItem, ContentOutline, ContentType, ModuleItem, SubjectDetail } from './subjectsData';

export interface WorkspaceContext {
  subject: SubjectDetail;
  reload: () => Promise<void>;
  // null on /modules/new (nothing to outline yet).
  module: ModuleItem | null;
  moduleIndex: number;
  setDirty: (dirty: boolean) => void;
  // Navigate, asking first if the open editor has unsaved changes.
  go: (url: string) => void;
}

export const useWorkspace = () => useOutletContext<WorkspaceContext>();

// Editors call this so the outline can warn before leaving unsaved changes.
export function useReportDirty(dirty: boolean) {
  const { setDirty } = useWorkspace();
  useEffect(() => setDirty(dirty), [dirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);
}

export const contentPath = (type: ContentType) => (type === 'QUIZ' ? 'quizzes' : 'lessons');

// Layout route for the module editor and its lesson/quiz editors:
//   /subjects/:subjectId/modules/:moduleId/edit, /lessons/:itemId/edit, /quizzes/:itemId/edit,
//   /chapters/:chapterId/{lessons|quizzes}/new  — outline on the left, the selected editor on the right.
//   /subjects/:subjectId/modules/new            — just the form (no outline).
// It stays mounted while switching between those routes, so the outline doesn't reload or flicker.
export default function ModuleWorkspace() {
  const { subjectId, moduleId, chapterId, itemId } = useParams<{ subjectId: string; moduleId?: string; chapterId?: string; itemId?: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { subject, error: loadError, reload } = useSubjectDetail(subjectId, accessToken);
  const [dirty, setDirty] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const isNewModule = !moduleId && !chapterId && !itemId;
  const moduleIndex = subject
    ? moduleId
      ? subject.modules.findIndex((m) => m.id === moduleId)
      : ((itemId ? locateContent(subject, itemId) : locateChapter(subject, chapterId))?.moduleIndex ?? -1)
    : -1;
  const module = subject && moduleIndex >= 0 ? subject.modules[moduleIndex] : null;
  const subjectUrl = `/subjects/${subjectId}`;

  // Outline links go through here so unsaved edits aren't lost by accident.
  const go = useCallback(
    (url: string) => {
      if (dirty) setPendingUrl(url);
      else navigate(url);
    },
    [dirty, navigate],
  );

  async function addChapter(title: string) {
    if (!module) return;
    await apiRequest(`/api/admin/catalog/modules/${module.id}/chapters`, { method: 'POST', token: accessToken, body: { title } });
    await reload();
  }

  async function moveItem(chapter: ChapterItem, index: number, delta: -1 | 1) {
    try {
      await saveMove(`/api/admin/catalog/chapters/${chapter.id}/content/order`, chapter.items, index, delta, accessToken);
      setReorderError(null);
    } catch (err) {
      setReorderError(errorMessage(err, 'Unable to reorder'));
    }
    await reload();
  }

  const crumbs = [
    { label: 'Subjects', to: '/subjects' },
    { label: subject?.code ?? '…', to: subjectUrl },
    { label: isNewModule ? 'New module' : module ? `Module ${moduleIndex + 1}: ${module.title}` : '…' },
  ];

  let body: ReactNode = null;
  if (subject && isNewModule) {
    body = <Outlet context={{ subject, reload, module: null, moduleIndex: subject.modules.length, setDirty, go } satisfies WorkspaceContext} />;
  } else if (subject && !module) {
    body = (
      <div style={{ fontSize: 14, color: 'var(--danger-text)' }}>
        This {itemId ? 'lesson or quiz' : moduleId ? 'module' : 'chapter'} no longer exists. <Link to={subjectUrl}>Back to {subject.code}</Link>
      </div>
    );
  } else if (subject && module) {
    body = (
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        <ModuleOutline
          module={module}
          moduleNumber={moduleIndex + 1}
          subjectUrl={subjectUrl}
          selected={{ moduleId, chapterId, itemId }}
          error={reorderError}
          go={go}
          onMove={(chapter, index, delta) => void moveItem(chapter, index, delta)}
          // Saving Module details replaces the chapter list, so don't add one behind its unsaved edits.
          addChapterBlocked={Boolean(moduleId && dirty)}
          onAddChapter={addChapter}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Outlet context={{ subject, reload, module, moduleIndex, setDirty, go } satisfies WorkspaceContext} />
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Breadcrumbs items={crumbs} />
      {loadError && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{loadError}</div>}
      {body}

      {pendingUrl && (
        <FormModal
          title="Discard unsaved changes?"
          submitLabel="Discard Changes"
          danger
          busy={false}
          error={null}
          onSubmit={() => {
            setDirty(false);
            setPendingUrl(null);
            navigate(pendingUrl);
          }}
          onClose={() => setPendingUrl(null)}
        >
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
            You have changes that haven't been saved. Leave this editor and lose them?
          </div>
        </FormModal>
      )}
    </Layout>
  );
}

function ModuleOutline({
  module,
  moduleNumber,
  subjectUrl,
  selected,
  error,
  go,
  onMove,
  addChapterBlocked,
  onAddChapter,
}: {
  module: ModuleItem;
  moduleNumber: number;
  subjectUrl: string;
  selected: { moduleId?: string; chapterId?: string; itemId?: string };
  error: string | null;
  go: (url: string) => void;
  onMove: (chapter: ChapterItem, index: number, delta: -1 | 1) => void;
  addChapterBlocked: boolean;
  onAddChapter: (title: string) => Promise<void>;
}) {
  // A new lesson/quiz route shows a placeholder row under its chapter.
  const { pathname } = useLocation();
  const newType: ContentType | null = selected.chapterId ? (pathname.endsWith('/quizzes/new') ? 'QUIZ' : 'LESSON') : null;

  return (
    <aside
      aria-label="Module outline"
      style={{
        width: 280,
        flexShrink: 0,
        position: 'sticky',
        top: 24,
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--table-header-bg)',
        padding: '16px 10px 14px',
      }}
    >
      <div style={{ padding: '0 8px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Module {moduleNumber}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginTop: 2, overflowWrap: 'anywhere' }}>{module.title}</div>
      </div>

      <OutlineLink url={`${subjectUrl}/modules/${module.id}/edit`} active={selected.moduleId === module.id} go={go}>
        <span aria-hidden="true" style={{ width: 18, textAlign: 'center', color: 'var(--text-muted)' }}>
          ⚙
        </span>
        <span style={{ fontWeight: 600 }}>Module details</span>
      </OutlineLink>

      <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '16px 8px 6px' }}>
        Chapters
      </div>
      {module.chapters.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '0 8px 8px' }}>No chapters yet.</div>
      )}

      {module.chapters.map((chapter, ci) => (
        <div key={chapter.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6, padding: '6px 8px 4px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--text-muted)', paddingTop: 2 }}>
              {moduleNumber}.{ci + 1}
            </span>
            <span style={{ overflowWrap: 'anywhere' }}>{chapter.title}</span>
          </div>

          {chapter.items.map((item, ii) => (
            <OutlineItem
              key={item.id}
              item={item}
              url={`${subjectUrl}/${contentPath(item.type)}/${item.id}/edit`}
              active={selected.itemId === item.id}
              go={go}
              canMoveUp={ii > 0}
              canMoveDown={ii < chapter.items.length - 1}
              onMove={(delta) => onMove(chapter, ii, delta)}
            />
          ))}

          {selected.chapterId === chapter.id && newType && (
            <OutlineLink url={pathname} active go={go} indent>
              <TypeBadge type={newType} />
              <span style={{ fontStyle: 'italic' }}>New {newType === 'QUIZ' ? 'quiz' : 'lesson'}</span>
            </OutlineLink>
          )}

          <div style={{ display: 'flex', gap: 6, padding: '4px 8px 0 30px' }}>
            {(['LESSON', 'QUIZ'] as const).map((type) => (
              <Link
                key={type}
                to={`${subjectUrl}/chapters/${chapter.id}/${contentPath(type)}/new`}
                onClick={(e) => guardClick(e, `${subjectUrl}/chapters/${chapter.id}/${contentPath(type)}/new`, go)}
                style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', border: '1px dashed var(--border)', borderRadius: 6, background: '#fff' }}
              >
                + {type === 'QUIZ' ? 'Quiz' : 'Lesson'}
              </Link>
            ))}
          </div>
        </div>
      ))}

      <AddChapter nextNumber={`${moduleNumber}.${module.chapters.length + 1}`} blocked={addChapterBlocked} onAdd={onAddChapter} />

      {error && (
        <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 12, padding: '4px 8px' }}>
          {error}
        </div>
      )}
    </aside>
  );
}

function AddChapter({ nextNumber, blocked, onAdd }: { nextNumber: string; blocked: boolean; onAdd: (title: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setTitle('');
    setError(null);
  }

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(title.trim());
      close();
    } catch (err) {
      setError(errorMessage(err, 'Unable to add chapter'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div style={{ padding: '6px 8px 0' }}>
        <button
          type="button"
          disabled={blocked}
          onClick={() => setOpen(true)}
          title={blocked ? 'Save or cancel your Module details changes first' : undefined}
          style={{
            width: '100%',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            background: '#fff',
            padding: '7px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--primary)',
            cursor: blocked ? 'default' : 'pointer',
            opacity: blocked ? 0.5 : 1,
          }}
        >
          + Add Chapter
        </button>
        {blocked && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Save your Module details changes first.</div>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ padding: '6px 8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <input
        autoFocus
        aria-label="New chapter title"
        placeholder={`Chapter ${nextNumber} title`}
        value={title}
        maxLength={160}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        style={{ ...inputStyle, fontSize: 13, padding: '7px 10px' }}
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={close} disabled={busy} style={smallButton(false)}>
          Cancel
        </button>
        <button type="submit" disabled={busy || !title.trim()} style={smallButton(true)}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 12 }}>
          {error}
        </div>
      )}
    </form>
  );
}

const smallButton = (primary: boolean) => ({
  border: primary ? 'none' : '1px solid var(--border)',
  borderRadius: 6,
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 600,
  background: primary ? 'var(--primary)' : '#fff',
  color: primary ? '#fff' : 'var(--text)',
  cursor: 'pointer',
});

// Plain clicks go through `go` (unsaved-changes check); modified clicks (new tab etc.) keep normal link behaviour.
function guardClick(e: MouseEvent, url: string, go: (url: string) => void) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  go(url);
}

function OutlineLink({ url, active, go, indent, children }: { url: string; active: boolean; go: (url: string) => void; indent?: boolean; children: ReactNode }) {
  return (
    <Link
      to={url}
      aria-current={active ? 'page' : undefined}
      onClick={(e) => guardClick(e, url, go)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        flex: 1,
        padding: indent ? '6px 8px 6px 30px' : '7px 8px',
        borderRadius: 8,
        fontSize: 13,
        color: active ? 'var(--primary-dark)' : 'var(--text)',
        background: active ? 'var(--primary-light)' : undefined,
        boxShadow: active ? 'inset 3px 0 0 var(--primary)' : undefined,
      }}
    >
      {children}
    </Link>
  );
}

function OutlineItem({
  item,
  url,
  active,
  go,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  item: ContentOutline;
  url: string;
  active: boolean;
  go: (url: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  const kind = item.type === 'QUIZ' ? 'quiz' : 'lesson';
  return (
    <div className="outline-row" style={{ display: 'flex', alignItems: 'center' }}>
      <OutlineLink url={url} active={active} go={go} indent>
        <TypeBadge type={item.type} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
          {item.title}
        </span>
        {item.type === 'QUIZ' && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{plural(item.questionCount, 'q', 'qs')}</span>}
      </OutlineLink>
      <div className="outline-actions" style={{ display: 'flex', gap: 2, paddingLeft: 2 }}>
        <MoveButton label={`Move ${kind} up`} disabled={!canMoveUp} onClick={() => onMove(-1)}>
          ↑
        </MoveButton>
        <MoveButton label={`Move ${kind} down`} disabled={!canMoveDown} onClick={() => onMove(1)}>
          ↓
        </MoveButton>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: ContentType }) {
  const quiz = type === 'QUIZ';
  return (
    <span
      aria-label={quiz ? 'Quiz' : 'Lesson'}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        background: quiz ? 'var(--warning-bg)' : 'var(--primary-light)',
        color: quiz ? 'var(--warning-text)' : 'var(--primary)',
      }}
    >
      {quiz ? 'Q' : 'L'}
    </span>
  );
}

function MoveButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 22,
        height: 22,
        padding: 0,
        border: '1px solid var(--border)',
        borderRadius: 5,
        background: '#fff',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
