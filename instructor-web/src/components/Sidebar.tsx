import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/classes', label: 'My Classes' },
  { to: '/profile', label: 'Profile' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div
      style={{
        width: 200,
        background: 'var(--primary-dark)',
        flexShrink: 0,
        padding: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div
        className="serif"
        style={{
          fontWeight: 700,
          fontSize: 19,
          color: '#fff',
          padding: '0 20px',
          marginBottom: 4,
        }}
      >
        CogniView AR
      </div>
      <div
        style={{
          fontWeight: 500,
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '0 20px',
          marginBottom: 22,
        }}
      >
        Instructor
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            padding: '11px 20px',
            color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
            background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
            fontWeight: isActive ? 600 : 500,
            fontSize: 13,
            borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
          })}
        >
          {item.label}
        </NavLink>
      ))}

      <div style={{ marginTop: 'auto', padding: '16px 20px 0', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        {user && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#fff', overflowWrap: 'anywhere' }}>{user.fullName}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              Instructor{user.employeeId ? ` · ${user.employeeId}` : ''}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate('/change-password')}
          style={{ background: 'none', border: 'none', padding: 0, marginBottom: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer' }}
        >
          Change password
        </button>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            padding: '9px 12px',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: loggingOut ? 'default' : 'pointer',
            opacity: loggingOut ? 0.6 : 1,
          }}
        >
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </div>
  );
}
