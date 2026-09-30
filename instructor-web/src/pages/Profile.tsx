import type { ReactNode } from 'react';
import Layout from '../components/Layout';
import { PageHeader } from '../components/ui';
import { useAuth } from '../state/AuthContext';

const POSITION_LABELS: Record<string, string> = { FULL_TIME: 'Full-time', PART_TIME: 'Part-time' };

function DetailRow({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: last ? undefined : '1px solid var(--border-light)',
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M5 2l6 5-6 5" stroke="#9CA8A1" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <Layout>
      <PageHeader title="Profile" />

      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{user.fullName}</div>
            <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-muted)' }}>
              Instructor{user.employeeId ? ` · Employee ID ${user.employeeId}` : ''}
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="Employee ID" value={user.employeeId ?? '—'} />
          <DetailRow label="Position" value={(user.position && POSITION_LABELS[user.position]) ?? '—'} last />
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <DetailRow label="Notifications" value={<Chevron />} />
          <DetailRow label="Help & Support" value={<Chevron />} last />
        </div>
      </div>
    </Layout>
  );
}
