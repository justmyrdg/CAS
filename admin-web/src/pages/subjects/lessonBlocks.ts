import { API_BASE_URL } from '../../lib/apiClient';
import { cleanChoices } from './subjectsData';

// A lesson's content blocks: the shape the API returns, the editor's draft shape, and what save sends.

export type ApiBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; imageId: string; url: string; caption?: string }
  | { type: 'video'; youtubeId: string; caption?: string }
  | { type: 'check'; prompt: string; choices: string[]; correctChoice: number; explanation?: string };

export type BlockType = ApiBlock['type'];

// `key` is local-only so React can track cards while they're added/removed/reordered.
export type BlockDraft =
  | { key: number; type: 'heading'; text: string }
  | { key: number; type: 'text'; text: string }
  | { key: number; type: 'image'; imageId: string | null; url: string | null; caption: string }
  | { key: number; type: 'video'; url: string; caption: string }
  | { key: number; type: 'check'; prompt: string; choices: string[]; correctChoice: number; explanation: string };

export type DraftOf<T extends BlockType> = Extract<BlockDraft, { type: T }>;

export type BlockPayload =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; imageId: string; caption?: string }
  | { type: 'video'; url: string; caption?: string }
  | { type: 'check'; prompt: string; choices: string[]; correctChoice: number; explanation?: string };

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading',
  text: 'Text',
  image: 'Image',
  video: 'Video',
  check: 'Check your understanding',
};

export const MAX_BLOCKS = 100;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const absoluteUrl = (path: string) => `${API_BASE_URL}${path}`;
export const youtubeThumbnail = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

// Same rules as the backend's parseYoutubeId (backend/src/utils/lessonBlocks.ts) — keep them in sync.
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
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export function emptyBlock(type: BlockType, key: number): BlockDraft {
  switch (type) {
    case 'heading':
      return { key, type: 'heading', text: '' };
    case 'text':
      return { key, type: 'text', text: '' };
    case 'image':
      return { key, type: 'image', imageId: null, url: null, caption: '' };
    case 'video':
      return { key, type: 'video', url: '', caption: '' };
    case 'check':
      return { key, type: 'check', prompt: '', choices: ['', '', '', ''], correctChoice: 0, explanation: '' };
  }
}

export function draftFromApi(block: ApiBlock, key: number): BlockDraft {
  switch (block.type) {
    case 'heading':
      return { key, type: 'heading', text: block.text };
    case 'text':
      return { key, type: 'text', text: block.text };
    case 'image':
      return { key, type: 'image', imageId: block.imageId, url: absoluteUrl(block.url), caption: block.caption ?? '' };
    case 'video':
      return { key, type: 'video', url: `https://youtu.be/${block.youtubeId}`, caption: block.caption ?? '' };
    case 'check':
      return {
        key,
        type: 'check',
        prompt: block.prompt,
        choices: [...block.choices],
        correctChoice: block.correctChoice,
        explanation: block.explanation ?? '',
      };
  }
}

const optional = (value: string) => (value.trim() ? value.trim() : undefined);

// Mirrors the server's rules so most mistakes are caught before saving; returns a message or the payload.
export function prepareBlocks(drafts: BlockDraft[]): string | BlockPayload[] {
  if (drafts.length > MAX_BLOCKS) return `A lesson can have at most ${MAX_BLOCKS} blocks.`;
  const out: BlockPayload[] = [];
  for (const [i, b] of drafts.entries()) {
    const prepared = prepareBlock(b, `Block ${i + 1}`);
    if (typeof prepared === 'string') return prepared;
    out.push(prepared);
  }
  return out;
}

// One block's payload, or what's wrong with it (prefixed with `label`). The preview uses it to flag incomplete blocks.
export function prepareBlock(b: BlockDraft, label: string): string | BlockPayload {
  switch (b.type) {
    case 'heading':
      if (!b.text.trim()) return `${label}: write the heading or remove the block.`;
      return { type: 'heading', text: b.text.trim() };
    case 'text':
      if (!b.text.trim()) return `${label}: write some text or remove the block.`;
      return { type: 'text', text: b.text.trim() };
    case 'image':
      if (!b.imageId) return `${label}: upload an image or remove the block.`;
      return { type: 'image', imageId: b.imageId, caption: optional(b.caption) };
    case 'video':
      if (!b.url.trim()) return `${label}: add a YouTube link.`;
      if (!parseYoutubeId(b.url)) return `${label}: that is not a YouTube link.`;
      return { type: 'video', url: b.url.trim(), caption: optional(b.caption) };
    case 'check': {
      if (!b.prompt.trim()) return `${label}: the check needs a question.`;
      const cleaned = cleanChoices(b.choices, b.correctChoice);
      if (typeof cleaned === 'string') return `${label}: ${cleaned}.`;
      return { type: 'check', prompt: b.prompt.trim(), ...cleaned, explanation: optional(b.explanation) };
    }
  }
}
