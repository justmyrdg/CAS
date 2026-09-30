import { z } from 'zod';

// Questions of an instructor-made quiz/exam (Assessment.questions) — every type, its answer key, what students may
// see before submitting, the shape of a student's answer, and how it's marked. Everything except essays is marked
// automatically; essays (and any override) are graded by the instructor.

export const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER', 'ENUMERATION', 'MATCHING', 'ESSAY'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const MAX_QUESTIONS = 200;

const text = (max: number, what: string) => z.string().trim().min(1, `${what} can't be blank`).max(max, `${what} is too long (${max} characters max)`);

const base = {
  id: z.string().trim().min(1).max(64),
  prompt: text(2000, 'A question'),
  points: z.number().int().min(1, 'Points must be at least 1').max(100, 'Points must be 100 or fewer'),
};

const choices = z.array(text(300, 'A choice')).min(2, 'Give at least 2 choices').max(8, 'At most 8 choices');

export const questionSchema = z
  .discriminatedUnion('type', [
    z.object({ ...base, type: z.literal('MULTIPLE_CHOICE'), choices, correct: z.number().int().min(0) }),
    z.object({ ...base, type: z.literal('MULTIPLE_SELECT'), choices, correct: z.array(z.number().int().min(0)).min(1, 'Mark at least one correct choice') }),
    z.object({ ...base, type: z.literal('TRUE_FALSE'), correct: z.boolean() }),
    z.object({ ...base, type: z.literal('SHORT_ANSWER'), accepted: z.array(text(200, 'An accepted answer')).min(1, 'Give at least one accepted answer').max(10) }),
    z.object({ ...base, type: z.literal('ENUMERATION'), answers: z.array(text(200, 'An answer')).min(2, 'Give at least 2 answers').max(20), ordered: z.boolean().default(false) }),
    z.object({
      ...base,
      type: z.literal('MATCHING'),
      pairs: z.array(z.object({ left: text(200, 'An item'), right: text(200, 'A match') })).min(2, 'Give at least 2 pairs').max(12),
    }),
    z.object({ ...base, type: z.literal('ESSAY'), guide: z.string().trim().max(2000).default('') }),
  ])
  .superRefine((q, ctx) => {
    if (q.type === 'MULTIPLE_CHOICE' && q.correct >= q.choices.length) ctx.addIssue({ code: 'custom', message: 'Mark the correct choice' });
    if (q.type === 'MULTIPLE_SELECT') {
      if (q.correct.some((i) => i >= q.choices.length) || new Set(q.correct).size !== q.correct.length) {
        ctx.addIssue({ code: 'custom', message: 'The correct choices are invalid' });
      }
    }
    if (q.type === 'MATCHING' && new Set(q.pairs.map((p) => norm(p.right))).size !== q.pairs.length) {
      ctx.addIssue({ code: 'custom', message: 'Each match must be different' });
    }
  });

export type Question = z.infer<typeof questionSchema>;

export const questionsSchema = z
  .array(questionSchema)
  .max(MAX_QUESTIONS, `At most ${MAX_QUESTIONS} questions`)
  .refine((list) => new Set(list.map((q) => q.id)).size === list.length, 'Question ids must be unique');

export function presentQuestions(value: unknown): Question[] {
  const parsed = questionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export const totalPoints = (questions: Question[]) => questions.reduce((sum, q) => sum + q.points, 0);

// ---------- What students see before submitting (no answer keys) ----------

// Deterministic shuffle (by question id), so matching options stay in the same order across reloads.
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function studentQuestion(q: Question) {
  const common = { id: q.id, type: q.type, prompt: q.prompt, points: q.points };
  switch (q.type) {
    case 'MULTIPLE_CHOICE':
      return { ...common, choices: q.choices };
    case 'MULTIPLE_SELECT':
      return { ...common, choices: q.choices, selectCount: q.correct.length };
    case 'TRUE_FALSE':
    case 'SHORT_ANSWER':
    case 'ESSAY':
      return common;
    case 'ENUMERATION':
      return { ...common, count: q.answers.length, ordered: q.ordered };
    case 'MATCHING':
      return { ...common, left: q.pairs.map((p) => p.left), options: shuffled(q.pairs.map((p) => p.right), q.id) };
  }
}

// ---------- Students' answers ----------

const answerSchemas: Record<QuestionType, z.ZodTypeAny> = {
  MULTIPLE_CHOICE: z.number().int().min(0),
  MULTIPLE_SELECT: z.array(z.number().int().min(0)).max(8),
  TRUE_FALSE: z.boolean(),
  SHORT_ANSWER: z.string().max(500),
  ENUMERATION: z.array(z.string().max(500)).max(20),
  MATCHING: z.array(z.string().max(500).nullable()).max(12),
  ESSAY: z.string().max(20000),
};

export const answersInputSchema = z.object({ answers: z.record(z.string(), z.unknown()).default({}) });

// Keeps only well-formed answers to questions that exist (anything else counts as unanswered).
export function cleanAnswers(questions: Question[], raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    const parsed = answerSchemas[q.type].safeParse(raw[q.id]);
    if (parsed.success) out[q.id] = parsed.data;
  }
  return out;
}

