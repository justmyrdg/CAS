import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import Layout from '../components/Layout';
import { PageHeader, Pagination, PrimaryButton, SecondaryButton, Table, TableRow, Tag, Toolbar } from '../components/ui';
import { FormModal, fieldLabelStyle, inputStyle } from '../components/Modal';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { usePagedList } from '../lib/usePagedList';

interface Student {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  srCode: string | null;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  classCount: number;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const COLS = '1.4fr 110px 1.6fr 80px 130px 260px';
const EMPTY = { firstName: '', middleName: '', lastName: '', srCode: '', email: '' };

function errorText(err: unknown, fallback: string) {
  if (!(err instanceof ApiError)) return fallback;
  const details = err.details as Record<string, string[]> | undefined;
  return (details && Object.values(details)[0]?.[0]) || err.message;
}

// Student accounts: created here with a temporary password the student must change on first sign-in to the app.
export default function Students() {
  const { accessToken } = useAuth();
  const list = usePagedList<Student>({ path: '/api/admin/students', rowsKey: 'users', token: accessToken, initialStatus: 'all' });

  const [editing, setEditing] = useState<Student | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<Student | null>(null);
  const [password, setPassword] = useState<{ student: string; value: string; reason: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function openForm(student: Student | 'new') {
    setForm(
      student === 'new'
        ? EMPTY
        : { firstName: student.firstName, middleName: student.middleName ?? '', lastName: student.lastName, srCode: student.srCode ?? '', email: student.email },
    );
    setFormError(null);
    setEditing(student);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        const data = await apiRequest<{ user: Student; generatedPassword: string }>('/api/admin/students', {
          method: 'POST',
          token: accessToken,
          body: {
            firstName: form.firstName.trim(),
            middleName: form.middleName.trim() || undefined,
            lastName: form.lastName.trim(),
            srCode: form.srCode.trim(),
            email: form.email.trim(),
          },
        });
        setPassword({ student: data.user.fullName, value: data.generatedPassword, reason: 'created' });
      } else {
        await apiRequest(`/api/admin/students/${editing.id}`, {
          method: 'PATCH',
          token: accessToken,
          body: {
            firstName: form.firstName.trim(),
            middleName: form.middleName.trim() || null,
            lastName: form.lastName.trim(),
            email: form.email.trim(),
          },
        });
      }
      setEditing(null);
      await list.reload();
    } catch (err) {
      setFormError(errorText(err, 'Unable to save student'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(student: Student) {
    setActionError(null);
    try {
      await apiRequest(`/api/admin/students/${student.id}/status`, { method: 'PATCH', token: accessToken, body: { isActive: !student.isActive } });
      await list.reload();
    } catch (err) {
      setActionError(errorText(err, 'Unable to update status'));
    }
  }

  async function resetPassword() {
    if (!resetting) return;
    setBusy(true);
    try {
      const data = await apiRequest<{ generatedPassword: string }>(`/api/admin/students/${resetting.id}/reset-password`, {
        method: 'POST',
        token: accessToken,
      });
      setPassword({ student: resetting.fullName, value: data.generatedPassword, reason: 'reset' });
      setResetting(null);
      await list.reload();
    } catch (err) {
      setFormError(errorText(err, 'Unable to reset password'));
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof EMPTY, label: string, props: Partial<InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <label>
      <span style={fieldLabelStyle}>{label}</span>
      <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={inputStyle} {...props} />
    </label>
  );

  return (
    <Layout>
      <PageHeader title="Students" action={<PrimaryButton onClick={() => openForm('new')}>+ Add Student</PrimaryButton>} />
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -16, marginBottom: 20 }}>
        Students sign in to the mobile app with their SR code. They join classes with a join code or are added by their instructor.
      </div>
      {(list.error || actionError) && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{list.error ?? actionError}</div>}

      <Toolbar
        placeholder="Search by name, SR code or email"
        search={list.searchInput}
        onSearchChange={list.setSearchInput}
        filterValue={list.status}
        filterOptions={STATUS_FILTERS}
        onFilterChange={list.setStatus}
      />

      <Table columns={['Name', 'SR code', 'Email', 'Classes', 'Status', '']} gridTemplateColumns={COLS}>
        {list.rows.map((s) => (
          <TableRow
            key={s.id}
            gridTemplateColumns={COLS}
            faded={!s.isActive}
            columns={[
              <span key="n" style={{ fontWeight: 600 }}>{s.fullName}</span>,
              <span key="sr" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{s.srCode}</span>,
              <span key="e" style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{s.email}</span>,
              s.classCount,
              <div key="st" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Tag tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Tag>
                {s.mustChangePassword && s.isActive && <Tag tone="warning">Temp password</Tag>}
              </div>,
              <div key="a" style={{ display: 'flex', gap: 6 }}>
                <SecondaryButton onClick={() => openForm(s)} style={{ padding: '6px 10px' }}>Edit</SecondaryButton>
                <SecondaryButton onClick={() => { setFormError(null); setResetting(s); }} style={{ padding: '6px 10px' }}>Reset password</SecondaryButton>
                <SecondaryButton onClick={() => void toggle(s)} style={{ padding: '6px 10px' }}>{s.isActive ? 'Disable' : 'Enable'}</SecondaryButton>
              </div>,
            ]}
          />
        ))}
        {!list.loading && list.rows.length === 0 && !list.error && (
          <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
            {list.search || list.status !== 'all' ? 'No students match your search or filter.' : 'No students yet. Use “+ Add Student”.'}
          </div>
        )}
      </Table>
      <Pagination page={list.page} totalPages={list.totalPages} showing={list.showing('student')} onPageChange={list.setPage} />

      {editing && (
        <FormModal
          title={editing === 'new' ? 'Add Student' : `Edit ${editing.fullName}`}
          submitLabel={editing === 'new' ? 'Create Student' : 'Save'}
          busy={busy}
          error={formError}
          onSubmit={() => void save()}
          onClose={() => setEditing(null)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('firstName', 'First name', { required: true, autoFocus: true })}
            {field('lastName', 'Last name', { required: true })}
          </div>
          {field('middleName', 'Middle name (optional)')}
          {editing === 'new'
            ? field('srCode', 'SR code', { required: true, placeholder: '23-01452', pattern: '\\d{2}-\\d{5}', title: 'Format: 23-01452' })
            : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                SR code <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text)' }}>{form.srCode}</span> can't be changed.
              </div>
            )}
          {field('email', 'Email', { required: true, type: 'email' })}
          {editing === 'new' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>A temporary password is generated; the student sets their own on first sign-in.</div>
          )}
        </FormModal>
      )}

      {resetting && (
        <FormModal
          title={`Reset password for ${resetting.fullName}?`}
          submitLabel="Reset Password"
          busyLabel="Resetting…"
          busy={busy}
          error={formError}
          onSubmit={() => void resetPassword()}
          onClose={() => setResetting(null)}
        >
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>
            They'll get a new temporary password, be signed out everywhere, and have to choose a new password next time they sign in.
          </div>
        </FormModal>
      )}

      {password && (
        <FormModal title={password.reason === 'created' ? 'Student created' : 'Password reset'} submitLabel="Done" hideSubmit busy={false} error={null} onSubmit={() => setPassword(null)} onClose={() => setPassword(null)}>
          <div style={{ fontSize: 14 }}>Give this temporary password to {password.student} — it won't be shown again:</div>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 18,
              fontWeight: 700,
              background: 'var(--table-header-bg)',
              borderRadius: 8,
              padding: '12px 14px',
              textAlign: 'center',
            }}
          >
            {password.value}
          </div>
        </FormModal>
      )}
    </Layout>
  );
}
