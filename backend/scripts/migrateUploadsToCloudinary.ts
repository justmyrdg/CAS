import 'dotenv/config';
import path from 'path';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { createCloudinaryStorage, createLocalStorage } from '../src/utils/fileStorage';
import type { StorageFolder } from '../src/utils/fileStorage';

// Copies the files in backend/uploads/ to Cloudinary, under the same names the database already holds, so no database
// change is needed. Run it once before switching STORAGE_DRIVER to cloudinary (it needs CLOUDINARY_URL in .env).
// Safe to run more than once: a file that is already there is simply replaced with the same bytes.
//
//   npm run storage:migrate            copy everything
//   npm run storage:migrate -- --dry   only list what would be copied

async function main() {
  const dry = process.argv.includes('--dry');
  if (!dry && !env.CLOUDINARY_URL?.startsWith('cloudinary://')) {
    throw new Error('Set CLOUDINARY_URL (cloudinary://key:secret@cloud) in backend/.env first.');
  }
  const local = createLocalStorage(path.resolve(__dirname, '../uploads'));
  const cloud = createCloudinaryStorage(env.CLOUDINARY_FOLDER);

  const [models, triggers, images] = await Promise.all([
    prisma.arModel.findMany({ select: { storedName: true } }),
    prisma.arTrigger.findMany({ select: { imageName: true, targetName: true } }),
    prisma.lessonImage.findMany({ select: { storedName: true } }),
  ]);
  const files: { folder: StorageFolder; name: string }[] = [
    ...models.map((m) => ({ folder: 'ar' as const, name: m.storedName })),
    ...triggers.flatMap((t) => [
      { folder: 'ar-triggers' as const, name: t.imageName },
      { folder: 'ar-triggers' as const, name: t.targetName },
    ]),
    ...images.map((i) => ({ folder: 'images' as const, name: i.storedName })),
  ];

  let copied = 0;
  let missing = 0;
  let failed = 0;
  for (const { folder, name } of files) {
    const label = `${folder}/${name}`;
    let data: Buffer;
    try {
      data = await local.read(folder, name);
    } catch {
      missing += 1;
      console.warn(`- ${label}: not in backend/uploads (skipped)`);
      continue;
    }
    if (dry) {
      copied += 1;
      console.log(`• ${label} (${(data.length / 1024).toFixed(0)} KB)`);
      continue;
    }
    try {
      await cloud.save(folder, name, data);
      copied += 1;
      console.log(`✓ ${label} (${(data.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${label}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n${dry ? 'Would copy' : 'Copied'} ${copied} of ${files.length} files; ${missing} missing locally, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
