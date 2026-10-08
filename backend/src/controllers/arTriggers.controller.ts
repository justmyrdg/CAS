import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import * as service from '../services/arTriggers.service';
import { storage } from '../config/storage';

// Trigger pictures for AR models. Admin routes live under /api/admin/ar-models/:id/triggers; the AR page's combined
// target file, its model list and the picture thumbnails are public (fetched by the WebView / <img> without a token).

// Picture and its MindAR tracking data, both base64 (compiled in the admin's browser).
export const addTriggerSchema = z.object({
  image: z.string().min(1).max(5_000_000),
  target: z.string().min(1).max(6_000_000),
});

const p = (req: Request, name: string) => req.params[name] as string;

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ triggers: await service.listTriggers(p(req, 'id')), max: service.MAX_TRIGGERS_PER_MODEL });
});

export const add = asyncHandler(async (req: Request, res: Response) => {
  const { image, target } = req.body as z.infer<typeof addTriggerSchema>;
  const trigger = await service.addTrigger(p(req, 'id'), Buffer.from(image, 'base64'), Buffer.from(target, 'base64'));
  res.status(201).json({ trigger });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteTrigger(p(req, 'id'), p(req, 'triggerId'));
  res.status(204).send();
});

// ---- public ----

export const targetsIndex = asyncHandler(async (_req: Request, res: Response) => {
  const { version, models } = await service.getTargets();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ version, models, mindUrl: `/api/ar-targets/targets.mind?v=${version}` });
});

export const targetsFile = asyncHandler(async (_req: Request, res: Response) => {
  const { mind } = await service.getTargets();
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // The URL carries the version, so a changed set of pictures is a new URL.
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('application/octet-stream').send(mind);
});

export const image = asyncHandler(async (req: Request, res: Response) => {
  const imageName = await service.triggerImageName(p(req, 'id'));
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  await storage.send(res, 'ar-triggers', imageName, 'Picture file is missing');
});
