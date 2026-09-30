import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { imageFileUrl, imageIdsIn } from '../utils/lessonBlocks';

// Images for lesson image blocks live on disk in backend/uploads/images (same path from src/ under tsx
// and from dist/ when built), with metadata in lesson_images. Lessons reference them by id in their blocks.
export const IMAGE_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/images');
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Identifies the image format from the file's first bytes.
export function detectImageType(data: Buffer): { ext: string; mimeType: string } | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(PNG_SIGNATURE)) return { ext: '.png', mimeType: 'image/png' };
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { ext: '.jpg', mimeType: 'image/jpeg' };
  const head = data.subarray(0, 12).toString('latin1');
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a')) return { ext: '.gif', mimeType: 'image/gif' };
  if (data.length >= 12 && head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return { ext: '.webp', mimeType: 'image/webp' };
  return null;
}

// Checks the extension and the actual contents, so a renamed file of another type is rejected.
// The stored type comes from the contents (a PNG named photo.jpg is kept as a PNG).
export function validateImageFile(fileName: string, data: Buffer) {
  if (!ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
    throw ApiError.badRequest('Upload a PNG, JPEG, WebP or GIF image');
  }
  if (data.length === 0) throw ApiError.badRequest('The file is empty');
  if (data.length > MAX_IMAGE_BYTES) throw ApiError.badRequest('Images must be 5 MB or smaller');
  const type = detectImageType(data);
  if (!type) throw ApiError.badRequest('That file is not a valid image');
  return type;
}

async function removeFile(storedName: string) {
  // path.basename guards against anything but a plain file name reaching rm().
  await rm(path.join(IMAGE_UPLOAD_DIR, path.basename(storedName)), { force: true });
}

// Runs a post-commit cleanup step without letting it fail a request whose DB change already
// went through — a leaked image/file is a minor cost; a 500 after a successful save is not.
export async function cleanupQuietly(work: Promise<unknown>) {
  try {
    await work;
  } catch (err) {
    console.error('Image cleanup failed', err);
  }
}

export async function createImage(fileName: string, data: Buffer) {
  const { ext, mimeType } = validateImageFile(fileName, data);
  await mkdir(IMAGE_UPLOAD_DIR, { recursive: true });
  const storedName = `${randomUUID()}${ext}`;
  await writeFile(path.join(IMAGE_UPLOAD_DIR, storedName), data);
  try {
    const image = await prisma.lessonImage.create({ data: { fileName, storedName, mimeType, sizeBytes: data.length } });
    return { id: image.id, url: imageFileUrl(image.id) };
  } catch (err) {
    await removeFile(storedName);
    throw err;
  }
}

export async function assertImagesExist(ids: string[]) {
  if (ids.length === 0) return;
  const found = await prisma.lessonImage.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw ApiError.badRequest('An image in this lesson no longer exists — upload it again');
}

// Deletes each image (row + file) that no lesson's blocks reference any more.
// deleteMany is used (rather than delete-by-id) so two concurrent prunes of the same
// image race harmlessly instead of one of them throwing a "record not found" error.
export async function pruneImages(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  const images = await prisma.lessonImage.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, storedName: true } });
  if (images.length === 0) return;
  const { count } = await prisma.lessonImage.deleteMany({ where: { id: { in: images.map((i) => i.id) } } });
  // Only remove files for rows this call actually deleted (a concurrent prune may have won the race).
  if (count > 0) await Promise.all(images.map((image) => removeFile(image.storedName)));
}

// Pure step: which of these candidate image ids are not referenced by any lesson's blocks.
export function unreferencedImageIds(candidateIds: string[], lessonBlocks: unknown[]): string[] {
  const referenced = new Set<string>();
  for (const blocks of lessonBlocks) {
    for (const id of imageIdsIn(blocks)) referenced.add(id);
  }
  return candidateIds.filter((id) => !referenced.has(id));
}

// Catches images orphaned by cascades (deleting a chapter/module/subject) or a lesson save that
// dropped them. Candidates older than an hour so an image an admin just uploaded, but hasn't saved
// yet, stays safe. Loads every lesson's blocks once and diffs in memory rather than one query per image.
export async function pruneOrphanImages() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const [candidates, lessons] = await Promise.all([
    prisma.lessonImage.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true } }),
    prisma.contentItem.findMany({ where: { type: 'LESSON' }, select: { blocks: true } }),
  ]);
  if (candidates.length === 0) return;
  const unreferenced = unreferencedImageIds(
    candidates.map((c) => c.id),
    lessons.map((l) => l.blocks),
  );
  await pruneImages(unreferenced);
}

export async function fileForDownload(id: string) {
  const image = await prisma.lessonImage.findUnique({ where: { id }, select: { storedName: true, mimeType: true } });
  if (!image) throw ApiError.notFound('Image not found');
  return { filePath: path.join(IMAGE_UPLOAD_DIR, path.basename(image.storedName)), mimeType: image.mimeType };
}
