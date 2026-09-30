import type { Assessment, AssessmentAttempt, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import {
  cleanAnswers,
  markAttempt,
  presentQuestions,
  reviewQuestion,
  studentQuestion,
  summarise,
  totalPoints,
} from '../utils/assessmentQuestions';
import type { Question, QuestionResult } from '../utils/assessmentQuestions';

// Instructor-made quizzes and exams for a class, and students taking them.
// Instructors only reach assessments in their own classes; students only those of classes they're enrolled in.

// A submission may arrive a little after the time limit (network, the auto-submit firing at 0:00).
const GRACE_MS = 2 * 60 * 1000;

export interface AssessmentInput {
  kind: 'QUIZ' | 'EXAM';
  title: string;
  instructions?: string | null;
  questions: Question[];
  timeLimitMinutes?: number | null;
  maxAttempts?: number | null;
  opensAt?: Date | null;
  closesAt?: Date | null;
  showAnswers: boolean;
  published: boolean;
}

type AttemptRow = AssessmentAttempt;

const results = (a: AttemptRow) => (a.results ?? {}) as unknown as Record<string, QuestionResult>;
const answers = (a: AttemptRow) => (a.answers ?? {}) as unknown as Record<string, unknown>;
const deadline = (assessment: Assessment, attempt: AttemptRow) =>
  assessment.timeLimitMinutes ? new Date(attempt.startedAt.getTime() + assessment.timeLimitMinutes * 60_000) : null;

// ============ Instructor ============

async function ownClass(classId: string, instructorId: string) {
  const cls = await prisma.class.findFirst({ where: { id: classId, instructorId }, select: { id: true } });
  if (!cls) throw ApiError.notFound('Class not found');
}

async function ownAssessment(classId: string, id: string, instructorId: string) {
  await ownClass(classId, instructorId);
  const assessment = await prisma.assessment.findFirst({ where: { id, classId } });
  if (!assessment) throw ApiError.notFound('Quiz or exam not found');
  return assessment;
}

function checkWindow(input: Pick<AssessmentInput, 'opensAt' | 'closesAt'>) {
  if (input.opensAt && input.closesAt && input.closesAt <= input.opensAt) throw ApiError.badRequest('The closing time must be after the opening time');
}

function summary(a: Assessment & { attempts: Pick<AttemptRow, 'studentId' | 'submittedAt' | 'needsGrading'>[] }) {
  const questions = presentQuestions(a.questions);
  const submitted = a.attempts.filter((t) => t.submittedAt);
  const { questions: _q, attempts: _a, ...rest } = a;
  return {
    ...rest,
    questionCount: questions.length,
    totalPoints: totalPoints(questions),
    studentsSubmitted: new Set(submitted.map((t) => t.studentId)).size,
    needsGrading: submitted.filter((t) => t.needsGrading).length,
  };
}

export async function listForClass(classId: string, instructorId: string) {
  await ownClass(classId, instructorId);
  const list = await prisma.assessment.findMany({
    where: { classId },
    include: { attempts: { select: { studentId: true, submittedAt: true, needsGrading: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return list.map(summary);
}

export async function getForInstructor(classId: string, id: string, instructorId: string) {
  const a = await ownAssessment(classId, id, instructorId);
  const submissions = await prisma.assessmentAttempt.count({ where: { assessmentId: id, submittedAt: { not: null } } });
  return { ...a, questions: presentQuestions(a.questions), submissions };
}

export async function createAssessment(classId: string, instructorId: string, input: AssessmentInput) {
  await ownClass(classId, instructorId);
  checkWindow(input);
  return prisma.assessment.create({ data: { ...input, classId, questions: input.questions as unknown as Prisma.InputJsonValue } });
}

export async function updateAssessment(classId: string, id: string, instructorId: string, input: AssessmentInput) {
  const existing = await ownAssessment(classId, id, instructorId);
  checkWindow(input);
  // Once students have submitted, the questions (and so their marks) are fixed; settings can still change.
  const submitted = await prisma.assessmentAttempt.count({ where: { assessmentId: id, submittedAt: { not: null } } });
  if (submitted > 0 && JSON.stringify(presentQuestions(existing.questions)) !== JSON.stringify(input.questions)) {
    throw ApiError.badRequest('Students have already submitted this — its questions can no longer be changed. You can still change the settings.');
  }
  return prisma.assessment.update({ where: { id }, data: { ...input, questions: input.questions as unknown as Prisma.InputJsonValue } });
}

export async function deleteAssessment(classId: string, id: string, instructorId: string) {
  await ownAssessment(classId, id, instructorId);
  await prisma.assessment.delete({ where: { id } });
}

// Every enrolled student with their attempts at this assessment.
export async function getResults(classId: string, id: string, instructorId: string) {
  const assessment = await ownAssessment(classId, id, instructorId);
  const questions = presentQuestions(assessment.questions);
  const [enrollments, attempts] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId },
      select: { student: { select: { id: true, firstName: true, lastName: true, srCode: true } } },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    }),
    prisma.assessmentAttempt.findMany({ where: { assessmentId: id, submittedAt: { not: null } }, orderBy: { submittedAt: 'asc' } }),
  ]);
  const students = enrollments.map(({ student }) => {
    const mine = attempts.filter((t) => t.studentId === student.id);
    const best = mine.reduce<number | null>((b, t) => (t.score !== null && (b === null || t.score > b) ? t.score : b), null);
    return {
      ...student,
      attempts: mine.map((t) => ({ id: t.id, submittedAt: t.submittedAt, score: t.score, needsGrading: t.needsGrading })),
      bestScore: best,
      needsGrading: mine.some((t) => t.needsGrading),
    };
  });
  return { assessment: { id: assessment.id, title: assessment.title, kind: assessment.kind, totalPoints: totalPoints(questions) }, students };
}

async function ownAttempt(classId: string, assessmentId: string, attemptId: string, instructorId: string) {
  const assessment = await ownAssessment(classId, assessmentId, instructorId);
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { id: attemptId, assessmentId, submittedAt: { not: null } },
    include: { student: { select: { id: true, firstName: true, lastName: true, srCode: true } } },
  });
  if (!attempt) throw ApiError.notFound('Submission not found');
  return { assessment, attempt };
}

