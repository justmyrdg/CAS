import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  MAX_BLOCKS,
  formatValidationError,
  imageIdsIn,
  lessonBlocksInputSchema,
  parseYoutubeId,
  presentBlocks,
  toStoredBlocks,
} from '../src/utils/lessonBlocks';

const ID = 'dQw4w9WgXcQ';
const IMG = '3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192';

test('parseYoutubeId accepts the link formats people paste', () => {
  for (const link of [
    ID,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}&list=PL123`,
    `youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abcDEF123`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `  https://youtu.be/${ID}  `,
  ]) {
    assert.equal(parseYoutubeId(link), ID, link);
  }
});

test('parseYoutubeId rejects non-YouTube and malformed links', () => {
  for (const link of [
    '',
    'hello',
    `https://notyoutube.com/watch?v=${ID}`,
    `https://youtube.com.evil.io/watch?v=${ID}`,
    `https://vimeo.com/${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/',
    `https://youtu.be/${ID}extra`,
  ]) {
    assert.equal(parseYoutubeId(link), null, link);
  }
});

const valid = [
  { type: 'heading', text: 'The OSI model' },
  { type: 'text', text: 'Seven layers.\n\nEach talks to its peer.' },
  { type: 'image', imageId: IMG, caption: 'Layers' },
  { type: 'video', url: `https://youtu.be/${ID}` },
  { type: 'check', prompt: 'Which layer routes?', choices: ['Data link', 'Network'], correctChoice: 1, explanation: 'Layer 3.' },
];

test('valid blocks parse and store video as youtubeId', () => {
  const parsed = lessonBlocksInputSchema.parse(valid);
  const stored = toStoredBlocks(parsed);
  assert.deepEqual(stored[3], { type: 'video', youtubeId: ID });
  assert.equal(stored.length, 5);
});

test('blank captions and explanations are dropped', () => {
  const stored = toStoredBlocks(
    lessonBlocksInputSchema.parse([
      { type: 'image', imageId: IMG, caption: '   ' },
      { type: 'check', prompt: 'Q', choices: ['a', 'b'], correctChoice: 0, explanation: '' },
    ]),
  );
  assert.deepEqual(stored[0], { type: 'image', imageId: IMG });
  assert.deepEqual(stored[1], { type: 'check', prompt: 'Q', choices: ['a', 'b'], correctChoice: 0 });
});

const lesson = z.object({ blocks: lessonBlocksInputSchema });
function errorFor(blocks: unknown[]) {
  const result = lesson.safeParse({ blocks });
  assert.equal(result.success, false);
  return formatValidationError(result.error!);
}

test('errors name the block that is wrong', () => {
  assert.equal(errorFor([valid[0], valid[1], valid[2], { type: 'video', url: 'https://vimeo.com/1' }]), 'Block 4: Not a YouTube link');
  assert.equal(errorFor([{ type: 'text', text: '   ' }]), 'Block 1: Text blocks cannot be empty');
  assert.equal(errorFor([{ type: 'heading', text: 'x'.repeat(201) }]), 'Block 1: Headings can be at most 200 characters');
});

test('check blocks enforce choices and correctChoice', () => {
  assert.equal(errorFor([{ type: 'check', prompt: 'Q', choices: ['only one'], correctChoice: 0 }]), 'Block 1: A check needs at least 2 choices');
  assert.equal(
    errorFor([{ type: 'check', prompt: 'Q', choices: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], correctChoice: 0 }]),
    'Block 1: A check can have at most 6 choices',
  );
  assert.equal(errorFor([{ type: 'check', prompt: 'Q', choices: ['a', 'b'], correctChoice: 2 }]), 'Block 1: Pick the correct choice');
  assert.equal(errorFor([{ type: 'check', prompt: 'Q', choices: ['a', ' '], correctChoice: 0 }]), 'Block 1: Choices cannot be blank');
});

test('unknown block types and too many blocks are rejected', () => {
  assert.match(errorFor([{ type: 'ar', arModelId: IMG }]), /^Block 1: /);
  const many = Array.from({ length: MAX_BLOCKS + 1 }, () => ({ type: 'text', text: 'x' }));
  assert.equal(errorFor(many), `A lesson can have at most ${MAX_BLOCKS} blocks`);
});

test('presentBlocks adds image urls and tolerates null', () => {
  assert.deepEqual(presentBlocks(null), []);
  assert.deepEqual(presentBlocks([{ type: 'image', imageId: IMG }])[0], { type: 'image', imageId: IMG, url: `/api/images/${IMG}/file` });
});

test('imageIdsIn returns unique image ids', () => {
  const other = '9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4';
  assert.deepEqual(
    imageIdsIn([{ type: 'image', imageId: IMG }, { type: 'text', text: 'x' }, { type: 'image', imageId: IMG }, { type: 'image', imageId: other }]),
    [IMG, other],
  );
  assert.deepEqual(imageIdsIn(null), []);
});
