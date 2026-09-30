import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import Layout from '../components/Layout';
import { PageHeader, Pagination, PrimaryButton, SecondaryButton, Table, TableRow, Tag, Toolbar } from '../components/ui';
import { useAuth } from '../state/AuthContext';
import { apiRequest, ApiError } from '../lib/apiClient';
import { PREFIX_OPTIONS, POSITION_OPTIONS } from '../data/instructorOptions';
import type { PrefixValue, PositionValue } from '../data/instructorOptions';

interface Instructor {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  prefix: PrefixValue | null;
  position: PositionValue | null;
  employeeId: string | null;
  email: string;
  isActive: boolean;
}

interface InstructorListResponse {
  users: Instructor[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

interface InstructorFormState {
  firstName: string;
  middleName: string;
  lastName: string;
  prefix: PrefixValue;
  position: PositionValue;
  employeeId: string;
  email: string;
}

const EMPTY_FORM: InstructorFormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  prefix: PREFIX_OPTIONS[0].value,
  position: POSITION_OPTIONS[0].value,
  employeeId: '',
  email: '',
};

const INSTRUCTOR_COLS = '90px 1fr 1fr 1fr 100px 100px 90px 160px';

function firstFieldError(details: unknown): string | undefined {
  if (details && typeof details === 'object') {
    for (const value of Object.values(details as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    }
  }
  return undefined;
}

const inputStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--text)',
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function Instructors() {
  const { accessToken } = useAuth();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstructorFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const loadInstructors = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status });
      if (search) params.set('search', search);
      const data = await apiRequest<InstructorListResponse>(`/api/admin/instructors?${params}`, {
        token: accessToken,
      });
      // e.g. the last row on the last page was removed elsewhere: step back instead of showing an empty page.
      const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setInstructors(data.users);
      setTotal(data.total);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Unable to load instructors');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, accessToken]);

  useEffect(() => {
    void loadInstructors();
  }, [loadInstructors]);

  // Wait for typing to pause before querying, and restart from page 1 on a new search.
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = (page - 1) * PAGE_SIZE + instructors.length;

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditingId(null);
    setModalMode('create');
  }

  function openEdit(instructor: Instructor) {
    setForm({
      firstName: instructor.firstName,
      middleName: instructor.middleName ?? '',
      lastName: instructor.lastName,
      prefix: instructor.prefix ?? PREFIX_OPTIONS[0].value,
      position: instructor.position ?? POSITION_OPTIONS[0].value,
      employeeId: instructor.employeeId ?? '',
      email: instructor.email,
    });
    setFormError(null);
    setEditingId(instructor.id);
    setModalMode('edit');
  }

  function closeModal() {
    setModalMode('closed');
    setEditingId(null);
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        const data = await apiRequest<{ user: Instructor; generatedPassword: string }>('/api/admin/instructors', {
          method: 'POST',
          token: accessToken,
          body: {
            firstName: form.firstName.trim(),
            middleName: form.middleName || undefined,
            lastName: form.lastName.trim(),
            prefix: form.prefix,
            position: form.position,
            employeeId: form.employeeId.trim(),
            email: form.email.trim(),
          },
        });
        setGeneratedPassword(data.generatedPassword);
        if (page !== 1) {
          closeModal();
          setPage(1);
          return;
        }
      } else if (modalMode === 'edit' && editingId) {
        await apiRequest(`/api/admin/instructors/${editingId}`, {
          method: 'PATCH',
          token: accessToken,
          body: {
            firstName: form.firstName.trim(),
            middleName: form.middleName.trim() || null,
            lastName: form.lastName.trim(),
            prefix: form.prefix,
            position: form.position,
          },
        });
      }
      closeModal();
      await loadInstructors();
    } catch (err) {
      setFormError(err instanceof ApiError ? (firstFieldError(err.details) ?? err.message) : 'Unable to save instructor');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(instructor: Instructor) {
    try {
      await apiRequest(`/api/admin/instructors/${instructor.id}/status`, {
        method: 'PATCH',
        token: accessToken,
        body: { isActive: !instructor.isActive },
      });
      await loadInstructors();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Unable to update status');
    }
  }

  return (
    <Layout>
      <PageHeader title="Instructors" action={<PrimaryButton onClick={openCreate}>+ Add Instructor</PrimaryButton>} />
      {loadError && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{loadError}</div>}

      <Toolbar
        placeholder="Search by name, email or employee ID"
        search={searchInput}
        onSearchChange={setSearchInput}
        filterValue={status}
        filterOptions={STATUS_FILTERS}
        onFilterChange={changeStatus}
      />

      <Table
        columns={['Prefix', 'First name', 'Middle name', 'Last name', 'Employee ID', 'Position', 'Status', 'Actions']}
        gridTemplateColumns={INSTRUCTOR_COLS}
      >
        {instructors.map((instructor) => (
          <TableRow
            key={instructor.id}
            gridTemplateColumns={INSTRUCTOR_COLS}
            columns={[
              PREFIX_OPTIONS.find((p) => p.value === instructor.prefix)?.label ?? '—',
              instructor.firstName,
              instructor.middleName ?? '—',
              instructor.lastName,
              instructor.employeeId ?? '—',
              POSITION_OPTIONS.find((p) => p.value === instructor.position)?.label ?? '—',
              <Tag key="status" tone={instructor.isActive ? 'success' : 'neutral'}>
                {instructor.isActive ? 'Active' : 'Inactive'}
              </Tag>,
              <div key="actions" style={{ display: 'flex', gap: 8 }}>
                <SecondaryButton onClick={() => openEdit(instructor)}>Edit</SecondaryButton>
                <SecondaryButton onClick={() => void toggleStatus(instructor)}>
                  {instructor.isActive ? 'Disable' : 'Enable'}
                </SecondaryButton>
              </div>,
            ]}
          />
        ))}
        {!loading && instructors.length === 0 && !loadError && (
          <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
            {search || status !== 'all'
              ? 'No instructors match your search or filter.'
              : 'No instructors yet. Use “+ Add Instructor” to create one.'}
          </div>
        )}
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        showing={`Showing ${firstShown}–${lastShown} of ${total} instructor${total === 1 ? '' : 's'}`}
        onPageChange={setPage}
      />

      {modalMode !== 'closed' && (
        <div style={overlayStyle}>
          <form
            onSubmit={submitForm}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 28,
              width: 420,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {modalMode === 'create' ? 'Add Instructor' : 'Edit Instructor'}
            </div>

            <input
              placeholder="First name"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Middle name (optional)"
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Last name"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              style={inputStyle}
            />
            <select
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value as PrefixValue })}
              style={inputStyle}
            >
              {PREFIX_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value as PositionValue })}
              style={inputStyle}
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Employee ID (5 digits)"
              required
              pattern="\d{5}"
              inputMode="numeric"
              disabled={modalMode === 'edit'}
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Email"
              type="email"
              required
              disabled={modalMode === 'edit'}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={inputStyle}
            />

            {formError && <div style={{ color: 'var(--danger-text)', fontSize: 13 }}>{formError}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <SecondaryButton onClick={closeModal}>Cancel</SecondaryButton>
              <PrimaryButton disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</PrimaryButton>
            </div>
          </form>
        </div>
      )}

      {generatedPassword && (
        <div style={overlayStyle}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Instructor created</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              Share this password with the instructor — it won't be shown again:
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 16,
                fontWeight: 700,
                background: 'var(--table-header-bg)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
              }}
            >
              {generatedPassword}
            </div>
            <PrimaryButton onClick={() => setGeneratedPassword(null)}>Done</PrimaryButton>
          </div>
        </div>
      )}
    </Layout>
  );
}
