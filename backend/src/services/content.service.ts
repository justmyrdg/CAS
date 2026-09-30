import type { ContentType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { imageIdsIn, type LessonBlock } from '../utils/lessonBlocks';
import { assertImagesExist, cleanupQuietly, pruneImages } from './lessonImages.service';

// Lessons and quizzes inside a chapter, kept as one ordered list.

export interface QuestionInput {
  prompt: string;
  choices: string[];
  correctChoice: number;
}

interface ContentInput {
  title: string;
  blocks?: LessonBlock[];
  arModelId?: string | null;
  questions?: QuestionInput[];
}

const asJson = (blocks: LessonBlock[] = []) => blocks as unknown as Prisma.InputJsonValue;

const withQuestions = { questions: { orderBy: { position: 'asc' as const } } };

function questionRows(questions: QuestionInput[] = []) {
  return questions.map((q, position) => ({ ...q, position }));
}

async function checkArModel(arModelId: string | null | undefined) {
  if (arModelId && !(await prisma.arModel.findUnique({ where: { id: arModelId }, select: { id: true } }))) {
    throw ApiError.badRequest('That AR model no longer exists');
  }
}

async function findItemOrThrow(id: string) {
  const item = await prisma.contentItem.findUnique({ where: { id }, include: withQuestions });
  if (!item) throw ApiError.notFound('Lesson or quiz not found');
  return item;
}

export async function getContentItem(id: string) {
  return findItemOrThrow(id);
}

export async function createContentItem(chapterId: string, type: ContentType, input: ContentInput) {
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter) throw ApiError.notFound('Chapter not found');

  if (type === 'LESSON') {
    await checkArModel(input.arModelId);
    await assertImagesExist(imageIdsIn(input.blocks));
  }
  const position = await prisma.contentItem.count({ where: { chapterId } });
  return prisma.contentItem.create({
    data: {
      chapterId,
      type,
      position,
      title: input.title,
      ...(type === 'LESSON' && { blocks: asJson(input.blocks) }),
      arModelId: type === 'LESSON' ? (input.arModelId ?? null) : null,
      ...(type === 'QUIZ' && { questions: { create: questionRows(input.questions) } }),
    },
    include: withQuestions,
  });
}

// Saves the whole editor form. For a quiz the question list is replaced
// wholesale — fine while nothing (e.g. student attempts) references questions.
export async function saveContentItem(id: string, input: ContentInput) {
  const item = await findItemOrThrow(id);

  if (item.type === 'LESSON') {
    await checkArModel(input.arModelId);
    await assertImagesExist(imageIdsIn(input.blocks));
    const saved = await prisma.contentItem.update({
      where: { id },
      data: { title: input.title, blocks: asJson(input.blocks), arModelId: input.arModelId ?? null },
      include: withQuestions,
    });
    // Images this lesson dropped go if nothing else uses them. Unsaved uploads are left alone —
    // that sweep only runs on the cascade paths in catalog.service.ts.
    const kept = new Set(imageIdsIn(input.blocks));
    await cleanupQuietly(pruneImages(imageIdsIn(item.blocks).filter((imageId) => !kept.has(imageId))));
    return saved;
  }

  await prisma.$transaction([
    prisma.quizQuestion.deleteMany({ where: { quizId: id } }),
    prisma.contentItem.update({
      where: { id },
      data: { title: input.title, questions: { create: questionRows(input.questions) } },
    }),
  ]);
  return findItemOrThrow(id);
}

export async function deleteContentItem(id: string) {
  const item = await findItemOrThrow(id);
  await prisma.$transaction([
    prisma.contentItem.delete({ where: { id } }),
    prisma.contentItem.updateMany({
      where: { chapterId: item.chapterId, position: { gt: item.position } },
      data: { position: { decrement: 1 } },
    }),
  ]);
  await cleanupQuietly(pruneImages(imageIdsIn(item.blocks)));
}

export async function reorderContent(chapterId: string, orderedIds: string[]) {
  const current = await prisma.contentItem.findMany({ where: { chapterId }, select: { id: true } });
  const currentIds = current.map((c) => c.id);
  const sameSet =
    currentIds.length === orderedIds.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => currentIds.includes(id));
  if (!sameSet) {
    throw ApiError.conflict('The list changed since it was loaded — refresh and try again');
  }
  await prisma.$transaction(
    orderedIds.map((id, position) => prisma.contentItem.update({ where: { id }, data: { position } })),
  );
}
