import ms from 'ms';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { comparePassword, hashPassword } from '../utils/password';
import { sha256 } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { randomUUID } from 'crypto';
import type { User } from '@prisma/client';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

async function issueTokenPair(user: User): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });

  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  const refreshExpiresAt = new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue));

  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256(refreshToken),
      userId: user.id,
      expiresAt: refreshExpiresAt,
    },
  });

  return { accessToken, refreshToken, refreshExpiresAt };
}

export async function login(identifier: string, password: string): Promise<{ user: User } & TokenPair> {
  // One login endpoint for every app: email, a student's SR code (e.g. 23-01452), or an employee ID.
  const where = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : /^\d{2}-\d{5}$/.test(identifier)
      ? { srCode: identifier }
      : { employeeId: identifier };
  const user = await prisma.user.findUnique({ where });

  // Same error for "no such user" and "wrong password" so the endpoint
  // doesn't leak which identifiers exist.
  if (!user) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been disabled');
  }

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
}

export async function refreshSession(rawRefreshToken: string): Promise<{ user: User } & TokenPair> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = sha256(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is disabled or no longer exists');
  }

  // Rotate: the presented token is single-use. Revoking it here means a
  // stolen-and-replayed refresh token stops working after the legitimate
  // client's next refresh.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = sha256(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.unauthorized();
  }

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}
