import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_BYTES, detectImageType, unreferencedImageIds, validateImageFile } from '../src/services/lessonImages.service';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const GIF = Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

test('detectImageType recognises each allowed format by its contents', () => {
  assert.deepEqual(detectImageType(PNG), { ext: '.png', mimeType: 'image/png' });
  assert.deepEqual(detectImageType(JPEG), { ext: '.jpg', mimeType: 'image/jpeg' });
  assert.deepEqual(detectImageType(GIF), { ext: '.gif', mimeType: 'image/gif' });
  assert.deepEqual(detectImageType(WEBP), { ext: '.webp', mimeType: 'image/webp' });
  assert.equal(detectImageType(Buffer.from('just some text, renamed')), null);
});

test('validateImageFile rejects a renamed non-image', () => {
  assert.throws(() => validateImageFile('diagram.png', Buffer.from('not really a png')), /not a valid image/);
});

test('validateImageFile rejects other extensions, empty and oversized files', () => {
  assert.throws(() => validateImageFile('model.glb', PNG), /PNG, JPEG, WebP or GIF/);
  assert.throws(() => validateImageFile('empty.png', Buffer.alloc(0)), /empty/);
  const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
  assert.throws(() => validateImageFile('big.png', big), /5 MB/);
});

test('validateImageFile trusts contents over the extension', () => {
  assert.deepEqual(validateImageFile('photo.jpg', PNG), { ext: '.png', mimeType: 'image/png' });
});

test('unreferencedImageIds keeps only candidates no lesson references', () => {
  const lessonBlocks = [
    [{ type: 'image', imageId: 'img-1' }, { type: 'text', text: 'hi' }],
    [{ type: 'image', imageId: 'img-2' }],
    null,
  ];
  assert.deepEqual(unreferencedImageIds(['img-1', 'img-2', 'img-3'], lessonBlocks), ['img-3']);
});

test('unreferencedImageIds returns all candidates when there are no lessons', () => {
  assert.deepEqual(unreferencedImageIds(['img-1', 'img-2'], []), ['img-1', 'img-2']);
});
