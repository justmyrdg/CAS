import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { cleanupQuietly, pruneOrphanImages } from './lessonImages.service';

// ---------- Subjects ----------

export interface ListSubjectsOptions {
  page: number;
  pageSize: number;
  search?: string;
}

export async function listSubjects({ page, pageSize, search }: ListSubjectsOptions) {
  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.SubjectWhereInput = search ? { OR: [{ code: contains }, { name: contains }] } : {};
  const [subjects, total] = await prisma.$transaction([
    prisma.subject.findMany({
      where,
      include: { _count: { select: { modules: true, classes: true } } },
      orderBy: { code: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subject.count({ where }),
  ]);
  return {
    subjects: subjects.map(({ _count, ...subject }) => ({
      ...subject,
      moduleCount: _count.modules,
      classCount: _count.classes,
    })),
    total,
  };
}

// Just what the instructor's "pick a subject" dropdown needs.
export function listSubjectOptions() {
  return prisma.subject.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } });
}

export async function getSubject(id: string) {
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: {
          chapters: {
            orderBy: { position: 'asc' },
            include: {
              // Outline only — lesson text and quiz questions load in their editors.
              items: {
                orderBy: { position: 'asc' },
                select: { id: true, type: true, title: true, position: true, _count: { select: { questions: true } } },
              },
            },
          },
        },
      },
      _count: { select: { classes: true } },
    },
  });
  if (!subject) throw ApiError.notFound('Subject not found');
  const { _count, modules, ...rest } = subject;
  return {
    ...rest,
    classCount: _count.classes,
    modules: modules.map((mod) => ({
      ...mod,
      chapters: mod.chapters.map((chapter) => ({
        ...chapter,
        items: chapter.items.map(({ _count: itemCount, ...item }) => ({ ...item, questionCount: itemCount.questions })),
      })),
    })),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

interface SubjectInput {
  code: string;
  name: string;
  description?: string | null;
}

export async function createSubject(input: SubjectInput) {
  try {
    return await prisma.subject.create({ data: input });
  } catch (err) {
    if (isUniqueViolation(err)) throw ApiError.conflict(`A subject with code ${input.code} already exists`);
    throw err;
  }
}

export async function updateSubject(id: string, input: Partial<SubjectInput>) {
  await getSubject(id);
  try {
    return await prisma.subject.update({ where: { id }, data: input });
  } catch (err) {
    if (isUniqueViolation(err)) throw ApiError.conflict(`A subject with code ${input.code} already exists`);
    throw err;
  }
}

export async function deleteSubject(id: string) {
  const subject = await getSubject(id);
  if (subject.classCount > 0) {
    throw ApiError.conflict(
      `${subject.code} can't be deleted: ${subject.classCount} class${subject.classCount === 1 ? ' is' : 'es are'} using it`,
    );
  }
  // Modules and chapters go with it (onDelete: Cascade).
  await prisma.subject.delete({ where: { id } });
  // Lessons deleted by the cascade may have left images nothing uses any more.
  await cleanupQuietly(pruneOrphanImages());
}

// ---------- Ordering helper ----------

// Rewrites positions to match `orderedIds`, which must be exactly the current
// set of children — so a stale client (someone else added/removed one) gets a
// clear error instead of silently scrambling the order.
async function applyOrder(currentIds: string[], orderedIds: string[], update: (id: string, position: number) => Prisma.PrismaPromise<unknown>) {
  const sameSet =
    currentIds.length === orderedIds.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => currentIds.includes(id));
  if (!sameSet) {
    throw ApiError.conflict('The list changed since it was loaded — refresh and try again');
  }
  await prisma.$transaction(orderedIds.map((id, position) => update(id, position)));
}

// ---------- Modules ----------

interface ItemInput {
  title: string;
  description?: string | null;
}

async function findModuleOrThrow(id: string) {
  const mod = await prisma.module.findUnique({ where: { id } });
  if (!mod) throw ApiError.notFound('Module not found');
  return mod;
}

interface ModuleWithChaptersInput extends ItemInput {
  chapters?: ItemInput[];
}

