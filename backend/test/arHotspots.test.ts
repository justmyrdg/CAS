import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_HOTSPOTS, hotspotsInputSchema, presentHotspots } from '../src/utils/arHotspots';

const point = (id: string, extra: object = {}) => ({ id, position: [0, 1.5, 0.2], normal: [0, 0, 1], title: 'Frontal lobe', description: 'Planning.', ...extra });

test('valid points are accepted and trimmed', () => {
  const parsed = hotspotsInputSchema.parse({ hotspots: [point('a', { title: '  Frontal lobe ' }), point('b', { description: undefined })] });
  assert.equal(parsed.hotspots[0].title, 'Frontal lobe');
  assert.equal(parsed.hotspots[1].description, '');
});

test('bad points are rejected', () => {
  for (const hotspots of [
    [point('a', { title: '  ' })],
    [point('a', { position: [0, 1] })],
    [point('a', { normal: [0, Number.NaN, 1] })],
    [point('a', { description: 'x'.repeat(1001) })],
    [point('a'), point('a')],
    Array.from({ length: MAX_HOTSPOTS + 1 }, (_, i) => point(String(i))),
  ]) {
    assert.equal(hotspotsInputSchema.safeParse({ hotspots }).success, false, JSON.stringify(hotspots).slice(0, 80));
  }
});

test('presentHotspots drops malformed stored entries', () => {
  assert.deepEqual(presentHotspots(null), []);
  assert.deepEqual(presentHotspots([point('a'), { id: 'b' }, 'junk']).map((h) => h.id), ['a']);
});
