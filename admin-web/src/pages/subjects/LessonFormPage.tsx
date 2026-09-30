import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SecondaryButton } from '../../components/ui';
import { fieldLabelStyle, inputStyle } from '../../components/Modal';
import { apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { ConfirmDeleteDialog, DangerButton, FormPage, SavedNote } from './components';
import { useReportDirty } from './ModuleWorkspace';
import { errorMessage } from './subjectsData';
import { useContentEditor } from './useContentEditor';
import { BLOCK_LABELS, MAX_BLOCKS, draftFromApi, emptyBlock, prepareBlocks, type BlockDraft, type BlockType } from './lessonBlocks';
import BlockCard from './blocks/BlockCard';
import LessonPreview from './preview/LessonPreview';
import TextBlockEditor from './blocks/TextBlockEditor';
import ImageBlockEditor from './blocks/ImageBlockEditor';
import VideoBlockEditor from './blocks/VideoBlockEditor';
import CheckBlockEditor from './blocks/CheckBlockEditor';

const ADDABLE: BlockType[] = ['heading', 'text', 'image', 'video', 'check'];

// Compared against the last saved state to know whether there are unsaved changes (block keys don't count).
const snapshotOf = (title: string, blocks: BlockDraft[], arModelId: string) =>
  JSON.stringify([title, blocks.map((b) => ({ ...b, key: 0 })), arModelId]);

// Keyed by route so switching lessons in the module outline starts a fresh form.
export default function LessonFormPage() {
  const { itemId, chapterId } = useParams();
  return <LessonForm key={itemId ?? `new-${chapterId}`} />;
}

function LessonForm() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const routeState = useLocation().state as { created?: boolean } | null;
  const editor = useContentEditor(accessToken);
  const { isEdit, item, location, moduleUrl, subjectUrl, reload } = editor;

  const nextKey = useRef(0);
  const [title, setTitle] = useState('');
  // A new lesson starts with one empty text block (fixed key: refs can't be read during render; later keys come from nextKey).
  const [blocks, setBlocks] = useState<BlockDraft[]>(() => (isEdit ? [] : [emptyBlock('text', -1)]));
  const [arModelId, setArModelId] = useState('');
  const [arModels, setArModels] = useState<{ id: string; name: string; subjectCode: string | null }[]>([]);
  const [filled, setFilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(routeState?.created ? 'Lesson created' : null);
  const [deleting, setDeleting] = useState(false);
  const deleted = useRef(false);

  const snapshot = snapshotOf(title, blocks, arModelId);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  useReportDirty(dirty);

  useEffect(() => {
    apiRequest<{ models: { id: string; name: string; subjectCode: string | null }[] }>('/api/admin/ar-models?pageSize=100', { token: accessToken })
      .then((data) => setArModels(data.models))
      .catch(() => undefined);
  }, [accessToken]);

  useEffect(() => {
    if (item && !filled) {
      const drafts = item.blocks.map((b) => draftFromApi(b, nextKey.current++));
      setTitle(item.title);
      setBlocks(drafts);
      setArModelId(item.arModelId ?? '');
      setSavedSnapshot(snapshotOf(item.title, drafts, item.arModelId ?? ''));
      setFilled(true);
    }
  }, [item, filled]);

  function patch(key: number, changes: object) {
    setBlocks((bs) => bs.map((b) => (b.key === key ? ({ ...b, ...changes } as BlockDraft) : b)));
  }

  function moveBlock(index: number, delta: -1 | 1) {
    setBlocks((bs) => {
      const target = index + delta;
      if (target < 0 || target >= bs.length) return bs;
      const next = [...bs];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function renderEditor(b: BlockDraft, index: number) {
    switch (b.type) {
      case 'heading':
      case 'text':
        return <TextBlockEditor block={b} onChange={(text) => patch(b.key, { text })} />;
      case 'image':
        return <ImageBlockEditor block={b} token={accessToken} onChange={(changes) => patch(b.key, changes)} />;
      case 'video':
        return <VideoBlockEditor block={b} onChange={(changes) => patch(b.key, changes)} />;
      case 'check':
        return <CheckBlockEditor block={b} index={index} onChange={(changes) => patch(b.key, changes)} />;
    }
  }

  async function save() {
    const prepared = prepareBlocks(blocks);
    if (typeof prepared === 'string') {
      setError(prepared);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { title: title.trim(), blocks: prepared, arModelId: arModelId || null };
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
          body: { type: 'LESSON', ...payload },
        });
        // Reload first so the outline already has the new lesson when its edit page opens.
        await reload();
        navigate(`${subjectUrl}/lessons/${data.item.id}/edit`, { replace: true, state: { created: true } });
      }
    } catch (err) {
      setError(errorMessage(err, 'Unable to save lesson'));
      setSaving(false);
    }
  }

  // The outline has the title as last saved (item.title is from when the editor opened).
  const savedTitle = location?.chapter.items.find((i) => i.id === item?.id)?.title ?? item?.title;

  return (
    <>
      {editor.loadError && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{editor.loadError}</div>}

      {editor.ready && location && (!isEdit || filled) && (
        <FormPage
          title={isEdit ? 'Edit Lesson' : 'New Lesson'}
          subtitle={`Chapter ${location.moduleIndex + 1}.${location.chapterIndex + 1} — ${location.chapter.title}`}
          error={error}
          saving={saving}
          saveLabel={isEdit ? 'Save Lesson' : 'Create Lesson'}
          onCancel={() => navigate(moduleUrl)}
          onSubmit={() => void save()}
          previews={[
            {
              label: 'Preview',
              render: () => (
                <LessonPreview title={title} crumb={location.chapter.title} blocks={blocks} arModelName={arModels.find((m) => m.id === arModelId)?.name ?? null} />
              ),
            },
          ]}
          footerStart={
            <>
              {isEdit && <DangerButton onClick={() => setDeleting(true)}>Delete Lesson</DangerButton>}
              {savedNote && !dirty && <SavedNote>{savedNote}</SavedNote>}
            </>
          }
        >
          <label>
            <span style={fieldLabelStyle}>Lesson title</span>
            <input required autoFocus={!isEdit} placeholder="What is a binary tree?" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          </label>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
              Lesson content <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({blocks.length} {blocks.length === 1 ? 'block' : 'blocks'})</span>
            </div>

            {blocks.map((b, i) => (
              <BlockCard
                key={b.key}
                index={i}
                count={blocks.length}
                title={BLOCK_LABELS[b.type]}
                onMove={(delta) => moveBlock(i, delta)}
                onRemove={() => setBlocks((bs) => bs.filter((x) => x.key !== b.key))}
              >
                {renderEditor(b, i)}
              </BlockCard>
            ))}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ADDABLE.map((type) => (
                <SecondaryButton key={type} disabled={blocks.length >= MAX_BLOCKS} onClick={() => setBlocks((bs) => [...bs, emptyBlock(type, nextKey.current++)])}>
                  + {type === 'check' ? 'Check' : BLOCK_LABELS[type]}
                </SecondaryButton>
              ))}
            </div>
          </div>

          <label>
            <span style={fieldLabelStyle}>Hands-on activity — 3D model (optional)</span>
            <select value={arModelId} onChange={(e) => setArModelId(e.target.value)} style={inputStyle}>
              <option value="">No AR model</option>
              {arModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.subjectCode ? ` (${m.subjectCode})` : ''}
                </option>
              ))}
            </select>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Students get a “Hands-on activity” card at the end of this lesson. Upload models in the AR Library.
            </span>
          </label>
        </FormPage>
      )}

      {deleting && item && (
        <ConfirmDeleteDialog
          title="Delete lesson?"
          message={`This permanently deletes “${savedTitle}”.`}
          confirmLabel="Delete Lesson"
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
