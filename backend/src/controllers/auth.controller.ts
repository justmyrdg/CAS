import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { serializeUser } from '../utils/serializeUser';
import { ApiError } from '../utils/ApiError';
import * as authService from '../services/auth.service';

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Employee ID, SR code or email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Each web app gets its own refresh cookie (chosen by the X-Client-App header),
// so being signed in to admin-web doesn't clobber an instructor-web session on
// the same machine. The mobile app can't rely on cookies, so it receives the
// refresh token in the response body instead and sends it back in the body.
const COOKIE_APPS = ['admin', 'instructor'] as const;
type ClientApp = (typeof COOKIE_APPS)[number] | 'mobile' | 'default';

function clientApp(req: Request): ClientApp {
  const header = req.get('x-client-app');
  if (header === 'mobile') return 'mobile';
  return (COOKIE_APPS as readonly string[]).includes(header ?? '') ? (header as ClientApp) : 'default';
}

function cookieName(app: ClientApp) {
  return app === 'default' || app === 'mobile' ? 'refreshToken' : `refreshToken_${app}`;
}

// httpOnly + sameSite so the refresh token is never reachable from page
// JS (XSS) and never sent cross-site (CSRF) — only this API's own
// same-site fetch/XHR calls carry it automatically.
function setRefreshCookie(res: Response, app: ClientApp, token: string, expiresAt: Date) {
  res.cookie(cookieName(app), token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/api/auth',
  });
}

function readRefreshToken(req: Request, app: ClientApp): string | undefined {
  if (app === 'mobile') {
    const bodyToken = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
    return typeof bodyToken === 'string' ? bodyToken : undefined;
  }
  return req.cookies?.[cookieName(app)];
}

function sendSession(
  res: Response,
  app: ClientApp,
  session: { user: Parameters<typeof serializeUser>[0]; accessToken: string; refreshToken: string; refreshExpiresAt: Date },
) {
  if (app === 'mobile') {
    res.json({ user: serializeUser(session.user), accessToken: session.accessToken, refreshToken: session.refreshToken });
    return;
  }
  setRefreshCookie(res, app, session.refreshToken, session.refreshExpiresAt);
  res.json({ user: serializeUser(session.user), accessToken: session.accessToken });
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password } = req.body as z.infer<typeof loginSchema>;
  sendSession(res, clientApp(req), await authService.login(identifier, password));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const app = clientApp(req);
  const token = readRefreshToken(req, app);
  if (!token) {
    throw ApiError.unauthorized('Missing refresh token');
  }
  sendSession(res, app, await authService.refreshSession(token));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const app = clientApp(req);
  const token = readRefreshToken(req, app);
  if (token) {
    await authService.logout(token);
  }
  if (app !== 'mobile') res.clearCookie(cookieName(app), { path: '/api/auth' });
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  res.json({ user: serializeUser(req.user) });
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
  const user = await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.json({ user: serializeUser(user) });
});
