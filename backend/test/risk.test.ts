import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk } from '../src/services/progress.service';

const now = new Date('2026-09-30T12:00:00Z');
const base = { quizAverage: null, completion: 50, classAverageCompletion: 50, lastActivity: now, enrolledAt: new Date('2026-09-01T00:00:00Z'), now };

test('a doing-fine student is low risk', () => {
  assert.deepEqual(assessRisk({ ...base, assessmentAverage: 90 }), { level: 'LOW', reasons: [] });
});

test("the instructor's quiz & exam average raises risk like the module-quiz average", () => {
  assert.deepEqual(assessRisk({ ...base, assessmentAverage: 55 }), { level: 'HIGH', reasons: ['Quiz & exam avg. 55%'] });
  assert.deepEqual(assessRisk({ ...base, assessmentAverage: 70 }), { level: 'MODERATE', reasons: ['Quiz & exam avg. 70%'] });
  assert.deepEqual(assessRisk({ ...base, quizAverage: 50 }).reasons, ['Module quiz avg. 50%']);
});

test('missing a closed exam is high risk; a missed quiz is moderate', () => {
  assert.deepEqual(assessRisk({ ...base, missedExams: 1 }), { level: 'HIGH', reasons: ['Missed 1 exam'] });
  assert.deepEqual(assessRisk({ ...base, missedQuizzes: 2 }), { level: 'MODERATE', reasons: ['Missed 2 quizzes'] });
});
