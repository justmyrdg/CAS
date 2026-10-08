import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { storage } from '../config/storage';
import { ApiError } from '../utils/ApiError';
import { convertToGlb } from '../utils/modelConversion';
import { presentHotspots } from '../utils/arHotspots';
import { removeTriggerFilesFor } from './arTriggers.service';
import type { Hotspot } from '../utils/arHotspots';

// Uploaded 3D models are kept by the file storage (config/storage: backend/uploads/ar or Cloudinary),
// with metadata in the ar_models table.
export const MAX_AR_BYTES = 50 * 1024 * 1024;

const GLB_MIME = 'model/gltf-binary';

// Checks the upload (extension + actual contents) and converts it to a self-contained .glb — see utils/modelConversion.
async function prepareModelFile(fileName: string, data: Buffer) {
  if (data.length > MAX_AR_BYTES) throw ApiError.badRequest('Models must be 50 MB or smaller');
  return { ext: '.glb', mimeType: GLB_MIME, data: await convertToGlb(fileName, data) };
}

async function storeFile(ext: string, data: Buffer) {
  const storedName = `${randomUUID()}${ext}`;
  await storage.save('ar', storedName, data);
  return storedName;
}

async function removeFile(storedName: string) {
  await storage.remove('ar', storedName);
}

const withCounts = { subject: { select: { code: true, name: true } }, _count: { select: { lessons: true } } } as const;

type ArModelRow = Prisma.ArModelGetPayload<{ include: typeof withCounts }>;

// What the API returns for a model; fileUrl is relative to the API base (e.g. /api/ar-models/<id>/file).
export function serializeArModel(model: ArModelRow) {
  const { _count, subject, storedName: _storedName, hotspots, ...rest } = model;
  return {
    ...rest,
    hotspots: presentHotspots(hotspots),
    subjectCode: subject?.code ?? null,
    subjectName: subject?.name ?? null,
    lessonCount: _count.lessons,
    fileUrl: `/api/ar-models/${model.id}/file`,
  };
}

interface ArMetadata {
  name: string;
  description?: string | null;
  subjectId?: string | null;
}

async function checkSubject(subjectId: string | null | undefined) {
  if (subjectId && !(await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true } }))) {
    throw ApiError.badRequest('That subject no longer exists');
  }
}

export async function createArModel(meta: ArMetadata, fileName: string, upload: Buffer) {
  const { ext, mimeType, data } = await prepareModelFile(fileName, upload);
  await checkSubject(meta.subjectId);
  const storedName = await storeFile(ext, data);
  try {
    return await prisma.arModel.create({
      data: { ...meta, fileName, storedName, mimeType, sizeBytes: data.length },
      include: withCounts,
    });
  } catch (err) {
    await removeFile(storedName);
    throw err;
  }
}

async function findOrThrow(id: string) {
  const model = await prisma.arModel.findUnique({ where: { id }, include: withCounts });
  if (!model) throw ApiError.notFound('AR model not found');
  return model;
}

export const getArModel = findOrThrow;

export async function updateArModel(id: string, meta: Partial<ArMetadata>) {
  await findOrThrow(id);
  await checkSubject(meta.subjectId);
  return prisma.arModel.update({ where: { id }, data: meta, include: withCounts });
}

export async function saveHotspots(id: string, hotspots: Hotspot[]) {
  await findOrThrow(id);
  return prisma.arModel.update({ where: { id }, data: { hotspots }, include: withCounts });
}

export async function replaceArFile(id: string, fileName: string, upload: Buffer) {
  const existing = await findOrThrow(id);
  const { ext, mimeType, data } = await prepareModelFile(fileName, upload);
  const storedName = await storeFile(ext, data);
  const updated = await prisma.arModel.update({
    where: { id },
    data: { fileName, storedName, mimeType, sizeBytes: data.length },
    include: withCounts,
  });
  await removeFile(existing.storedName);
  return updated;
}

// Re-runs the upload conversion on a stored file (scripts/convertArModels.ts, for models uploaded before it existed).
export async function reconvertStoredModel(id: string) {
  const existing = await findOrThrow(id);
  const current = await storage.read('ar', existing.storedName);
  const { ext, mimeType, data } = await prepareModelFile(existing.storedName, current);
  const storedName = await storeFile(ext, data);
  await prisma.arModel.update({ where: { id }, data: { storedName, mimeType, sizeBytes: data.length } });
  await removeFile(existing.storedName);
  return { before: current.length, after: data.length };
}

export async function deleteArModel(id: string) {
  const existing = await findOrThrow(id);
  await removeTriggerFilesFor(id); // trigger rows cascade with the model; their files don't
  await prisma.arModel.delete({ where: { id } }); // lessons are unlinked (onDelete: SetNull)
  await removeFile(existing.storedName);
}

export async function listArModels({
  page,
  pageSize,
  search,
  subjectId,
}: {
  page: number;
  pageSize: number;
  search?: string;
  subjectId?: string;
}) {
  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.ArModelWhereInput = {
    ...(subjectId && { subjectId }),
    ...(search && { OR: [{ name: contains }, { description: contains }, { fileName: contains }] }),
  };
  const [models, total] = await prisma.$transaction([
    prisma.arModel.findMany({ where, include: withCounts, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.arModel.count({ where }),
  ]);
  return { models: models.map(serializeArModel), total };
}

// The stored file's name and type, for the download route.
export async function fileForDownload(id: string) {
  const model = await prisma.arModel.findUnique({ where: { id }, select: { storedName: true, mimeType: true, fileName: true } });
  if (!model) throw ApiError.notFound('AR model not found');
  return model;
}

async function studentSubjectIds(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({ where: { studentId }, select: { class: { select: { subjectId: true } } } });
  return [...new Set(enrollments.map((e) => e.class.subjectId).filter((id): id is string => Boolean(id)))];
}

// Models a student can open: those attached to lessons in their classes' subjects, plus models filed under those subjects.
const openableBy = (subjectIds: string[]): Prisma.ArModelWhereInput => ({
  OR: [{ subjectId: { in: subjectIds } }, { lessons: { some: { chapter: { module: { subjectId: { in: subjectIds } } } } } }],
});

// One model for the student AR viewer (with its points of interest). Any model can be opened by id: students get
// ids from their lessons and library (scoped below) or by scanning a printed AR card, which is the key to that model.
export async function getForStudent(id: string) {
  const model = await prisma.arModel.findUnique({ where: { id }, include: withCounts });
  if (!model) throw ApiError.notFound('AR model not found');
  return serializeArModel(model);
}

export async function listForStudent(studentId: string) {
  const subjectIds = await studentSubjectIds(studentId);
  if (subjectIds.length === 0) return [];
  const models = await prisma.arModel.findMany({
    where: openableBy(subjectIds),
    include: {
      ...withCounts,
      lessons: {
        where: { chapter: { module: { subjectId: { in: subjectIds } } } },
        select: { title: true, chapter: { select: { module: { select: { subject: { select: { code: true } } } } } } },
      },
    },
    orderBy: { name: 'asc' },
  });
  return models.map(({ lessons, ...m }) => ({
    ...serializeArModel(m),
    usedIn: lessons.map((l) => `${l.chapter.module.subject.code} · ${l.title}`),
  }));
}