function instructorAttemptView(assessment: Assessment, attempt: AttemptRow & { student: object }) {
  const questions = presentQuestions(assessment.questions);
  return {
    id: attempt.id,
    student: attempt.student,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    maxScore: attempt.maxScore,
    needsGrading: attempt.needsGrading,
    assessment: { id: assessment.id, title: assessment.title, kind: assessment.kind },
    questions: questions.map((q) => ({ question: q, answer: answers(attempt)[q.id] ?? null, result: results(attempt)[q.id] ?? { points: 0, graded: true } })),
  };
}

export async function getAttemptForInstructor(classId: string, assessmentId: string, attemptId: string, instructorId: string) {
  const { assessment, attempt } = await ownAttempt(classId, assessmentId, attemptId, instructorId);
  return instructorAttemptView(assessment, attempt);
}

// Sets points (and optional feedback) for questions — grading essays, or overriding an automatic mark.
export async function gradeAttempt(
  classId: string,
  assessmentId: string,
  attemptId: string,
  instructorId: string,
  grades: Record<string, { points: number; feedback?: string }>,
) {
  const { assessment, attempt } = await ownAttempt(classId, assessmentId, attemptId, instructorId);
  const questions = presentQuestions(assessment.questions);
  const next = { ...results(attempt) };
  for (const [questionId, grade] of Object.entries(grades)) {
    const q = questions.find((x) => x.id === questionId);
    if (!q) throw ApiError.badRequest('That question is not part of this quiz');
    if (grade.points < 0 || grade.points > q.points) throw ApiError.badRequest(`Points for a question must be between 0 and ${q.points}`);
    next[questionId] = { points: grade.points, graded: true, ...(grade.feedback?.trim() ? { feedback: grade.feedback.trim() } : {}) };
  }
  const { score, needsGrading } = summarise(questions, next);
  const updated = await prisma.assessmentAttempt.update({
    where: { id: attempt.id },
    data: { results: next as unknown as Prisma.InputJsonValue, score, needsGrading },
    include: { student: { select: { id: true, firstName: true, lastName: true, srCode: true } } },
  });
  return instructorAttemptView(assessment, updated);
}

// ============ Student ============

async function enrolledAssessment(studentId: string, id: string) {
  const assessment = await prisma.assessment.findFirst({ where: { id, published: true, class: { enrollments: { some: { studentId } } } } });
  if (!assessment) throw ApiError.notFound('Quiz or exam not found');
  return assessment;
}

// An unsubmitted attempt whose time ran out is closed with whatever was sent (nothing), so it counts as used.
async function closeIfExpired(assessment: Assessment, attempt: AttemptRow) {
  const end = deadline(assessment, attempt);
  if (attempt.submittedAt || !end || Date.now() <= end.getTime() + GRACE_MS) return attempt;
  return finishAttempt(assessment, attempt, {});
}

async function finishAttempt(assessment: Assessment, attempt: AttemptRow, raw: Record<string, unknown>) {
  const questions = presentQuestions(assessment.questions);
  const given = cleanAnswers(questions, raw);
  const { results: marked, score, needsGrading } = markAttempt(questions, given);
  return prisma.assessmentAttempt.update({
    where: { id: attempt.id },
    data: {
      answers: given as Prisma.InputJsonValue,
      results: marked as unknown as Prisma.InputJsonValue,
      score,
      needsGrading,
      submittedAt: new Date(),
    },
  });
}

async function attemptsOf(assessment: Assessment, studentId: string) {
  const list = await prisma.assessmentAttempt.findMany({ where: { assessmentId: assessment.id, studentId }, orderBy: { startedAt: 'asc' } });
  return Promise.all(list.map((t) => closeIfExpired(assessment, t)));
}

