import { Prisma } from '@prisma/client';
import type { Enrollment, User } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { fullName } from '../utils/fullName';
import { getClass } from './classes.service';

// Only what an instructor needs to see about a student on a roster.
function serializeEnrollment(enrollment: Enrollment & { student: User }) {
  const { student } = enrollment;
  return {
    id: enrollment.id,
    source: enrollment.source,
    enrolledAt: enrollment.createdAt,
    student: {
      id: student.id,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      fullName: fullName(student),
      srCode: student.srCode,
      email: student.email,
    },
  };
}

export interface ListStudentsOptions {
  page: number;
  pageSize: number;
  search?: string;
}

export async function listStudents(classId: string, instructorId: string, { page, pageSize, search }: ListStudentsOptions) {
  await getClass(classId, instructorId);

  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.EnrollmentWhereInput = {
    classId,
    ...(search && {
      student: {
        OR: [{ firstName: contains }, { middleName: contains }, { lastName: contains }, { srCode: contains }, { email: contains }],
      },
    }),
  };
  const [enrollments, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where,
      include: { student: true },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.enrollment.count({ where }),
  ]);
  return { students: enrollments.map(serializeEnrollment), total };
}

export async function addStudentBySrCode(classId: string, instructorId: string, srCode: string) {
  const cls = await getClass(classId, instructorId);
  if (cls.isArchived) {
    throw ApiError.badRequest('This class is archived, so students can no longer be added');
  }

  const student = await prisma.user.findUnique({ where: { srCode } });
  if (!student || student.role !== 'STUDENT') {
    throw ApiError.notFound(`No student account with SR code ${srCode}`);
  }
  if (!student.isActive) {
    throw ApiError.badRequest(`The student account for ${srCode} is disabled`);
  }

  try {
    const enrollment = await prisma.enrollment.create({
      data: { classId, studentId: student.id, source: 'MANUAL' },
      include: { student: true },
    });
    return serializeEnrollment(enrollment);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ApiError.conflict(`${fullName(student)} is already enrolled in this class`);
    }
    throw err;
  }
}

export async function removeStudent(classId: string, instructorId: string, enrollmentId: string) {
  await getClass(classId, instructorId);

  const { count } = await prisma.enrollment.deleteMany({ where: { id: enrollmentId, classId } });
  if (count === 0) {
    throw ApiError.notFound('That student is not enrolled in this class');
  }
}
