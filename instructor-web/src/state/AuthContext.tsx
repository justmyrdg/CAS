import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, apiRequest, onSessionChange, refreshSession } from '../lib/apiClient';
import type { Session } from '../lib/apiClient';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  prefix: string | null;
  position: string | null;
  role: 'ADMIN' | 'DEAN' | 'INSTRUCTOR' | 'STUDENT';
  employeeId: string | null;
  srCode: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

// Who may use this app. Anyone else is signed straight back out.
const ALLOWED_ROLES: AuthUser['role'][] = ['INSTRUCTOR'];
const WRONG_ROLE_MESSAGE = 'This portal is for instructors only. Admins and deans should use the admin console.';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  // True until the saved session (if any) has been restored on page load.
  initializing: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const applySession = useCallback((session: Session | null) => {
    const next = session as Session<AuthUser> | null;
    if (next && ALLOWED_ROLES.includes(next.user.role)) {
      setUserState(next.user);
      setAccessToken(next.accessToken);
    } else {
      setUserState(null);
      setAccessToken(null);
    }
  }, []);

  // Restore the session from the refresh cookie on page load, and keep state in sync with background refreshes.
  useEffect(() => {
    onSessionChange(applySession);
    void refreshSession().finally(() => setInitializing(false));
    return () => onSessionChange(null);
  }, [applySession]);

  async function login(identifier: string, password: string) {
    const data = await apiRequest<Session<AuthUser>>('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    if (!ALLOWED_ROLES.includes(data.user.role)) {
      await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
      throw new ApiError(403, WRONG_ROLE_MESSAGE);
    }
    applySession(data);
  }

  async function logout() {
    try {
      // Revokes the refresh token server-side and clears its cookie.
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Still sign out locally if the server can't be reached.
    }
    applySession(null);
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, initializing, login, logout, setUser: setUserState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