function availability(a: Assessment, used: number) {
  const now = Date.now();
  if (a.opensAt && now < a.opensAt.getTime()) return 'NOT_OPEN' as const;
  if (a.closesAt && now > a.closesAt.getTime()) return 'CLOSED' as const;
  if (a.maxAttempts !== null && used >= a.maxAttempts) return 'NO_ATTEMPTS_LEFT' as const;
  return 'OPEN' as const;
}

function studentSummary(a: Assessment, attempts: AttemptRow[]) {
  const questions = presentQuestions(a.questions);
  const submitted = attempts.filter((t) => t.submittedAt);
  const inProgress = attempts.find((t) => !t.submittedAt) ?? null;
  const best = submitted.reduce<number | null>((b, t) => (t.score !== null && (b === null || t.score > b) ? t.score : b), null);
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    instructions: a.instructions,
    questionCount: questions.length,
    totalPoints: totalPoints(questions),
    timeLimitMinutes: a.timeLimitMinutes,
    maxAttempts: a.maxAttempts,
    opensAt: a.opensAt,
    closesAt: a.closesAt,
    attemptsUsed: attempts.length,
    bestScore: best,
    pendingGrading: submitted.some((t) => t.needsGrading),
    inProgressId: inProgress?.id ?? null,
    status: inProgress ? ('IN_PROGRESS' as const) : availability(a, attempts.length),
    attempts: submitted.map((t) => ({ id: t.id, submittedAt: t.submittedAt, score: t.score, maxScore: t.maxScore, needsGrading: t.needsGrading })),
  };
}

export async function listForStudentClass(studentId: string, classId: string) {
  const enrolled = await prisma.enrollment.findUnique({ where: { classId_studentId: { classId, studentId } }, select: { id: true } });
  if (!enrolled) throw ApiError.notFound('Class not found');
  const list = await prisma.assessment.findMany({ where: { classId, published: true }, orderBy: { createdAt: 'desc' } });
  return Promise.all(list.map(async (a) => studentSummary(a, await attemptsOf(a, studentId))));
}

export async function getForStudent(studentId: string, id: string) {
  const a = await enrolledAssessment(studentId, id);
  return studentSummary(a, await attemptsOf(a, studentId));
}

// Starts (or resumes) an attempt; returns the questions without answer keys and when time runs out.
export async function startAttempt(studentId: string, id: string) {
  const a = await enrolledAssessment(studentId, id);
  const attempts = await attemptsOf(a, studentId);
  let attempt = attempts.find((t) => !t.submittedAt);
  if (!attempt) {
    const status = availability(a, attempts.length);
    if (status === 'NOT_OPEN') throw ApiError.badRequest("This isn't open yet");
    if (status === 'CLOSED') throw ApiError.badRequest('This is closed');
    if (status === 'NO_ATTEMPTS_LEFT') throw ApiError.badRequest("You've used all your attempts");
    const questions = presentQuestions(a.questions);
    if (questions.length === 0) throw ApiError.badRequest("This doesn't have any questions yet");
    attempt = await prisma.assessmentAttempt.create({ data: { assessmentId: a.id, studentId, maxScore: totalPoints(questions) } });
  }
  return {
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    deadline: deadline(a, attempt),
    // The app times the countdown against this, so a phone with a wrong clock still counts down correctly.
    serverTime: new Date(),
    title: a.title,
    kind: a.kind,
    questions: presentQuestions(a.questions).map(studentQuestion),
  };
}

function studentReview(a: Assessment, attempt: AttemptRow) {
  const questions = presentQuestions(a.questions);
  return {
    attemptId: attempt.id,
    assessmentId: a.id,
    title: a.title,
    kind: a.kind,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    maxScore: attempt.maxScore,
    needsGrading: attempt.needsGrading,
    showAnswers: a.showAnswers,
    questions: questions.map((q) => reviewQuestion(q, answers(attempt)[q.id], results(attempt)[q.id], a.showAnswers)),
  };
}

export async function submitAttempt(studentId: string, attemptId: string, raw: Record<string, unknown>) {
  const attempt = await prisma.assessmentAttempt.findFirst({ where: { id: attemptId, studentId }, include: { assessment: true } });
  if (!attempt) throw ApiError.notFound('Attempt not found');
  if (attempt.submittedAt) throw ApiError.badRequest('This attempt was already submitted');
  const end = deadline(attempt.assessment, attempt);
  const late = end && Date.now() > end.getTime() + GRACE_MS;
  // Too late: the attempt is closed without the answers, as if time had run out with nothing sent.
  const done = await finishAttempt(attempt.assessment, attempt, late ? {} : raw);
  if (late) throw ApiError.badRequest('Time ran out before this was submitted, so the attempt was closed.');
  return studentReview(attempt.assessment, done);
}

export async function getAttemptForStudent(studentId: string, attemptId: string) {
  const attempt = await prisma.assessmentAttempt.findFirst({ where: { id: attemptId, studentId, submittedAt: { not: null } }, include: { assessment: true } });
  if (!attempt) throw ApiError.notFound('Attempt not found');
  return studentReview(attempt.assessment, attempt);
}
