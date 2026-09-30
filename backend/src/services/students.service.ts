import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password';
import { ApiError } from '../utils/ApiError';

// Admin/dean management of student accounts. Students sign in to the mobile
// app with their SR code and a temporary password that they must change.

const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz';
const TEMP_UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';

// e.g. "Kbvqrm-4827": random, readable, and meets the password rules (uppercase + digit + 8 chars).
function temporaryPassword(): string {
  let letters = TEMP_UPPER[randomInt(TEMP_UPPER.length)];
  for (let i = 0; i < 5; i += 1) letters += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  const digits = String(randomInt(1000, 10000));
  return `${letters}-${digits}`;
}

function uniqueViolationMessage(err: unknown): string | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null;
  const target = String(err.meta?.target ?? '');
  if (target.includes('srCode')) return 'A student with that SR code already exists';
  if (target.includes('email')) return 'An account with that email already exists';
  return 'That student already exists';
}

interface CreateStudentInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  srCode: string;
  email: string;
  createdById: string;
}

export async function createStudent(input: CreateStudentInput): Promise<{ user: User; generatedPassword: string }> {
  const generatedPassword = temporaryPassword();
  try {
    const user = await prisma.user.create({
      data: {
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        srCode: input.srCode,
        email: input.email.toLowerCase(),
        passwordHash: await hashPassword(generatedPassword),
        role: 'STUDENT',
        mustChangePassword: true,
        createdById: input.createdById,
      },
    });
    return { user, generatedPassword };
  } catch (err) {
    const message = uniqueViolationMessage(err);
    if (message) throw ApiError.conflict(message);
    throw err;
  }
}

export async function listStudents({
  page,
  pageSize,
  search,
  status,
}: {
  page: number;
  pageSize: number;
  search?: string;
  status: 'all' | 'active' | 'inactive';
}) {
  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.UserWhereInput = {
    role: 'STUDENT',
    ...(status !== 'all' && { isActive: status === 'active' }),
    ...(search && {
      OR: [{ firstName: contains }, { middleName: contains }, { lastName: contains }, { email: contains }, { srCode: contains }],
    }),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { enrollments: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total };
}

async function findStudentOrThrow(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== 'STUDENT') throw ApiError.notFound('Student not found');
  return user;
}

export async function updateStudent(
  id: string,
  input: { firstName?: string; middleName?: string | null; lastName?: string; email?: string },
) {
  await findStudentOrThrow(id);
  try {
    return await prisma.user.update({
      where: { id },
      data: { ...input, ...(input.email && { email: input.email.toLowerCase() }) },
    });
  } catch (err) {
    const message = uniqueViolationMessage(err);
    if (message) throw ApiError.conflict(message);
    throw err;
  }
}

export async function setStudentActive(id: string, isActive: boolean) {
  await findStudentOrThrow(id);
  return prisma.user.update({ where: { id }, data: { isActive } });
}

// For a student who forgot their password: new temporary password, forced change,
// and every existing session signed out.
export async function resetStudentPassword(id: string) {
  await findStudentOrThrow(id);
  const generatedPassword = temporaryPassword();
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(generatedPassword), mustChangePassword: true },
    }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return { user, generatedPassword };
}
