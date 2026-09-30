import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanAnswers,
  markAttempt,
  markQuestion,
  questionsSchema,
  reviewQuestion,
  studentQuestion,
  summarise,
  type Question,
} from '../src/utils/assessmentQuestions';

const q = (extra: object) => questionsSchema.parse([{ id: 'q', prompt: 'Q?', points: 4, ...extra }])[0];

test('multiple choice, true/false and short answer are all-or-nothing', () => {
  const mc = q({ type: 'MULTIPLE_CHOICE', choices: ['a', 'b', 'c'], correct: 1 });
  assert.equal(markQuestion(mc, 1).points, 4);
  assert.equal(markQuestion(mc, 2).points, 0);
  const tf = q({ type: 'TRUE_FALSE', correct: false });
  assert.equal(markQuestion(tf, false).points, 4);
  assert.equal(markQuestion(tf, undefined).points, 0);
  const sa = q({ type: 'SHORT_ANSWER', accepted: ['Mitochondria', 'mitochondrion'] });
  assert.equal(markQuestion(sa, '  mitochondria. ').points, 4, 'case, spaces and a trailing period are ignored');
  assert.equal(markQuestion(sa, 'nucleus').points, 0);
});

test('multiple select gives partial credit and takes back wrong picks', () => {
  const ms = q({ type: 'MULTIPLE_SELECT', choices: ['a', 'b', 'c', 'd'], correct: [0, 2] });
  assert.equal(markQuestion(ms, [0, 2]).points, 4);
  assert.equal(markQuestion(ms, [0]).points, 2);
  assert.equal(markQuestion(ms, [0, 1]).points, 0);
  assert.equal(markQuestion(ms, [1, 3]).points, 0, 'never below zero');
});

test('enumeration: any order by default, in order when required', () => {
  const any = q({ type: 'ENUMERATION', answers: ['red', 'green', 'blue', 'yellow'] });
  assert.equal(markQuestion(any, ['Blue', 'red', 'purple', 'red']).points, 2, 'duplicates count once');
  const ordered = q({ type: 'ENUMERATION', answers: ['one', 'two'], ordered: true });
  assert.equal(markQuestion(ordered, ['two', 'one']).points, 0);
  assert.equal(markQuestion(ordered, ['one', 'x']).points, 2);
});

test('matching is marked per pair and students never see the key', () => {
  const m = q({ type: 'MATCHING', pairs: [{ left: 'H2O', right: 'water' }, { left: 'NaCl', right: 'salt' }] });
  assert.equal(markQuestion(m, ['water', 'salt']).points, 4);
  assert.equal(markQuestion(m, ['salt', null]).points, 0);
  assert.equal(markQuestion(m, ['water', null]).points, 2);
  const shown = studentQuestion(m) as { left: string[]; options: string[] };
  assert.deepEqual(shown.left, ['H2O', 'NaCl']);
  assert.deepEqual([...shown.options].sort(), ['salt', 'water']);
  assert.ok(!('pairs' in shown) && !('correct' in (studentQuestion(q({ type: 'TRUE_FALSE', correct: true })) as object)));
});

test('essays wait for the instructor; grading them completes the score', () => {
  const questions: Question[] = questionsSchema.parse([
    { id: 'a', type: 'TRUE_FALSE', prompt: 'T?', points: 2, correct: true },
    { id: 'b', type: 'ESSAY', prompt: 'Explain.', points: 8 },
  ]);
  const first = markAttempt(questions, cleanAnswers(questions, { a: true, b: 'Because…', junk: 1 }));
  assert.equal(first.score, 2);
  assert.equal(first.needsGrading, true);
  const graded = summarise(questions, { ...first.results, b: { points: 6, graded: true } });
  assert.equal(graded.score, 8);
  assert.equal(graded.needsGrading, false);
});

test('bad questions are rejected', () => {
  for (const bad of [
    { type: 'MULTIPLE_CHOICE', choices: ['only one'], correct: 0 },
    { type: 'MULTIPLE_CHOICE', choices: ['a', 'b'], correct: 5 },
    { type: 'MULTIPLE_SELECT', choices: ['a', 'b'], correct: [] },
    { type: 'SHORT_ANSWER', accepted: [] },
    { type: 'MATCHING', pairs: [{ left: 'x', right: 'same' }, { left: 'y', right: 'Same' }] },
  ]) {
    assert.equal(questionsSchema.safeParse([{ id: 'q', prompt: 'Q?', points: 1, ...bad }]).success, false, JSON.stringify(bad));
  }
});

test('review hides the key unless answers are shown', () => {
  const mc = q({ type: 'MULTIPLE_CHOICE', choices: ['a', 'b'], correct: 0 });
  assert.equal(reviewQuestion(mc, 1, { points: 0, graded: true }, false).key, undefined);
  assert.deepEqual(reviewQuestion(mc, 1, { points: 0, graded: true }, true).key, { correct: 0 });
});
