import type { UserPosition, UserPrefix, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password';
import { ApiError } from '../utils/ApiError';

interface CreateAccountInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  prefix?: UserPrefix;
  position?: UserPosition;
  email: string;
  password: string;
  role: Extract<UserRole, 'ADMIN' | 'DEAN'>;
  employeeId: string;
  createdById: string;
}

export async function createAdminAccount(input: CreateAccountInput) {
  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      prefix: input.prefix,
      position: input.position,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      employeeId: input.employeeId,
      createdById: input.createdById,
    },
  });
}

export function listAdminAccounts() {
  return prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'DEAN'] } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function setAccountActive(id: string, isActive: boolean, actingUserId: string) {
  if (id === actingUserId && !isActive) {
    throw ApiError.badRequest('You cannot disable your own account');
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || !['ADMIN', 'DEAN'].includes(target.role)) {
    throw ApiError.notFound('Admin/dean account not found');
  }

  return prisma.user.update({ where: { id }, data: { isActive } });
}
