import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalCdf, predictStudent, slope, termEnd } from '../src/utils/predictive';
import type { StudentSignals } from '../src/utils/predictive';
import { classRecommendations, studentActions, studentRecommendations } from '../src/utils/prescriptive';

const now = new Date('2026-09-30T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const base: StudentSignals = {
  itemsDone: 8,
  itemsTotal: 16,
  doneDates: [70, 63, 56, 49, 42, 21, 14, 7].map(daysAgo),
  quizScores: [
    { pct: 80, at: daysAgo(50) },
    { pct: 85, at: daysAgo(30) },
  ],
  assessmentScores: [{ pct: 78, at: daysAgo(40) }],
  missedExams: 0,
  missedQuizzes: 0,
  enrolledAt: daysAgo(70),
  termEnd: termEnd('FIRST_SEM', '2026-2027'),
  now,
};

test('term ends', () => {
  assert.equal(termEnd('FIRST_SEM', '2026-2027').toISOString().slice(0, 10), '2026-12-18');
  assert.equal(termEnd('SECOND_SEM', '2026-2027').toISOString().slice(0, 10), '2027-05-22');
});

test('math helpers', () => {
  assert.equal(slope([50, 60, 70, 80]), 10);
  assert.equal(slope([70, 70]), 0); // too few points to call it a trend
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.28) - 0.9) < 0.01);
});

test('a steady, passing student is forecast low risk and on track', () => {
  const p = predictStudent(base);
  assert.equal(p.pacePerWeek, 0.8); // 0.6 × (3 in last 4 wks / 4) + 0.4 × (8 / 10 wks)
  assert.equal(p.onTrack, true);
  assert.equal(p.predictedRisk, 'LOW');
  assert.ok(p.predictedScore! >= 75 && p.predictedScore! <= 85);
  assert.ok(p.scoreLow! < p.predictedScore! && p.predictedScore! < p.scoreHigh!);
  assert.equal(p.confidence, 'MEDIUM');
});

test('low scores, a missed exam and a stalled pace raise the fail probability', () => {
  const p = predictStudent({
    ...base,
    doneDates: [70, 63, 56].map(daysAgo),
    itemsDone: 3,
    quizScores: [{ pct: 50, at: daysAgo(55) }],
    assessmentScores: [{ pct: 45, at: daysAgo(40) }],
    missedExams: 1,
  });
  assert.equal(p.predictedRisk, 'HIGH');
  assert.equal(p.onTrack, false);
  assert.ok(p.failProbability >= 80);
  assert.ok(p.factors.some((f) => /Missed 1 exam/.test(f)));
});

test('no scores yet gives a low-confidence forecast from engagement alone', () => {
  const p = predictStudent({ ...base, itemsDone: 0, doneDates: [], quizScores: [], assessmentScores: [] });
  assert.equal(p.predictedScore, null);
  assert.equal(p.confidence, 'LOW');
  assert.equal(p.failProbability, 70);
  assert.equal(p.projectedFinish, null);
});

test('student recommendations put an assessment that closes soon first', () => {
  const prediction = predictStudent(base);
  const recs = studentRecommendations({
    prediction,
    itemsDone: 8,
    itemsTotal: 16,
    termEnd: base.termEnd,
    lastActivity: daysAgo(2),
    nextItem: { title: 'Diffusion and Osmosis', type: 'LESSON' },
    weakQuizzes: [{ chapterTitle: 'Cell Structure', pct: 70 }],
    openAssessments: [{ title: 'Quiz 2', kind: 'QUIZ', closesAt: daysAgo(-3) }],
    missedExams: 0,
    now,
  });
  assert.equal(recs[0].kind, 'DEADLINE');
  assert.ok(recs.some((r) => r.kind === 'REVIEW' && r.title.includes('Cell Structure')));
});

test('instructor actions for an inactive student with a missed exam', () => {
  const prediction = predictStudent({ ...base, missedExams: 1 });
  const actions = studentActions({
    prediction,
    itemsDone: 8,
    itemsTotal: 16,
    termEnd: base.termEnd,
    lastActivity: daysAgo(20),
    nextItem: null,
    weakQuizzes: [],
    openAssessments: [],
    missedExams: 1,
    now,
  });
  assert.deepEqual(actions, ['Check in — no activity in 20 days', 'Arrange a make-up for the missed exam']);
});

test('class recommendations: contact, reteach and hard questions', () => {
  const recs = classRecommendations({
    studentCount: 10,
    predictedHigh: [{ name: 'Diego Pineda' }],
    notOnTrack: 1,
    weakChapters: [
      { title: 'Cellular Energy', average: 55, students: 8 },
      { title: 'Cell Structure', average: 88, students: 9 },
    ],
    hardQuestions: [{ assessmentTitle: 'Midterm', prompt: 'Match each organelle', correctRate: 35, responses: 9 }],
    openAssessments: [],
    essaysToGrade: 0,
    termEnd: base.termEnd,
    now,
  });
  assert.deepEqual(
    recs.map((r) => r.kind),
    ['CONTACT', 'RETEACH', 'QUESTION'],
  );
  assert.ok(!recs.some((r) => r.title.includes('Cell Structure')));
});

test('a student idle for weeks is not assumed to catch up at their old pace', () => {
  const active = predictStudent(base);
  const idle = predictStudent({ ...base, doneDates: [70, 63, 56, 49, 42, 35, 30, 28].map(daysAgo) });
  assert.ok(idle.pacePerWeek < active.pacePerWeek);
  assert.equal(idle.onTrack, false);
});
