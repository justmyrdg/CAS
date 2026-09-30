import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import * as arService from '../services/arModels.service';
import { hotspotsInputSchema } from '../utils/arHotspots';

export { hotspotsInputSchema };

// Uploads arrive as the raw request body (express.raw on these routes); the
// original file name and metadata come in the query string, so no multipart parser is needed.

const blankToNull = (value: string | undefined) => (value === undefined ? undefined : value.trim() === '' ? null : value.trim());

const uploadQuery = z.object({
  fileName: z.string().trim().min(1, 'Missing file name').max(200),
  name: z.string().trim().min(1, 'Give the model a name').max(120),
  description: z.string().max(1000).optional(),
  subjectId: z.string().optional(),
});

export const updateArSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the model a name').max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    subjectId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(100).optional(),
  subjectId: z.string().uuid().optional(),
});

function body(req: Request): Buffer {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw ApiError.badRequest('Choose a model file to upload');
  return req.body;
}

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw ApiError.badRequest('Validation failed', parsed.error.flatten().fieldErrors);
  return parsed.data;
}

const param = (req: Request) => req.params.id as string;

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parse(listQuery, req.query);
  res.json({ ...(await arService.listArModels(query)), page: query.page, pageSize: query.pageSize });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  res.json({ model: arService.serializeArModel(await arService.getArModel(param(req))) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const q = parse(uploadQuery, req.query);
  const model = await arService.createArModel(
    { name: q.name, description: blankToNull(q.description), subjectId: blankToNull(q.subjectId) },
    q.fileName,
    body(req),
  );
  res.status(201).json({ model: arService.serializeArModel(model) });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const model = await arService.updateArModel(param(req), req.body as z.infer<typeof updateArSchema>);
  res.json({ model: arService.serializeArModel(model) });
});

export const replaceFile = asyncHandler(async (req: Request, res: Response) => {
  const { fileName } = parse(z.object({ fileName: uploadQuery.shape.fileName }), req.query);
  const model = await arService.replaceArFile(param(req), fileName, body(req));
  res.json({ model: arService.serializeArModel(model) });
});

export const saveHotspots = asyncHandler(async (req: Request, res: Response) => {
  const { hotspots } = req.body as z.infer<typeof hotspotsInputSchema>;
  res.json({ model: arService.serializeArModel(await arService.saveHotspots(param(req), hotspots)) });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await arService.deleteArModel(param(req));
  res.status(204).send();
});

// Public download (ids are unguessable UUIDs); served without auth because the
// 3D viewer loads it by URL and can't attach a bearer token.
export const download = asyncHandler(async (req: Request, res: Response) => {
  const { filePath, mimeType, fileName } = await arService.fileForDownload(param(req));
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // Stored files are always converted .glb, whatever was uploaded (e.g. a .zip).
  const servedName = mimeType === 'model/gltf-binary' ? fileName.replace(/\.[^.]+$/, '') + '.glb' : fileName;
  res.setHeader('Content-Disposition', `inline; filename="${servedName.replace(/"/g, '')}"`);
  res.type(mimeType).sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Model file is missing' });
  });
});
