import { Platform } from 'react-native';
import { deleteItem, getItem, setItem } from './storage';

// The backend. On a real phone "localhost" is the phone itself, so set
// EXPO_PUBLIC_API_URL to your computer's LAN address (e.g. http://192.168.1.10:4000).
// The Android emulator reaches the host machine at 10.0.2.2.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

const REFRESH_TOKEN_KEY = 'cogniview.refreshToken';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export interface StudentUser {
  id: string;
  email: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  role: 'ADMIN' | 'DEAN' | 'INSTRUCTOR' | 'STUDENT';
  srCode: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface Session {
  user: StudentUser;
  accessToken: string;
  refreshToken: string;
}

// ---------- Session handling ----------
// The mobile client can't rely on cookies, so the backend hands us the refresh
// token in the response body (X-Client-App: mobile). Refresh tokens are
// single-use: parallel requests must share one in-flight refresh.

let accessToken: string | null = null;
let inflightRefresh: Promise<Session | null> | null = null;
let sessionListener: ((session: Session | null) => void) | null = null;

export function onSessionChange(listener: ((session: Session | null) => void) | null) {
  sessionListener = listener;
}

async function rawRequest(path: string, init: { method: string; body?: unknown; token?: string | null }) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-App': 'mobile',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export async function saveSession(session: Session | null) {
  accessToken = session?.accessToken ?? null;
  if (session) await setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  else await deleteItem(REFRESH_TOKEN_KEY);
  sessionListener?.(session);
}

// Trades the stored refresh token for a new session (used at app start and when an access token expires).
export function refreshSession(): Promise<Session | null> {
  inflightRefresh ??= (async () => {
    const stored = await getItem(REFRESH_TOKEN_KEY);
    if (!stored) return null;
    try {
      const res = await rawRequest('/api/auth/refresh', { method: 'POST', body: { refreshToken: stored } });
      if (!res.ok) {
        // Only a definite rejection signs the student out; a network blip keeps the token for next time.
        if (res.status === 401) await saveSession(null);
        return null;
      }
      const session = (await res.json()) as Session;
      await saveSession(session);
      return session;
    } catch {
      return null;
    }
  })().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

// Logs out: revokes the stored refresh token server-side (best effort) and forgets the session.
export async function endSession() {
  const stored = await getItem(REFRESH_TOKEN_KEY);
  if (stored) {
    await rawRequest('/api/auth/logout', { method: 'POST', body: { refreshToken: stored } }).catch(() => undefined);
  }
  await saveSession(null);
}

export async function apiRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; auth?: boolean } = {},
  isRetry = false,
): Promise<T> {
  const useAuth = options.auth ?? true;
  let res: Response;
  try {
    res = await rawRequest(path, { method: options.method ?? 'GET', body: options.body, token: useAuth ? accessToken : null });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_BASE_URL}. Check your connection and try again.`);
  }

  if (res.status === 401 && useAuth && !isRetry) {
    const session = await refreshSession();
    if (session) return apiRequest<T>(path, options, true);
  }

  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error ?? 'Something went wrong';
    const details = (data as { details?: unknown } | undefined)?.details;
    throw new ApiError(res.status, message, details);
  }
  return data as T;
}

// First validation message from a 400's field details, else the error message.
export function errorText(err: unknown, fallback = 'Something went wrong'): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.details && typeof err.details === 'object') {
    for (const value of Object.values(err.details as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    }
  }
  return err.message;
}
