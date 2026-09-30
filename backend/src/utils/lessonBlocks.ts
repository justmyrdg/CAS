import { z } from 'zod';

// A lesson's content: an ordered list of typed blocks, stored as JSON on content_items.blocks.
// Admins send video blocks as a pasted link ({ type: 'video', url }); we store only the YouTube id.

export const MAX_BLOCKS = 100;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtube-nocookie.com']);

// Pulls the video id out of any common YouTube link (watch, youtu.be, embed, shorts, live) or a bare id.
export function parseYoutubeId(input: string): string | null {
  const value = input.trim();
  if (YOUTUBE_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

const caption = z.string().trim().max(300, 'Captions can be at most 300 characters').optional();

const headingBlock = z.object({
  type: z.literal('heading'),
  text: z.string().trim().min(1, 'Headings cannot be empty').max(200, 'Headings can be at most 200 characters'),
});

const textBlock = z.object({
  type: z.literal('text'),
  text: z.string().trim().min(1, 'Text blocks cannot be empty').max(20_000, 'Text blocks can be at most 20,000 characters'),
});

const imageBlock = z.object({
  type: z.literal('image'),
  imageId: z.string().uuid('Upload an image'),
  caption,
});

const videoInputBlock = z.object({
  type: z.literal('video'),
  url: z
    .string()
    .trim()
    .min(1, 'Add a YouTube link')
    .max(500)
    .refine((url) => parseYoutubeId(url) !== null, 'Not a YouTube link'),
  caption,
});

const checkBlock = z.object({
  type: z.literal('check'),
  prompt: z.string().trim().min(1, 'Every check needs a question').max(1000),
  choices: z
    .array(z.string().trim().min(1, 'Choices cannot be blank').max(300))
    .min(2, 'A check needs at least 2 choices')
    .max(6, 'A check can have at most 6 choices'),
  correctChoice: z.number().int().min(0),
  explanation: z.string().trim().max(1000, 'Explanations can be at most 1,000 characters').optional(),
});

export const lessonBlocksInputSchema = z
  .array(z.discriminatedUnion('type', [headingBlock, textBlock, imageBlock, videoInputBlock, checkBlock]))
  .max(MAX_BLOCKS, `A lesson can have at most ${MAX_BLOCKS} blocks`)
  .superRefine((blocks, ctx) => {
    blocks.forEach((block, index) => {
      if (block.type === 'check' && block.correctChoice >= block.choices.length) {
        ctx.addIssue({ code: 'custom', message: 'Pick the correct choice', path: [index, 'correctChoice'] });
      }
    });
  });

export type LessonBlockInput = z.infer<typeof lessonBlocksInputSchema>[number];

export type LessonBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; imageId: string; caption?: string }
  | { type: 'video'; youtubeId: string; caption?: string }
  | { type: 'check'; prompt: string; choices: string[]; correctChoice: number; explanation?: string };

export type PresentedBlock = Exclude<LessonBlock, { type: 'image' }> | (Extract<LessonBlock, { type: 'image' }> & { url: string });

const optional = (value: string | undefined) => (value ? value : undefined);

// Input → what gets stored: video links become ids, blank optional fields are left out.
export function toStoredBlocks(input: LessonBlockInput[]): LessonBlock[] {
  return input.map((block): LessonBlock => {
    switch (block.type) {
      case 'heading':
      case 'text':
        return { type: block.type, text: block.text };
      case 'image': {
        const c = optional(block.caption);
        return { type: 'image', imageId: block.imageId, ...(c && { caption: c }) };
      }
      case 'video': {
        const c = optional(block.caption);
        return { type: 'video', youtubeId: parseYoutubeId(block.url)!, ...(c && { caption: c }) };
      }
      case 'check': {
        const e = optional(block.explanation);
        return { type: 'check', prompt: block.prompt, choices: block.choices, correctChoice: block.correctChoice, ...(e && { explanation: e }) };
      }
    }
  });
}

export const imageFileUrl = (id: string) => `/api/images/${id}/file`;

// Stored JSON is only ever written through lessonBlocksInputSchema, so it is trusted here.
function readBlocks(json: unknown): LessonBlock[] {
  return Array.isArray(json) ? (json as LessonBlock[]) : [];
}

// What the API returns: image blocks gain the URL of their file.
export function presentBlocks(json: unknown): PresentedBlock[] {
  return readBlocks(json).map((block) => (block.type === 'image' ? { ...block, url: imageFileUrl(block.imageId) } : block));
}

export function imageIdsIn(json: unknown): string[] {
  const ids = readBlocks(json).flatMap((block) => (block.type === 'image' ? [block.imageId] : []));
  return [...new Set(ids)];
}

// One readable message for the first problem, naming the block ("Block 4: Not a YouTube link").
export function formatValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Validation failed';
  const at = issue.path.indexOf('blocks');
  const index = at >= 0 ? issue.path[at + 1] : undefined;
  return typeof index === 'number' ? `Block ${index + 1}: ${issue.message}` : issue.message;
}
