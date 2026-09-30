import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { ApiError } from '../lib/apiClient';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      <div
        style={{
          flex: 1,
          background: 'var(--primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 80,
        }}
      >
        <div className="serif" style={{ fontWeight: 700, fontSize: 40, color: '#fff', marginBottom: 16 }}>
          CogniView AR
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', maxWidth: 360, lineHeight: 1.6 }}>
          Admin console for managing subjects, modules, the AR library, and institution-wide oversight.
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form style={{ width: 380 }} onSubmit={handleSubmit}>
          <div style={{ fontWeight: 700, fontSize: 28, color: 'var(--text)', marginBottom: 8 }}>Sign in</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 36 }}>
            Use your institution employee ID to continue.
          </div>

          <label
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: 12,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            Employee ID
          </label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              border: '1.5px solid var(--primary)',
              borderRadius: 10,
              padding: '16px 18px',
              marginBottom: 22,
              fontWeight: 600,
              fontSize: 17,
              fontFamily: 'ui-monospace, monospace',
              color: 'var(--text)',
              letterSpacing: '0.04em',
            }}
          />

          <label
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: 12,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px 18px',
              marginBottom: 28,
              fontWeight: 600,
              fontSize: 17,
              color: 'var(--text)',
              letterSpacing: '0.2em',
            }}
          />

          {error && <div style={{ color: 'var(--danger-text)', fontSize: 13, marginBottom: 20 }}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center',
              fontWeight: 600,
              fontSize: 15,
              color: '#fff',
              marginBottom: 20,
              cursor: 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            Forgot password? Contact IT Support
          </div>
        </form>
      </div>
    </div>
  );
}
