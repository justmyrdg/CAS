import type { Prisma, User, UserPosition, UserPrefix } from '@prisma/client';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password';
import { ApiError } from '../utils/ApiError';

interface CreateInstructorInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  prefix: UserPrefix;
  position: UserPosition;
  employeeId: string;
  email: string;
  createdById: string;
}

function generatePassword(lastName: string, employeeId: string): string {
  const capitalized = lastName.charAt(0).toUpperCase() + lastName.slice(1);
  return `${capitalized}${employeeId}`;
}

export async function createInstructor(
  input: CreateInstructorInput,
): Promise<{ user: User; generatedPassword: string }> {
  const generatedPassword = generatePassword(input.lastName, input.employeeId);
  const passwordHash = await hashPassword(generatedPassword);

  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      middleName: input.middleName,
      lastName: input.lastName,
      prefix: input.prefix,
      position: input.position,
      employeeId: input.employeeId,
      email: input.email.toLowerCase(),
      passwordHash,
      role: 'INSTRUCTOR',
      mustChangePassword: true,
      createdById: input.createdById,
    },
  });

  return { user, generatedPassword };
}

export interface ListInstructorsOptions {
  page: number;
  pageSize: number;
  search?: string;
  status: 'all' | 'active' | 'inactive';
}

export async function listInstructors({ page, pageSize, search, status }: ListInstructorsOptions) {
  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.UserWhereInput = {
    role: 'INSTRUCTOR',
    ...(status !== 'all' && { isActive: status === 'active' }),
    ...(search && {
      OR: [
        { firstName: contains },
        { middleName: contains },
        { lastName: contains },
        { email: contains },
        { employeeId: contains },
      ],
    }),
  };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total };
}

interface UpdateInstructorInput {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  prefix?: UserPrefix;
  position?: UserPosition;
}

async function findInstructorOrThrow(id: string): Promise<User> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== 'INSTRUCTOR') {
    throw ApiError.notFound('Instructor account not found');
  }
  return target;
}

export async function updateInstructor(id: string, input: UpdateInstructorInput) {
  await findInstructorOrThrow(id);
  return prisma.user.update({ where: { id }, data: input });
}

export async function setInstructorActive(id: string, isActive: boolean) {
  await findInstructorOrThrow(id);
  return prisma.user.update({ where: { id }, data: { isActive } });
}