// Creates a module and (optionally) its chapters in one go, appended after the subject's last module.
export async function createModule(subjectId: string, { chapters = [], ...input }: ModuleWithChaptersInput) {
  await getSubject(subjectId);
  const position = await prisma.module.count({ where: { subjectId } });
  return prisma.module.create({
    data: {
      ...input,
      subjectId,
      position,
      chapters: { create: chapters.map((chapter, index) => ({ ...chapter, position: index })) },
    },
    include: { chapters: { orderBy: { position: 'asc' } } },
  });
}

interface SaveModuleInput extends ItemInput {
  // The module's full chapter list, in order. Entries with an id update that
  // chapter; entries without one are new; existing chapters left out are deleted.
  chapters: (ItemInput & { id?: string })[];
}

// Saves the module editor's whole form — module fields plus its chapter list — atomically.
export async function saveModule(id: string, { chapters, ...input }: SaveModuleInput) {
  await findModuleOrThrow(id);
  const existing = await prisma.chapter.findMany({ where: { moduleId: id }, select: { id: true } });
  const existingIds = new Set(existing.map((c) => c.id));

  const unknown = chapters.find((c) => c.id && !existingIds.has(c.id));
  if (unknown) {
    throw ApiError.conflict('A chapter in this module was removed since the page was loaded — refresh and try again');
  }
  const keptIds = new Set(chapters.flatMap((c) => (c.id ? [c.id] : [])));

  await prisma.$transaction([
    prisma.module.update({ where: { id }, data: input }),
    prisma.chapter.deleteMany({ where: { moduleId: id, id: { notIn: [...keptIds] } } }),
    ...chapters.map(({ id: chapterId, ...chapter }, position) =>
      chapterId
        ? prisma.chapter.update({ where: { id: chapterId }, data: { ...chapter, position } })
        : prisma.chapter.create({ data: { ...chapter, position, moduleId: id } }),
    ),
  ]);

  const saved = await prisma.module.findUniqueOrThrow({ where: { id }, include: { chapters: { orderBy: { position: 'asc' } } } });
  await cleanupQuietly(pruneOrphanImages());
  return saved;
}

export async function updateModule(id: string, input: Partial<ItemInput>) {
  await findModuleOrThrow(id);
  return prisma.module.update({ where: { id }, data: input });
}

export async function deleteModule(id: string) {
  const mod = await findModuleOrThrow(id);
  // Close the gap so positions stay 0..n-1.
  await prisma.$transaction([
    prisma.module.delete({ where: { id } }),
    prisma.module.updateMany({
      where: { subjectId: mod.subjectId, position: { gt: mod.position } },
      data: { position: { decrement: 1 } },
    }),
  ]);
  await cleanupQuietly(pruneOrphanImages());
}

export async function reorderModules(subjectId: string, orderedIds: string[]) {
  await getSubject(subjectId);
  const current = await prisma.module.findMany({ where: { subjectId }, select: { id: true } });
  await applyOrder(
    current.map((m) => m.id),
    orderedIds,
    (id, position) => prisma.module.update({ where: { id }, data: { position } }),
  );
}

// ---------- Chapters ----------

async function findChapterOrThrow(id: string) {
  const chapter = await prisma.chapter.findUnique({ where: { id } });
  if (!chapter) throw ApiError.notFound('Chapter not found');
  return chapter;
}

export async function createChapter(moduleId: string, input: ItemInput) {
  await findModuleOrThrow(moduleId);
  const position = await prisma.chapter.count({ where: { moduleId } });
  return prisma.chapter.create({ data: { ...input, moduleId, position } });
}

export async function updateChapter(id: string, input: Partial<ItemInput>) {
  await findChapterOrThrow(id);
  return prisma.chapter.update({ where: { id }, data: input });
}

export async function deleteChapter(id: string) {
  const chapter = await findChapterOrThrow(id);
  await prisma.$transaction([
    prisma.chapter.delete({ where: { id } }),
    prisma.chapter.updateMany({
      where: { moduleId: chapter.moduleId, position: { gt: chapter.position } },
      data: { position: { decrement: 1 } },
    }),
  ]);
  await cleanupQuietly(pruneOrphanImages());
}

export async function reorderChapters(moduleId: string, orderedIds: string[]) {
  await findModuleOrThrow(moduleId);
  const current = await prisma.chapter.findMany({ where: { moduleId }, select: { id: true } });
  await applyOrder(
    current.map((c) => c.id),
    orderedIds,
    (id, position) => prisma.chapter.update({ where: { id }, data: { position } }),
  );
}
