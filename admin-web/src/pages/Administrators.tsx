import { useCallback, useEffect, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import Layout from '../components/Layout';
import { PageHeader, PrimaryButton, SecondaryButton, Table, TableRow, Tag } from '../components/ui';
import { FormModal, fieldLabelStyle, inputStyle } from '../components/Modal';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';

interface Account {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'DEAN';
  employeeId: string | null;
  isActive: boolean;
}

const COLS = '1.5fr 1.6fr 110px 110px 110px 110px';
const EMPTY = { firstName: '', lastName: '', email: '', employeeId: '', role: 'DEAN', password: '' };

function errorText(err: unknown, fallback: string) {
  if (!(err instanceof ApiError)) return fallback;
  const details = err.details as Record<string, string[]> | undefined;
  return (details && Object.values(details)[0]?.[0]) || err.message;
}

// Administrator and dean accounts — the people who can use this console.
export default function Administrators() {
  const { accessToken, user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ users: Account[] }>('/api/admin/accounts', { token: accessToken });
      setAccounts(data.users);
      setError(null);
    } catch (err) {
      setError(errorText(err, 'Unable to load accounts'));
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setFormError(null);
    try {
      await apiRequest('/api/admin/accounts', {
        method: 'POST',
        token: accessToken,
        body: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          employeeId: form.employeeId.trim(),
          role: form.role,
          password: form.password,
        },
      });
      setAdding(false);
      await load();
    } catch (err) {
      setFormError(errorText(err, 'Unable to create account'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(account: Account) {
    try {
      await apiRequest(`/api/admin/accounts/${account.id}/status`, { method: 'PATCH', token: accessToken, body: { isActive: !account.isActive } });
      await load();
    } catch (err) {
      setError(errorText(err, 'Unable to update status'));
    }
  }

  const input = (key: keyof typeof EMPTY, label: string, props: Partial<InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <label>
      <span style={fieldLabelStyle}>{label}</span>
      <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={inputStyle} required {...props} />
    </label>
  );

  return (
    <Layout>
      <PageHeader
        title="Administrators & Deans"
        action={
          <PrimaryButton
            onClick={() => {
              setForm(EMPTY);
              setFormError(null);
              setAdding(true);
            }}
          >
            + Add Account
          </PrimaryButton>
        }
      />
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -16, marginBottom: 20 }}>
        Everyone here can manage subjects, accounts and reports in this console.
      </div>
      {error && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{error}</div>}

      <Table columns={['Name', 'Email', 'Employee ID', 'Role', 'Status', '']} gridTemplateColumns={COLS}>
        {accounts.map((a) => (
          <TableRow
            key={a.id}
            gridTemplateColumns={COLS}
            faded={!a.isActive}
            columns={[
              <span key="n" style={{ fontWeight: 600 }}>
                {a.fullName}
                {a.id === user?.id && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> (you)</span>}
              </span>,
              <span key="e" style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{a.email}</span>,
              a.employeeId ?? '—',
              a.role === 'ADMIN' ? 'Administrator' : 'Dean',
              <Tag key="s" tone={a.isActive ? 'success' : 'neutral'}>{a.isActive ? 'Active' : 'Disabled'}</Tag>,
              a.id === user?.id ? (
                <span key="x" />
              ) : (
                <SecondaryButton key="t" onClick={() => void toggle(a)} style={{ padding: '6px 12px' }}>
                  {a.isActive ? 'Disable' : 'Enable'}
                </SecondaryButton>
              ),
            ]}
          />
        ))}
      </Table>

      {adding && (
        <FormModal title="Add administrator or dean" submitLabel="Create Account" busy={busy} error={formError} onSubmit={() => void create()} onClose={() => setAdding(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {input('firstName', 'First name', { autoFocus: true })}
            {input('lastName', 'Last name')}
          </div>
          {input('email', 'Email', { type: 'email' })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {input('employeeId', 'Employee ID')}
            <label>
              <span style={fieldLabelStyle}>Role</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                <option value="DEAN">Dean</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </label>
          </div>
          {input('password', 'Initial password', { type: 'password', autoComplete: 'new-password' })}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>At least 8 characters with an uppercase letter and a number. Share it with them securely.</div>
        </FormModal>
      )}
    </Layout>
  );
}