// ---------- Marking ----------

// Case, spacing and trailing punctuation don't matter for typed answers.
export function norm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
}

const round = (n: number) => Math.round(n * 100) / 100;

export interface QuestionResult {
  points: number;
  graded: boolean; // false = waiting for the instructor (essays)
  feedback?: string;
}

export function markQuestion(q: Question, answer: unknown): QuestionResult {
  switch (q.type) {
    case 'MULTIPLE_CHOICE':
      return { points: answer === q.correct ? q.points : 0, graded: true };
    case 'TRUE_FALSE':
      return { points: answer === q.correct ? q.points : 0, graded: true };
    case 'MULTIPLE_SELECT': {
      // Partial credit: each right pick earns a share, each wrong pick takes one back (never below 0).
      const picked = new Set(Array.isArray(answer) ? (answer as number[]) : []);
      const right = [...picked].filter((i) => q.correct.includes(i)).length;
      const wrong = picked.size - right;
      return { points: round(Math.max(0, (right - wrong) / q.correct.length) * q.points), graded: true };
    }
    case 'SHORT_ANSWER':
      return { points: typeof answer === 'string' && q.accepted.some((a) => norm(a) === norm(answer)) ? q.points : 0, graded: true };
    case 'ENUMERATION': {
      const given = Array.isArray(answer) ? (answer as string[]).map(norm) : [];
      const expected = q.answers.map(norm);
      let matched = 0;
      if (q.ordered) {
        expected.forEach((e, i) => {
          if (given[i] === e) matched += 1;
        });
      } else {
        const left = [...expected];
        for (const g of given) {
          const at = g ? left.indexOf(g) : -1;
          if (at >= 0) {
            matched += 1;
            left.splice(at, 1);
          }
        }
      }
      return { points: round((matched / expected.length) * q.points), graded: true };
    }
    case 'MATCHING': {
      const given = Array.isArray(answer) ? (answer as (string | null)[]) : [];
      const matched = q.pairs.filter((p, i) => typeof given[i] === 'string' && norm(given[i] as string) === norm(p.right)).length;
      return { points: round((matched / q.pairs.length) * q.points), graded: true };
    }
    case 'ESSAY':
      return { points: 0, graded: false };
  }
}

export function markAttempt(questions: Question[], answers: Record<string, unknown>) {
  const results: Record<string, QuestionResult> = {};
  for (const q of questions) results[q.id] = markQuestion(q, answers[q.id]);
  return summarise(questions, results);
}

// Score and whether anything still needs the instructor, from per-question results.
export function summarise(questions: Question[], results: Record<string, QuestionResult>) {
  const score = round(questions.reduce((sum, q) => sum + (results[q.id]?.points ?? 0), 0));
  const needsGrading = questions.some((q) => results[q.id] && !results[q.id].graded);
  return { results, score, needsGrading };
}

// What students see about a question after submitting: their answer and points, plus the key if answers are shown.
export function reviewQuestion(q: Question, answer: unknown, result: QuestionResult | undefined, withKey: boolean) {
  const key =
    !withKey || q.type === 'ESSAY'
      ? undefined
      : q.type === 'MULTIPLE_CHOICE' || q.type === 'MULTIPLE_SELECT' || q.type === 'TRUE_FALSE'
        ? { correct: q.correct }
        : q.type === 'SHORT_ANSWER'
          ? { accepted: q.accepted }
          : q.type === 'ENUMERATION'
            ? { answers: q.answers }
            : { matches: q.pairs.map((p) => p.right) };
  // `points` stays the question's worth; `earned` is what this answer got.
  return { ...studentQuestion(q), answer: answer ?? null, earned: result?.points ?? 0, graded: result?.graded ?? true, feedback: result?.feedback, key };
}
