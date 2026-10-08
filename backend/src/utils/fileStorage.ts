import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from './ApiError';

// Where uploaded files live. Every file is addressed by (folder, name), where `name` is the random stored name kept in
// the database, so switching drivers needs no database change: scripts/migrateUploadsToCloudinary.ts just copies the
// files across under the same names. The local driver is for development; production hosts have throwaway disks,
// so they use Cloudinary.

export type StorageFolder = 'ar' | 'ar-triggers' | 'images';

export interface FileStorage {
  save(folder: StorageFolder, name: string, data: Buffer): Promise<void>;
  // Throws ApiError.notFound when the file is missing.
  read(folder: StorageFolder, name: string): Promise<Buffer>;
  // A file that is already gone is not an error.
  remove(folder: StorageFolder, name: string): Promise<void>;
  // Streams the file as the response body. The caller sets Content-Type and the other headers first.
  send(res: Response, folder: StorageFolder, name: string, missingMessage: string): Promise<void>;
}

// ---------- Local disk ----------

export function createLocalStorage(root: string): FileStorage {
  // path.basename guards against anything but a plain file name reaching the file system.
  const locate = (folder: StorageFolder, name: string) => path.join(root, folder, path.basename(name));
  return {
    async save(folder, name, data) {
      await mkdir(path.join(root, folder), { recursive: true });
      await writeFile(locate(folder, name), data);
    },
    async read(folder, name) {
      try {
        return await readFile(locate(folder, name));
      } catch {
        throw ApiError.notFound('File not found');
      }
    },
    async remove(folder, name) {
      await rm(locate(folder, name), { force: true });
    },
    send(res, folder, name, missingMessage) {
      return new Promise<void>((resolve, reject) => {
        res.sendFile(locate(folder, name), (err) => {
          if (!err) resolve();
          else if (res.headersSent) resolve();
          else reject(ApiError.notFound(missingMessage));
        });
      });
    },
  };
}

// ---------- Cloudinary ----------

// Cloudinary's public id for a file, e.g. cogniview/ar/<uuid>.glb. Files go up as "raw" resources, which are stored
// untouched (no image processing) and keep their extension in the id.
export function cloudinaryPublicId(prefix: string, folder: StorageFolder, name: string) {
  return [prefix, folder, path.basename(name)].filter(Boolean).join('/');
}

// Credentials come from the CLOUDINARY_URL environment variable (cloudinary://<key>:<secret>@<cloud name>), which the
// SDK reads by itself.
export function createCloudinaryStorage(prefix: string): FileStorage {
  const idFor = (folder: StorageFolder, name: string) => cloudinaryPublicId(prefix, folder, name);
  const urlFor = (folder: StorageFolder, name: string) => cloudinary.url(idFor(folder, name), { resource_type: 'raw', secure: true });
  const fetchFile = async (folder: StorageFolder, name: string, missingMessage: string) => {
    const response = await fetch(urlFor(folder, name));
    if (response.status === 404 || !response.body) throw ApiError.notFound(missingMessage);
    if (!response.ok) throw new Error(`Cloudinary download failed (${response.status})`);
    return response;
  };

  return {
    save(folder, name, data) {
      return new Promise<void>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { resource_type: 'raw', public_id: idFor(folder, name), unique_filename: false, overwrite: true, invalidate: true },
            (err, result) => {
              if (err || !result) reject(new ApiError(502, `File storage rejected the upload${err?.message ? `: ${err.message}` : ''}`));
              else resolve();
            },
          )
          .end(data);
      });
    },
    async read(folder, name) {
      const response = await fetchFile(folder, name, 'File not found');
      return Buffer.from(await response.arrayBuffer());
    },
    async remove(folder, name) {
      // "not found" just means it is already gone.
      await cloudinary.uploader.destroy(idFor(folder, name), { resource_type: 'raw', invalidate: true });
    },
    async send(res, folder, name, missingMessage) {
      const response = await fetchFile(folder, name, missingMessage);
      const length = response.headers.get('content-length');
      if (length) res.setHeader('Content-Length', length);
      await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), res);
    },
  };
}
