import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader, PrimaryButton, SecondaryButton } from '../components/ui';
import { FormModal, fieldLabelStyle, inputStyle } from '../components/Modal';
import HotspotEditor from '../components/HotspotEditor';
import TriggerPictures from '../components/TriggerPictures';
import { API_BASE_URL, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { MAX_MODEL_BYTES, MODEL_ACCEPT, formatBytes, modelErrorText as errorText } from './ArLibrary';
import type { ArModelRow } from './ArLibrary';

const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 };

// /ar-library/:id — preview, points of interest, edit details, replace the file, trigger pictures, or delete.
// (Uploading a new model is the dialog on the library list, /ar-library?new=1.)
export default function ArModelPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [model, setModel] = useState<ArModelRow | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    apiRequest<{ subjects: { id: string; code: string; name: string }[] }>('/api/admin/catalog/subjects?pageSize=100', { token: accessToken })
      .then((data) => setSubjects(data.subjects))
      .catch(() => undefined);
  }, [accessToken]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiRequest<{ model: ArModelRow }>(`/api/admin/ar-models/${id}`, { token: accessToken })
      .then((data) => {
        if (cancelled) return;
        setModel(data.model);
        setName(data.model.name);
        setDescription(data.model.description ?? '');
        setSubjectId(data.model.subjectId ?? '');
      })
      .catch((err: unknown) => !cancelled && setError(errorText(err, 'Unable to load model')));
    return () => {
      cancelled = true;
    };
  }, [id, accessToken]);

  function pickFile(f: File | null) {
    setError(null);
    if (f && f.size > MAX_MODEL_BYTES) {
      setError('Models must be 50 MB or smaller.');
      return;
    }
    setFile(f);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      let updated = (
        await apiRequest<{ model: ArModelRow }>(`/api/admin/ar-models/${id}`, {
          method: 'PATCH',
          token: accessToken,
          body: { name: name.trim(), description: description.trim() || null, subjectId: subjectId || null },
        })
      ).model;
      if (file) {
        updated = (
          await apiRequest<{ model: ArModelRow }>(`/api/admin/ar-models/${id}/file?${new URLSearchParams({ fileName: file.name })}`, {
            method: 'PUT',
            token: accessToken,
            rawBody: file,
          })
        ).model;
        setFile(null);
      }
      setModel(updated);
      setSaved(true);
    } catch (err) {
      setError(errorText(err, 'Unable to save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <PageHeader
        title={model?.name ?? 'AR model'}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {model && <SecondaryButton onClick={() => navigate(`/ar-library/${model.id}/card`)}>Print AR card</SecondaryButton>}
            <SecondaryButton onClick={() => navigate('/ar-library')}>Back to library</SecondaryButton>
          </div>
        }
      />

      {model && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* The size in the URL busts the browser cache when the file is replaced (not on every save, as updatedAt would). */}
            <HotspotEditor
              key={model.id}
              src={`${API_BASE_URL}${model.fileUrl}?v=${encodeURIComponent(model.fileUrl + model.sizeBytes)}`}
              alt={model.name}
              initial={model.hotspots}
              onSave={async (hotspots) => {
                try {
                  const data = await apiRequest<{ model: ArModelRow }>(`/api/admin/ar-models/${model.id}/hotspots`, {
                    method: 'PUT',
                    token: accessToken,
                    body: { hotspots },
                  });
                  setModel(data.model);
                } catch (err) {
                  throw new Error(errorText(err, 'Unable to save points'));
                }
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {model.fileName} · {formatBytes(model.sizeBytes)} · used in {model.lessonCount} lesson{model.lessonCount === 1 ? '' : 's'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <form onSubmit={save}>
              <div style={card}>
                <label>
                  <span style={fieldLabelStyle}>Replace file (optional)</span>
                  <input type="file" accept={MODEL_ACCEPT} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    A .gltf that comes with a .bin file and texture images: zip them all together and upload the .zip so the textures are kept.
                  </span>
                  {file && (
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {file.name} · {formatBytes(file.size)}
                    </span>
                  )}
                </label>
                <label>
                  <span style={fieldLabelStyle}>Name</span>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Human heart" style={inputStyle} />
                </label>
                <label>
                  <span style={fieldLabelStyle}>Subject (optional)</span>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={inputStyle}>
                    <option value="">Not tied to a subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={fieldLabelStyle}>Description (optional)</span>
                  <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
                </label>
              </div>
              {error && (
                <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13, marginTop: 12 }}>
                  {error}
                </div>
              )}
              {saved && <div style={{ color: 'var(--primary)', fontSize: 13, marginTop: 12 }}>Saved.</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <SecondaryButton onClick={() => setConfirmDelete(true)} style={{ color: 'var(--danger-text)', marginRight: 'auto' }}>
                  Delete model
                </SecondaryButton>
                <SecondaryButton onClick={() => navigate('/ar-library')}>Cancel</SecondaryButton>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </PrimaryButton>
              </div>
            </form>
            <TriggerPictures modelId={model.id} token={accessToken} />
          </div>
        </div>
      )}
      {!model && error && <div style={{ color: 'var(--danger-text)' }}>{error}</div>}

      {confirmDelete && model && (
        <DeleteDialog
          model={model}
          onDelete={async () => {
            await apiRequest(`/api/admin/ar-models/${model.id}`, { method: 'DELETE', token: accessToken });
            navigate('/ar-library', { replace: true });
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Layout>
  );
}

function DeleteDialog({ model, onDelete, onClose }: { model: ArModelRow; onDelete: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <FormModal
      title={`Delete “${model.name}”?`}
      submitLabel="Delete Model"
      busyLabel="Deleting…"
      danger
      busy={busy}
      error={error}
      onSubmit={() => {
        setBusy(true);
        onDelete().catch((err: unknown) => {
          setError(errorText(err, 'Unable to delete'));
          setBusy(false);
        });
      }}
      onClose={onClose}
    >
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        This permanently deletes the model file.
        {model.lessonCount > 0 && ` It will be removed from ${model.lessonCount} lesson${model.lessonCount === 1 ? '' : 's'} (the lessons stay).`}
      </div>
    </FormModal>
  );
}
