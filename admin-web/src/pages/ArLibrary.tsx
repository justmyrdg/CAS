import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import type { Hotspot } from '../components/HotspotEditor';
import { FormModal, fieldLabelStyle, inputStyle } from '../components/Modal';
import { PageHeader, Pagination, PrimaryButton, SecondaryButton, Tag, Toolbar } from '../components/ui';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { usePagedList } from '../lib/usePagedList';

export interface ArModelRow {
  id: string;
  name: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  subjectId: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  lessonCount: number;
  fileUrl: string;
  updatedAt: string;
  hotspots: Hotspot[];
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const MAX_MODEL_BYTES = 50 * 1024 * 1024;
// The server converts every upload to one .glb (textures embedded; old spec/gloss materials fixed).
export const MODEL_ACCEPT = '.glb,.gltf,.zip';

export function modelErrorText(err: unknown, fallback: string) {
  if (!(err instanceof ApiError)) return fallback;
  const details = err.details as Record<string, string[]> | undefined;
  return (details && Object.values(details)[0]?.[0]) || err.message;
}

// The AR model library: uploaded 3D models that lessons can link to. Opening a model shows its preview and details;
// "+ Upload model" (or `?new=1`, which the dashboard links to) opens the upload dialog.
export default function ArLibrary() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const uploading = searchParams.get('new') === '1';
  const list = usePagedList<ArModelRow>({
    path: '/api/admin/ar-models',
    rowsKey: 'models',
    token: accessToken,
    pageSize: 12,
    initialStatus: '',
    filterKey: 'subjectId',
  });
  const [subjects, setSubjects] = useState<{ id: string; code: string; name: string }[]>([]);

  useEffect(() => {
    apiRequest<{ subjects: { id: string; code: string; name: string }[] }>('/api/admin/catalog/subjects?pageSize=100', { token: accessToken })
      .then((data) => setSubjects(data.subjects))
      .catch(() => undefined);
  }, [accessToken]);

  return (
    <Layout>
      <PageHeader
        title="AR Model Library"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <SecondaryButton onClick={() => navigate('/ar-library/marker')}>Print AR marker</SecondaryButton>
            <PrimaryButton onClick={() => setSearchParams({ new: '1' })}>+ Upload model</PrimaryButton>
          </div>
        }
      />
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -16, marginBottom: 20 }}>
        3D models students can open in AR (upload a .glb, or a .zip of a .gltf with its textures). Link a model to a lesson from the lesson editor.
      </div>
      {list.error && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{list.error}</div>}

      <Toolbar
        placeholder="Search models"
        search={list.searchInput}
        onSearchChange={list.setSearchInput}
        filterValue={list.status}
        filterOptions={[{ value: '', label: 'All subjects' }, ...subjects.map((s) => ({ value: s.id, label: s.code }))]}
        onFilterChange={list.setStatus}
      />

      {!list.loading && list.rows.length === 0 && !list.error ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          {list.search || list.status ? 'No models match your search or filter.' : 'No models yet. Use “+ Upload model” to add the first one.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
          {list.rows.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(`/ar-library/${m.id}`)}
              style={{
                textAlign: 'left',
                border: '1px solid var(--border)',
                borderRadius: 12,
                background: '#fff',
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <div style={{ height: 110, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="46" height="46" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2l9 5v10l-9 5-9-5V7z" fill="none" stroke="#1F6D52" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M3 7l9 5 9-5M12 12v10" fill="none" stroke="#1F6D52" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {m.fileName} · {formatBytes(m.sizeBytes)}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {m.subjectCode && <Tag tone="success">{m.subjectCode}</Tag>}
                  <Tag tone={m.lessonCount ? 'neutral' : 'warning'}>{m.lessonCount ? `${m.lessonCount} lesson${m.lessonCount === 1 ? '' : 's'}` : 'Not used yet'}</Tag>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Pagination page={list.page} totalPages={list.totalPages} showing={list.showing('model')} onPageChange={list.setPage} />

      {uploading && <UploadModelModal subjects={subjects} onClose={() => setSearchParams({}, { replace: true })} />}
    </Layout>
  );
}

// Upload a model; on success its page opens, where points of interest and trigger pictures are added.
function UploadModelModal({ subjects, onClose }: { subjects: { id: string; code: string; name: string }[]; onClose: () => void }) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File | null) {
    setError(null);
    if (f && f.size > MAX_MODEL_BYTES) {
      setError('Models must be 50 MB or smaller.');
      return;
    }
    setFile(f);
    if (f && !name.trim()) setName(f.name.replace(/\.(glb|gltf|zip)$/i, '').replace(/[-_]+/g, ' '));
  }

  async function upload() {
    if (!file) {
      setError('Choose a .glb file, or a .zip with a .gltf and its files, to upload.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ fileName: file.name, name: name.trim(), description: description.trim(), subjectId });
      const data = await apiRequest<{ model: ArModelRow }>(`/api/admin/ar-models?${params}`, { method: 'POST', token: accessToken, rawBody: file });
      navigate(`/ar-library/${data.model.id}`);
    } catch (err) {
      setError(modelErrorText(err, 'Unable to upload the model'));
      setBusy(false);
    }
  }

  return (
    <FormModal title="Upload AR model" submitLabel="Upload Model" busyLabel="Uploading…" busy={busy} error={error} onSubmit={() => void upload()} onClose={onClose}>
      <label
        style={{
          border: `1.5px dashed ${file ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '18px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: file ? 'var(--primary-light)' : 'var(--table-header-bg)',
        }}
      >
        <input type="file" accept={MODEL_ACCEPT} aria-label="Model file" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
        <div style={{ fontWeight: 600, fontSize: 14, color: file ? 'var(--primary)' : 'var(--text)', overflowWrap: 'anywhere' }}>
          {file ? `${file.name} · ${formatBytes(file.size)}` : 'Choose a model file'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
          {file ? 'Click to choose a different file' : '.glb, or a .zip of a .gltf with its .bin and textures — up to 50 MB'}
        </div>
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
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
      </label>
    </FormModal>
  );
}
