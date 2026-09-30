export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

// Tells the backend which refresh cookie belongs to this app (see backend auth.controller).
const CLIENT_APP = 'admin';

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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  // Sent as-is (e.g. a File for uploads) instead of JSON-encoding `body`.
  rawBody?: Blob;
  token?: string | null;
}

export interface Session<User = unknown> {
  user: User;
  accessToken: string;
}

// ---------- Session refresh ----------
// Access tokens last 15 minutes. When a request comes back 401, we trade the
// httpOnly refresh cookie for a new session once and retry. Refresh tokens are
// single-use, so concurrent callers must share one in-flight refresh — two
// parallel refreshes would spend the same token and the loser would sign us out.

let inflightRefresh: Promise<Session | null> | null = null;
let sessionListener: ((session: Session | null) => void) | null = null;

// AuthContext registers here so tokens refreshed behind the scenes update React state.
export function onSessionChange(listener: ((session: Session | null) => void) | null) {
  sessionListener = listener;
}

export function refreshSession(): Promise<Session | null> {
  inflightRefresh ??= fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Client-App': CLIENT_APP },
  })
    .then(async (res) => (res.ok ? ((await res.json()) as Session) : null))
    .catch(() => null)
    .then((session) => {
      sessionListener?.(session);
      return session;
    })
    .finally(() => {
      inflightRefresh = null;
    });
  return inflightRefresh;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    // Lets the browser store and send the httpOnly refresh-token cookie.
    credentials: 'include',
    headers: {
      'Content-Type': options.rawBody ? 'application/octet-stream' : 'application/json',
      'X-Client-App': CLIENT_APP,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });

  // Expired access token: refresh once and retry with the new one.
  if (res.status === 401 && options.token && !isRetry) {
    const session = await refreshSession();
    if (session) return apiRequest<T>(path, { ...options, token: session.accessToken }, true);
  }

  const data: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error ?? 'Request failed';
    const details = (data as { details?: unknown } | undefined)?.details;
    throw new ApiError(res.status, message, details);
  }

  return data as T;
}
