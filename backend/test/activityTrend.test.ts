import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCORE_BANDS, bandCounts, trendStart, weeklyTrend } from '../src/utils/activityTrend';

const now = new Date('2026-09-30T12:00:00Z'); // a Wednesday

test('weeks start on Monday and end with the current week', () => {
  const weeks = weeklyTrend([], 4, now);
  assert.deepEqual(
    weeks.map((w) => w.weekStart),
    ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'],
  );
  assert.equal(trendStart(4, now).toISOString(), '2026-09-07T00:00:00.000Z');
});

test('events are counted in their week by kind; older ones are ignored', () => {
  const weeks = weeklyTrend(
    [
      { at: new Date('2026-09-28T00:00:00Z'), kind: 'lessons' },
      { at: new Date('2026-09-30T08:00:00Z'), kind: 'lessons' },
      { at: new Date('2026-09-27T23:59:59Z'), kind: 'quizzes' },
      { at: new Date('2026-09-08T10:00:00Z'), kind: 'assessments' },
      { at: new Date('2026-08-01T10:00:00Z'), kind: 'lessons' },
    ],
    4,
    now,
  );
  assert.deepEqual(weeks[3], { weekStart: '2026-09-28', lessons: 2, quizzes: 0, assessments: 0 });
  assert.equal(weeks[2].quizzes, 1);
  assert.equal(weeks[0].assessments, 1);
  assert.equal(weeks.reduce((n, w) => n + w.lessons, 0), 2);
});

test('band counts are inclusive at both ends', () => {
  assert.deepEqual(bandCounts([0, 59, 60, 74, 75, 89, 90, 100], SCORE_BANDS), [2, 2, 2, 2]);
});

