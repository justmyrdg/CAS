import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import type { AuthUser } from '../state/AuthContext';

const labelStyle: CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
};

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '14px 16px',
  marginBottom: 18,
  fontSize: 15,
  color: 'var(--text)',
};

// Shown on first sign-in with a generated password (mustChangePassword), and reachable any time after.
export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, accessToken, setUser, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const forced = Boolean(user?.mustChangePassword);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('The new passwords don’t match.');
      return;
    }
    if (next === current) {
      setError('Choose a password different from your current one.');
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<{ user: AuthUser }>('/api/auth/change-password', {
        method: 'POST',
        token: accessToken,
        body: { currentPassword: current, newPassword: next },
      });
      setUser(data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const fieldError = err instanceof ApiError ? (err.details as { newPassword?: string[] } | undefined)?.newPassword?.[0] : undefined;
      setError(fieldError ?? (err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.'));
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 24 }}>
      <form onSubmit={submit} style={{ width: 400 }}>
        <div className="serif" style={{ fontWeight: 700, fontSize: 22, color: 'var(--primary)', marginBottom: 24 }}>
          CogniView AR
        </div>
        <div style={{ fontWeight: 700, fontSize: 26, color: 'var(--text)', marginBottom: 8 }}>
          {forced ? 'Set a new password' : 'Change password'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.5 }}>
          {forced
            ? 'You signed in with a temporary password. Choose your own password to continue.'
            : 'At least 8 characters, with an uppercase letter and a number.'}
        </div>

        <label style={labelStyle} htmlFor="current">
          {forced ? 'Temporary password' : 'Current password'}
        </label>
        <input id="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} style={inputStyle} />

        <label style={labelStyle} htmlFor="next">
          New password
        </label>
        <input id="next" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} style={inputStyle} />

        <label style={labelStyle} htmlFor="confirm">
          Confirm new password
        </label>
        <input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />

        {error && (
          <div role="alert" style={{ marginBottom: 16, fontSize: 13, color: 'var(--danger-text)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            background: 'var(--primary)',
            border: 'none',
            borderRadius: 8,
            padding: 15,
            fontWeight: 600,
            fontSize: 15,
            color: '#fff',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
            marginBottom: 14,
          }}
        >
          {saving ? 'Saving…' : 'Save Password'}
        </button>
        <button
          type="button"
          onClick={() => (forced ? void logout().then(() => navigate('/login', { replace: true })) : navigate(-1))}
          style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}
        >
          {forced ? 'Sign out' : 'Cancel'}
        </button>
      </form>
    </div>
  );
}
