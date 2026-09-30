import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, apiRequest, endSession, onSessionChange, refreshSession, saveSession } from '../lib/api';
import type { Session, StudentUser } from '../lib/api';

interface AuthContextValue {
  user: StudentUser | null;
  // True while the saved session is being restored at launch.
  initializing: boolean;
  login: (srCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: StudentUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<StudentUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const applySession = useCallback((session: Session | null) => {
    setUserState(session && session.user.role === 'STUDENT' ? session.user : null);
  }, []);

  useEffect(() => {
    onSessionChange(applySession);
    void refreshSession().finally(() => setInitializing(false));
    return () => onSessionChange(null);
  }, [applySession]);

  async function login(srCode: string, password: string) {
    const session = await apiRequest<Session>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { identifier: srCode.trim(), password },
    });
    if (session.user.role !== 'STUDENT') {
      await apiRequest('/api/auth/logout', { method: 'POST', auth: false, body: { refreshToken: session.refreshToken } }).catch(
        () => undefined,
      );
      throw new ApiError(403, 'This app is for students. Instructors and admins should use the web portals.');
    }
    await saveSession(session);
  }

  async function logout() {
    await endSession();
  }

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout, setUser: setUserState }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
