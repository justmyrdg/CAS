import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import * as imagesService from '../services/lessonImages.service';

// Uploads arrive as the raw request body (express.raw on the route); the original
// file name comes in the query string, exactly like AR model uploads.
const uploadQuery = z.object({ fileName: z.string().trim().min(1, 'Missing file name').max(200) });

export const upload = asyncHandler(async (req: Request, res: Response) => {
  const parsed = uploadQuery.safeParse(req.query);
  if (!parsed.success) throw ApiError.badRequest('Validation failed', parsed.error.flatten().fieldErrors);
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw ApiError.badRequest('Choose an image to upload');
  res.status(201).json({ image: await imagesService.createImage(parsed.data.fileName, req.body) });
});

// Public (ids are unguessable UUIDs): <img> tags and the phone load it by URL without a bearer token.
export const download = asyncHandler(async (req: Request, res: Response) => {
  const { filePath, mimeType } = await imagesService.fileForDownload(req.params.id as string);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.type(mimeType).sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Image file is missing' });
  });
});
