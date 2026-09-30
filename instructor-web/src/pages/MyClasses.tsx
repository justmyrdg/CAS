import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader, Pagination, PrimaryButton, SecondaryButton, Table, TableRow, Tag, Toolbar } from '../components/ui';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { TERM_OPTIONS, schoolYearLabel, schoolYearOptions, termLabel } from '../data/classOptions';
import type { ClassRecord, TermValue } from '../data/classOptions';

interface ClassListResponse {
  classes: ClassRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface SubjectOption {
  id: string;
  code: string;
  name: string;
}

interface ClassFormState {
  subjectId: string;
  section: string;
  term: TermValue;
  schoolYear: string;
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_FILTERS = [
  { value: 'all', label: 'All classes' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

const CLASS_COLS = '100px 1.6fr 80px 1.3fr 90px 130px 100px 90px';

const inputStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--text)',
  width: '100%',
};

const fieldLabel: CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function emptyForm(): ClassFormState {
  return { subjectId: '', section: '', term: TERM_OPTIONS[0].value, schoolYear: schoolYearOptions()[0] };
}

function firstFieldError(details: unknown): string | undefined {
  if (details && typeof details === 'object') {
    for (const value of Object.values(details as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    }
  }
  return undefined;
}

export default function MyClasses() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  // "?new=1" (e.g. from the dashboard's Create Class button) opens the form straight away.
  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState<ClassFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[] | null>(null);

  const loadClasses = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status });
      if (search) params.set('search', search);
      const data = await apiRequest<ClassListResponse>(`/api/instructor/classes?${params}`, { token: accessToken });
      const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setClasses(data.classes);
      setTotal(data.total);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Unable to load classes');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, accessToken]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  // Subjects come from the admin catalog; refetched each time the form opens so newly added ones show up.
  useEffect(() => {
    if (!formOpen) return;
    let cancelled = false;
    apiRequest<{ subjects: SubjectOption[] }>('/api/instructor/subjects', { token: accessToken })
      .then((data) => {
        if (!cancelled) setSubjectOptions(data.subjects);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFormError(err instanceof ApiError ? err.message : 'Unable to load subjects');
      });
    return () => {
      cancelled = true;
    };
  }, [formOpen, accessToken]);

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

  function changeStatus(value: string) {
    setStatus(value as StatusFilter);
    setPage(1);
  }

  function openForm() {
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    if (searchParams.has('new')) setSearchParams({}, { replace: true });
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const data = await apiRequest<{ class: ClassRecord }>('/api/instructor/classes', {
        method: 'POST',
        token: accessToken,
        body: {
          subjectId: form.subjectId,
          section: form.section.trim(),
          term: form.term,
          schoolYear: form.schoolYear,
        },
      });
      navigate(`/classes/${data.class.id}?created=1`);
    } catch (err) {
      setFormError(err instanceof ApiError ? (firstFieldError(err.details) ?? err.message) : 'Unable to create class');
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = (page - 1) * PAGE_SIZE + classes.length;
  const filtering = search !== '' || status !== 'all';

  return (
    <Layout>
      <PageHeader title="My Classes" action={<PrimaryButton onClick={openForm}>+ Create Class</PrimaryButton>} />
      {loadError && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{loadError}</div>}

      <Toolbar
        placeholder="Search by subject, section or join code"
        search={searchInput}
        onSearchChange={setSearchInput}
        filterValue={status}
        filterOptions={STATUS_FILTERS}
        onFilterChange={changeStatus}
      />

      <Table
        columns={['Subject', 'Subject name', 'Section', 'Term', 'Students', 'Join code', 'Status', '']}
        gridTemplateColumns={CLASS_COLS}
      >
        {classes.map((c) => (
          <TableRow
            key={c.id}
            gridTemplateColumns={CLASS_COLS}
            faded={c.isArchived}
            columns={[
              <span key="code" style={{ fontWeight: 600 }}>{c.subjectCode}</span>,
              c.subjectName,
              c.section,
              `${termLabel(c.term)} · ${schoolYearLabel(c.schoolYear)}`,
              c.studentCount,
              <span key="join" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{c.joinCode}</span>,
              <Tag key="status" tone={c.isArchived ? 'neutral' : 'success'}>{c.isArchived ? 'Archived' : 'Active'}</Tag>,
              <SecondaryButton key="view" onClick={() => navigate(`/classes/${c.id}`)} style={{ padding: '6px 12px' }}>
                View
              </SecondaryButton>,
            ]}
          />
        ))}
        {!loading && classes.length === 0 && !loadError && (
          <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
            {filtering ? 'No classes match your search or filter.' : 'You have no classes yet. Use “+ Create Class” to add your first one.'}
          </div>
        )}
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        showing={`Showing ${firstShown}–${lastShown} of ${total} class${total === 1 ? '' : 'es'}`}
        onPageChange={setPage}
      />

      {formOpen && (
        <div style={overlayStyle}>
          <form
            onSubmit={submitForm}
            style={{ background: '#fff', borderRadius: 12, padding: 28, width: 460, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ fontWeight: 700, fontSize: 18 }}>Create Class</div>

            <label>
              <span style={fieldLabel}>Subject</span>
              <select
                required
                disabled={!subjectOptions || subjectOptions.length === 0}
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                style={inputStyle}
              >
                <option value="" disabled>
                  {subjectOptions === null ? 'Loading subjects…' : 'Choose a subject'}
                </option>
                {subjectOptions?.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
              {subjectOptions?.length === 0 && (
                <span style={{ display: 'block', fontSize: 12, color: 'var(--danger-text)', marginTop: 6 }}>
                  There are no subjects in the catalog yet. Ask an administrator to add one.
                </span>
              )}
            </label>

            <label>
              <span style={fieldLabel}>Section</span>
              <input
                required
                placeholder="A"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                style={inputStyle}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                <span style={fieldLabel}>Term</span>
                <select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value as TermValue })} style={inputStyle}>
                  {TERM_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span style={fieldLabel}>School year</span>
                <select value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })} style={inputStyle}>
                  {schoolYearOptions().map((y) => (
                    <option key={y} value={y}>
                      {schoolYearLabel(y)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              A join code for students is generated automatically.
            </div>

            {formError && (
              <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <SecondaryButton onClick={closeForm}>Cancel</SecondaryButton>
              <PrimaryButton type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Class'}
              </PrimaryButton>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
