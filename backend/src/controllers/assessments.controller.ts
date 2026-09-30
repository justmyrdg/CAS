import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { answersInputSchema, questionsSchema } from '../utils/assessmentQuestions';
import * as service from '../services/assessments.service';

// Instructor-made quizzes/exams (/api/instructor/classes/:classId/assessments) and students taking them
// (/api/student/...). Services enforce ownership / enrollment.

// null first: z.coerce.date() would turn null into 1970-01-01.
const optionalDate = z.union([z.null(), z.coerce.date()]).optional();

const assessmentSchema = z
  .object({
    kind: z.enum(['QUIZ', 'EXAM']),
    title: z.string().trim().min(1, 'Give it a title').max(160, 'The title is too long'),
    instructions: z.string().trim().max(5000, 'The instructions are too long').nullable().optional(),
    questions: questionsSchema,
    timeLimitMinutes: z
      .number()
      .int()
      .min(1, 'The time limit must be at least 1 minute')
      .max(600, 'The time limit can be at most 600 minutes')
      .nullable()
      .optional(),
    maxAttempts: z.number().int().min(1, 'Allow at least 1 attempt').max(50, 'At most 50 attempts').nullable().optional(),
    opensAt: optionalDate,
    closesAt: optionalDate,
    showAnswers: z.boolean(),
    published: z.boolean(),
  })
  .refine((a) => !a.published || a.questions.length > 0, { message: 'Add at least one question before publishing', path: ['questions'] });

// "Question 3: Mark the correct choice" rather than a bare list of messages.
function parseAssessment(body: unknown) {
  const parsed = assessmentSchema.safeParse(body);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const [field, index] = issue.path;
  const where = field === 'questions' && typeof index === 'number' ? `Question ${index + 1}: ` : '';
  throw ApiError.badRequest(`${where}${issue.message}`);
}

export const gradesSchema = z.object({
  grades: z.record(z.string(), z.object({ points: z.number().min(0), feedback: z.string().max(2000).optional() })),
});

export { answersInputSchema };

function userId(req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user.id;
}
const p = (req: Request, name: string) => req.params[name] as string;

// ---- instructor ----

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json({ assessments: await service.listForClass(p(req, 'classId'), userId(req)) });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  res.json({ assessment: await service.getForInstructor(p(req, 'classId'), p(req, 'assessmentId'), userId(req)) });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await service.createAssessment(p(req, 'classId'), userId(req), parseAssessment(req.body));
  res.status(201).json({ assessment });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await service.updateAssessment(p(req, 'classId'), p(req, 'assessmentId'), userId(req), parseAssessment(req.body));
  res.json({ assessment });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteAssessment(p(req, 'classId'), p(req, 'assessmentId'), userId(req));
  res.status(204).send();
});

export const results = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.getResults(p(req, 'classId'), p(req, 'assessmentId'), userId(req)));
});

export const getAttempt = asyncHandler(async (req: Request, res: Response) => {
  res.json({ attempt: await service.getAttemptForInstructor(p(req, 'classId'), p(req, 'assessmentId'), p(req, 'attemptId'), userId(req)) });
});

export const grade = asyncHandler(async (req: Request, res: Response) => {
  const { grades } = req.body as z.infer<typeof gradesSchema>;
  res.json({ attempt: await service.gradeAttempt(p(req, 'classId'), p(req, 'assessmentId'), p(req, 'attemptId'), userId(req), grades) });
});

// ---- student ----

export const studentList = asyncHandler(async (req: Request, res: Response) => {
  res.json({ assessments: await service.listForStudentClass(userId(req), p(req, 'id')) });
});

export const studentGet = asyncHandler(async (req: Request, res: Response) => {
  res.json({ assessment: await service.getForStudent(userId(req), p(req, 'id')) });
});

export const studentStart = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await service.startAttempt(userId(req), p(req, 'id')));
});

export const studentSubmit = asyncHandler(async (req: Request, res: Response) => {
  const { answers } = req.body as z.infer<typeof answersInputSchema>;
  res.json({ review: await service.submitAttempt(userId(req), p(req, 'attemptId'), answers) });
});

export const studentReview = asyncHandler(async (req: Request, res: Response) => {
  res.json({ review: await service.getAttemptForStudent(userId(req), p(req, 'attemptId')) });
});
