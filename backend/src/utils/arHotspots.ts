import { z } from 'zod';

// Points of interest an admin pins on an AR model; students tap them in the 3D view and in AR to read the text.
// Positions/normals are in the model's own glTF coordinates (what <model-viewer>'s positionAndNormalFromPoint
// returns), so every viewer that draws the unmodified model can place them.

export const MAX_HOTSPOTS = 30;

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

export const hotspotSchema = z.object({
  id: z.string().trim().min(1).max(64),
  position: vec3,
  normal: vec3,
  title: z.string().trim().min(1, 'Every point needs a title').max(80, 'Point titles must be 80 characters or fewer'),
  description: z.string().trim().max(1000, 'Point descriptions must be 1000 characters or fewer').default(''),
});

export const hotspotsInputSchema = z.object({
  hotspots: z
    .array(hotspotSchema)
    .max(MAX_HOTSPOTS, `A model can have at most ${MAX_HOTSPOTS} points`)
    .refine((list) => new Set(list.map((h) => h.id)).size === list.length, 'Point ids must be unique'),
});

export type Hotspot = z.infer<typeof hotspotSchema>;

// Reads the stored JSON defensively (anything malformed is dropped rather than breaking the viewer).
export function presentHotspots(value: unknown): Hotspot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((h) => {
    const parsed = hotspotSchema.safeParse(h);
    return parsed.success ? [parsed.data] : [];
  });
}
