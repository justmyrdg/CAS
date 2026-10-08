import { createHash, randomUUID } from 'crypto';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { decode, encode } from '@msgpack/msgpack';
import { prisma } from '../config/prisma';
import { storage } from '../config/storage';
import { ApiError } from '../utils/ApiError';
import { detectImageType } from './lessonImages.service';

// Trigger pictures: images that make the student AR camera show a model (the brain diagram in a lesson, a poster…).
// The admin's browser compiles each one with MindAR's compiler; we store the image and its tracking data, and merge
// every picture's data with the shared printed marker into the single target file the AR page loads.

// The pictures and their tracking data are kept by the file storage (config/storage). The shared printed marker is a
// static file shipped with the code.
const MARKER_TARGET = path.resolve(__dirname, '../../assets/ar-marker/marker.mind');
export const MAX_TRIGGERS_PER_MODEL = 10;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_TARGET_BYTES = 4 * 1024 * 1024;

interface MindFile {
  v: number;
  dataList: { targetImage: { width: number; height: number } }[];
}

function parseMind(data: Buffer): MindFile {
  try {
    const mind = decode(data) as MindFile;
    if (typeof mind.v !== 'number' || !Array.isArray(mind.dataList) || mind.dataList.length !== 1 || !mind.dataList[0].targetImage) throw new Error();
    return mind;
  } catch {
    throw ApiError.badRequest("The picture's tracking data is invalid — try adding it again");
  }
}

const imageUrl = (id: string) => `/api/ar-triggers/${id}/image`;

export async function listTriggers(arModelId: string) {
  const triggers = await prisma.arTrigger.findMany({ where: { arModelId }, orderBy: { createdAt: 'asc' } });
  return triggers.map((t) => ({ id: t.id, width: t.width, height: t.height, createdAt: t.createdAt, imageUrl: imageUrl(t.id) }));
}

export async function addTrigger(arModelId: string, image: Buffer, target: Buffer) {
  if (!(await prisma.arModel.findUnique({ where: { id: arModelId }, select: { id: true } }))) throw ApiError.notFound('AR model not found');
  if ((await prisma.arTrigger.count({ where: { arModelId } })) >= MAX_TRIGGERS_PER_MODEL) {
    throw ApiError.badRequest(`A model can have at most ${MAX_TRIGGERS_PER_MODEL} trigger pictures`);
  }
  if (image.length === 0 || image.length > MAX_IMAGE_BYTES) throw ApiError.badRequest('Pictures must be 3 MB or smaller');
  const type = detectImageType(image);
  if (!type) throw ApiError.badRequest('Upload a JPG, PNG or WebP picture');
  if (target.length === 0 || target.length > MAX_TARGET_BYTES) throw ApiError.badRequest("The picture's tracking data is too large");
  const mind = parseMind(target);
  const { width, height } = mind.dataList[0].targetImage;

  const base = randomUUID();
  const imageName = `${base}${type.ext}`; // ext includes the dot
  const targetName = `${base}.mind`;
  await Promise.all([storage.save('ar-triggers', imageName, image), storage.save('ar-triggers', targetName, target)]);
  try {
    const created = await prisma.arTrigger.create({ data: { arModelId, imageName, targetName, width, height } });
    targetsCache = null;
    return { id: created.id, width, height, createdAt: created.createdAt, imageUrl: imageUrl(created.id) };
  } catch (err) {
    await removeFiles({ imageName, targetName });
    throw err;
  }
}

async function removeFiles(t: { imageName: string; targetName: string }) {
  await Promise.all([t.imageName, t.targetName].map((name) => storage.remove('ar-triggers', name)));
}

export async function deleteTrigger(arModelId: string, triggerId: string) {
  const trigger = await prisma.arTrigger.findFirst({ where: { id: triggerId, arModelId } });
  if (!trigger) throw ApiError.notFound('Trigger picture not found');
  await prisma.arTrigger.delete({ where: { id: trigger.id } });
  await removeFiles(trigger);
  targetsCache = null;
}

// Called before a model is deleted (its rows cascade; this removes the files).
export async function removeTriggerFilesFor(arModelId: string) {
  const triggers = await prisma.arTrigger.findMany({ where: { arModelId }, select: { imageName: true, targetName: true } });
  await Promise.all(triggers.map(removeFiles));
  targetsCache = null;
}

export async function triggerImageName(id: string) {
  const trigger = await prisma.arTrigger.findUnique({ where: { id }, select: { imageName: true } });
  if (!trigger) throw ApiError.notFound('Trigger picture not found');
  return trigger.imageName;
}

// ---------- The AR page's targets: marker first, then every trigger picture ----------

interface Targets {
  version: string;
  mind: Buffer;
  // Index = MindAR target index. null = the shared printed marker (shows whatever model is open); otherwise the model id.
  models: (string | null)[];
}
let targetsCache: Targets | null = null;

export async function getTargets(): Promise<Targets> {
  const triggers = await prisma.arTrigger.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, targetName: true, arModelId: true } });
  const markerStat = await stat(MARKER_TARGET);
  const version = createHash('sha1')
    .update(`${markerStat.mtimeMs}:${triggers.map((t) => t.id).join(',')}`)
    .digest('hex')
    .slice(0, 12);
  if (targetsCache?.version === version) return targetsCache;

  const marker = decode(await readFile(MARKER_TARGET)) as MindFile;
  const dataList = [...marker.dataList];
  const models: (string | null)[] = marker.dataList.map(() => null);
  for (const t of triggers) {
    try {
      const mind = decode(await storage.read('ar-triggers', t.targetName)) as MindFile;
      dataList.push(...mind.dataList);
      models.push(...mind.dataList.map(() => t.arModelId));
    } catch {
      // A missing/corrupt file just leaves that picture out.
    }
  }
  targetsCache = { version, mind: Buffer.from(encode({ v: marker.v, dataList })), models };
  return targetsCache;
}
