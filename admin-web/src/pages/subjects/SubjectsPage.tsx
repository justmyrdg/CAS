import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { FormModal, fieldLabelStyle, inputStyle } from '../../components/Modal';
import { PageHeader, Pagination, PrimaryButton, Table, TableRow, Toolbar } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { errorMessage, plural } from './subjectsData';
import type { SubjectRow } from './subjectsData';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const SUBJECT_COLS = '120px 1.8fr 110px 110px 40px';

export default function SubjectsPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  // `?new=1` opens the New Subject dialog (the dashboard links here with it).
  const [searchParams, setSearchParams] = useSearchParams();
  const creating = searchParams.get('new') === '1';

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const loadSubjects = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const data = await apiRequest<{ subjects: SubjectRow[]; total: number }>(`/api/admin/catalog/subjects?${params}`, {
        token: accessToken,
      });
      const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setSubjects(data.subjects);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Unable to load subjects'));
    } finally {
      setLoading(false);
    }
  }, [page, search, accessToken]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = (page - 1) * PAGE_SIZE + subjects.length;

  return (
    <Layout>
      <PageHeader title="Subjects" action={<PrimaryButton onClick={() => setSearchParams({ new: '1' })}>+ New Subject</PrimaryButton>} />
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -16, marginBottom: 20 }}>
        Open a subject to see its modules and chapters.
      </div>
      {error && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{error}</div>}

      <Toolbar placeholder="Search subjects by code or name" search={searchInput} onSearchChange={setSearchInput} />

      <Table columns={['Code', 'Name', 'Modules', 'Classes', '']} gridTemplateColumns={SUBJECT_COLS}>
        {subjects.map((s) => (
          <div
            key={s.id}
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/subjects/${s.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/subjects/${s.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <TableRow
              gridTemplateColumns={SUBJECT_COLS}
              columns={[
                <span key="code" style={{ fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{s.code}</span>,
                <div key="name">
                  <div style={{ fontWeight: 500 }}>{s.name}</div>
                  {s.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.description}
                    </div>
                  )}
                </div>,
                s.moduleCount,
                s.classCount,
                <svg key="open" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M5 2l6 5-6 5" stroke="#9CA8A1" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>,
              ]}
            />
          </div>
        ))}
        {!loading && subjects.length === 0 && !error && (
          <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
            {search ? 'No subjects match your search.' : 'No subjects yet. Use “+ New Subject” to add the first one.'}
          </div>
        )}
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        showing={`Showing ${firstShown}–${lastShown} of ${plural(total, 'subject')}`}
        onPageChange={setPage}
      />

      {creating && <NewSubjectModal onClose={() => setSearchParams({}, { replace: true })} />}
    </Layout>
  );
}

function NewSubjectModal({ onClose }: { onClose: () => void }) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const data = await apiRequest<{ subject: { id: string } }>('/api/admin/catalog/subjects', {
        method: 'POST',
        token: accessToken,
        body: { code, name: name.trim(), description: description.trim() },
      });
      navigate(`/subjects/${data.subject.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Unable to save subject'));
      setSaving(false);
    }
  }

  return (
    <FormModal
      title="New Subject"
      submitLabel="Create Subject"
      busy={saving}
      error={error}
      onSubmit={() => void save()}
      onClose={onClose}
    >
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6 }}>After creating the subject you can add its modules.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14 }}>
        <label>
          <span style={fieldLabelStyle}>Code</span>
          <input
            required
            autoFocus
            placeholder="CS101"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace' }}
          />
        </label>
        <label>
          <span style={fieldLabelStyle}>Name</span>
          <input required placeholder="Data Structures & Algorithms" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <label>
        <span style={fieldLabelStyle}>Description (optional)</span>
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
      </label>
    </FormModal>
  );
}
