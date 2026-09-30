import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import type { Term } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

// No 0/O or 1/I/L, so a code read aloud or copied by hand can't be misread.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 4;
const MAX_JOIN_CODE_ATTEMPTS = 5;

const WITH_STUDENT_COUNT = { _count: { select: { enrollments: true } } } as const;

// Flattens Prisma's `_count` into a plain `studentCount` for the API response.
function withStudentCount<T extends { _count: { enrollments: number } }>({ _count, ...rest }: T) {
  return { ...rest, studentCount: _count.enrollments };
}

function randomJoinSuffix(): string {
  let suffix = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    suffix += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return suffix;
}

function isUniqueViolationOn(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const target = err.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target).includes(field);
}

interface CreateClassInput {
  subjectId: string;
  section: string;
  term: Term;
  schoolYear: string;
  instructorId: string;
}

export async function createClass(input: CreateClassInput) {
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) {
    throw ApiError.badRequest('That subject no longer exists — pick another');
  }
  const subjectCode = subject.code;

  // Join codes are random, so a collision is possible but rare — retry a
  // few times rather than pre-checking (which would race anyway).
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
    try {
      const created = await prisma.class.create({
        include: WITH_STUDENT_COUNT,
        data: {
          subjectCode,
          subjectName: subject.name,
          subjectId: subject.id,
          section: input.section,
          term: input.term,
          schoolYear: input.schoolYear,
          joinCode: `${subjectCode}-${randomJoinSuffix()}`,
          instructorId: input.instructorId,
        },
      });
      return withStudentCount(created);
    } catch (err) {
      if (isUniqueViolationOn(err, 'joinCode')) continue;
      if (isUniqueViolationOn(err, 'section')) {
        throw ApiError.conflict('You already have this subject and section for that term');
      }
      throw err;
    }
  }
  throw new ApiError(500, 'Could not generate a unique join code, please try again');
}

export interface ListClassesOptions {
  instructorId: string;
  page: number;
  pageSize: number;
  search?: string;
  status: 'all' | 'active' | 'archived';
}

export async function listClasses({ instructorId, page, pageSize, search, status }: ListClassesOptions) {
  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.ClassWhereInput = {
    instructorId,
    ...(status !== 'all' && { isArchived: status === 'archived' }),
    ...(search && {
      OR: [{ subjectCode: contains }, { subjectName: contains }, { section: contains }, { joinCode: contains }],
    }),
  };
  const [classes, total] = await prisma.$transaction([
    prisma.class.findMany({
      where,
      include: WITH_STUDENT_COUNT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.class.count({ where }),
  ]);
  return { classes: classes.map(withStudentCount), total };
}

// Scoped to the instructor so one instructor can't read another's class by id.
export async function getClass(id: string, instructorId: string) {
  const found = await prisma.class.findFirst({ where: { id, instructorId }, include: WITH_STUDENT_COUNT });
  if (!found) {
    throw ApiError.notFound('Class not found');
  }
  return withStudentCount(found);
}

// Counts for the instructor dashboard. A student in two of the instructor's
// classes counts once towards totalStudents.
export async function getSummary(instructorId: string) {
  const activeClassWhere = { instructorId, isArchived: false };
  const [activeClasses, distinctStudents] = await prisma.$transaction([
    prisma.class.count({ where: activeClassWhere }),
    prisma.enrollment.findMany({
      where: { class: activeClassWhere },
      distinct: ['studentId'],
      select: { studentId: true },
    }),
  ]);
  return { activeClasses, totalStudents: distinctStudents.length };
}

interface UpdateClassInput {
  section?: string;
  term?: Term;
  schoolYear?: string;
  isArchived?: boolean;
}

// Edit section/term, or archive/unarchive. Subject and join code stay fixed.
export async function updateClass(id: string, instructorId: string, input: UpdateClassInput) {
  await getClass(id, instructorId);
  try {
    const updated = await prisma.class.update({ where: { id }, data: input, include: WITH_STUDENT_COUNT });
    return withStudentCount(updated);
  } catch (err) {
    if (isUniqueViolationOn(err, 'section')) {
      throw ApiError.conflict('You already have this subject and section for that term');
    }
    throw err;
  }
}

// Removes the class and its roster. Students' own lesson/quiz progress stays (it belongs to the subject's content).
export async function deleteClass(id: string, instructorId: string) {
  await getClass(id, instructorId);
  await prisma.class.delete({ where: { id } });
}
