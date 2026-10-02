import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { fullName } from '../utils/fullName';
import { presentBlocks } from '../utils/lessonBlocks';
import { annotateOutline, isItemUnlocked, loadOutline, loadProgress, outlineItems, summarize } from './progress.service';
import { trendStart, weeklyTrend } from '../utils/activityTrend';
import { termEnd } from '../utils/predictive';
import { studentRecommendations } from '../utils/prescriptive';
import { forecastStudent, loadAssessmentStats } from './classAnalytics.service';

const STUDENT_TREND_WEEKS = 8;

// Everything the student app reads and writes. Every call is scoped to the
// signed-in student: they only see classes they're enrolled in, and only
// content from those classes' subjects.

const classSummarySelect = {
  id: true,
  subjectId: true,
  subjectCode: true,
  subjectName: true,
  section: true,
  term: true,
  schoolYear: true,
  isArchived: true,
  instructor: { select: { firstName: true, middleName: true, lastName: true, prefix: true } },
} satisfies Prisma.ClassSelect;

type ClassSummaryRow = Prisma.ClassGetPayload<{ select: typeof classSummarySelect }>;

function serializeClass(cls: ClassSummaryRow) {
  const { instructor, ...rest } = cls;
  return { ...rest, instructorName: fullName(instructor) };
}

async function findEnrollment(studentId: string, classId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { classId_studentId: { classId, studentId } },
    include: { class: { select: classSummarySelect } },
  });
  if (!enrollment) throw ApiError.notFound('You are not enrolled in this class');
  return enrollment;
}

export async function listClasses(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: { class: { select: classSummarySelect } },
    orderBy: { createdAt: 'desc' },
  });

  // Progress per class = share of its subject's lessons/quizzes done.
  const subjectIds = [...new Set(enrollments.map((e) => e.class.subjectId).filter((id): id is string => Boolean(id)))];
  const outlines = new Map(await Promise.all(subjectIds.map(async (id) => [id, await loadOutline(id)] as const)));
  const allItemIds = [...outlines.values()].flatMap((o) => outlineItems(o).map((i) => i.id));
  const progress = (await loadProgress([studentId], allItemIds)).get(studentId)!;

  return enrollments.map((e) => {
    const outline = e.class.subjectId ? outlines.get(e.class.subjectId) : undefined;
    const stats = outline ? summarize(outlineItems(outline), progress) : null;
    return {
      ...serializeClass(e.class),
      joinedVia: e.source,
      enrolledAt: e.createdAt,
      moduleCount: outline?.length ?? 0,
      completion: stats?.completion ?? 0,
      itemsDone: stats?.itemsDone ?? 0,
      itemsTotal: stats?.itemsTotal ?? 0,
    };
  });
}

export async function joinClass(studentId: string, rawCode: string) {
  const joinCode = rawCode.trim().toUpperCase();
  const cls = await prisma.class.findUnique({ where: { joinCode }, select: { ...classSummarySelect, joinCode: true } });
  if (!cls) throw ApiError.notFound(`No class found with join code ${joinCode}`);
  if (cls.isArchived) throw ApiError.badRequest('This class is archived and no longer accepting students');

  try {
    await prisma.enrollment.create({ data: { classId: cls.id, studentId, source: 'JOIN_CODE' } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ApiError.conflict(`You're already in ${cls.subjectCode} · Section ${cls.section}`);
    }
    throw err;
  }
  const { joinCode: _omit, ...summary } = cls;
  return serializeClass(summary);
}

// The class with its subject's modules -> chapters -> lessons/quizzes, annotated with this student's progress.
export async function getClass(studentId: string, classId: string) {
  const { class: cls } = await findEnrollment(studentId, classId);
  if (!cls.subjectId) {
    return { class: serializeClass(cls), modules: [], ...summarize([], { lessonsDone: new Map(), quizzes: new Map(), lastActivity: null }) };
  }
  const outline = await loadOutline(cls.subjectId);
  const progress = (await loadProgress([studentId], outlineItems(outline).map((i) => i.id))).get(studentId)!;
  return {
    class: serializeClass(cls),
    modules: annotateOutline(outline, progress),
    ...summarize(outlineItems(outline), progress),
  };
}

// Finds a lesson/quiz and checks the student may open it: enrolled in a class for
// its subject, and its chapter is unlocked.
async function accessibleItem(studentId: string, itemId: string) {
  const item = await prisma.contentItem.findUnique({
    where: { id: itemId },
    include: {
      questions: { orderBy: { position: 'asc' } },
      chapter: { select: { title: true, module: { select: { title: true, subjectId: true } } } },
    },
  });
  if (!item) throw ApiError.notFound('Lesson or quiz not found');

  const subjectId = item.chapter.module.subjectId;
  const enrolled = await prisma.enrollment.findFirst({ where: { studentId, class: { subjectId } }, select: { id: true } });
  if (!enrolled) throw ApiError.forbidden('You are not enrolled in a class for this subject');

  const outline = await loadOutline(subjectId);
  const progress = (await loadProgress([studentId], outlineItems(outline).map((i) => i.id))).get(studentId)!;
  if (!isItemUnlocked(outline, progress, itemId)) {
    throw ApiError.forbidden('Finish the earlier chapters first to unlock this one');
  }
  return item;
}

export async function getLesson(studentId: string, lessonId: string) {
  const item = await accessibleItem(studentId, lessonId);
  if (item.type !== 'LESSON') throw ApiError.notFound('Lesson not found');
  const [done, arModel] = await Promise.all([
    prisma.lessonCompletion.findUnique({ where: { studentId_lessonId: { studentId, lessonId } } }),
    item.arModelId ? prisma.arModel.findUnique({ where: { id: item.arModelId }, select: { id: true, name: true } }) : null,
  ]);
  return {
    id: item.id,
    title: item.title,
    blocks: presentBlocks(item.blocks),
    arModel: arModel ? { id: arModel.id, name: arModel.name, fileUrl: `/api/ar-models/${arModel.id}/file` } : null,
    chapterTitle: item.chapter.title,
    moduleTitle: item.chapter.module.title,
    completedAt: done?.completedAt ?? null,
  };
}

export async function completeLesson(studentId: string, lessonId: string) {
  const item = await accessibleItem(studentId, lessonId);
  if (item.type !== 'LESSON') throw ApiError.notFound('Lesson not found');
  const completion = await prisma.lessonCompletion.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    create: { studentId, lessonId },
    update: {},
  });
  return { completedAt: completion.completedAt };
}

// The quiz without its answers, plus the student's previous attempts.
export async function getQuiz(studentId: string, quizId: string) {
  const item = await accessibleItem(studentId, quizId);
  if (item.type !== 'QUIZ') throw ApiError.notFound('Quiz not found');
  const attempts = await prisma.quizAttempt.findMany({
    where: { studentId, quizId },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, score: true, total: true, submittedAt: true },
  });
  return {
    id: item.id,
    title: item.title,
    chapterTitle: item.chapter.title,
    moduleTitle: item.chapter.module.title,
    questions: item.questions.map((q) => ({ id: q.id, prompt: q.prompt, choices: q.choices })),
    attempts,
  };
}

// Grades a submission (answers[i] = chosen choice index for question i) and records the attempt.
export async function submitQuiz(studentId: string, quizId: string, answers: number[]) {
  const item = await accessibleItem(studentId, quizId);
  if (item.type !== 'QUIZ') throw ApiError.notFound('Quiz not found');
  if (item.questions.length === 0) throw ApiError.badRequest('This quiz has no questions yet');
  if (answers.length !== item.questions.length) {
    throw ApiError.badRequest(`Answer all ${item.questions.length} questions before submitting`);
  }

  const results = item.questions.map((q, i) => ({
    questionId: q.id,
    chosen: answers[i],
    correctChoice: q.correctChoice,
    correct: answers[i] === q.correctChoice,
  }));
  const score = results.filter((r) => r.correct).length;
  const attempt = await prisma.quizAttempt.create({
    data: { studentId, quizId, answers, score, total: item.questions.length },
  });
  return { attemptId: attempt.id, score, total: attempt.total, submittedAt: attempt.submittedAt, results };
}

// Overall progress across all of the student's classes, for the Progress screen.
export async function getProgress(studentId: string) {
  const classes = await listClasses(studentId);
  const subjectIds = [...new Set(classes.map((c) => c.subjectId).filter((id): id is string => Boolean(id)))];
  const outlines = await Promise.all(subjectIds.map((id) => loadOutline(id)));
  const outlineBySubject = new Map(subjectIds.map((id, i) => [id, outlines[i]]));
  const items = outlines.flatMap((o) => outlineItems(o));
  const progress = (await loadProgress([studentId], items.map((i) => i.id))).get(studentId)!;
  const overall = summarize(items, progress);

  const [recentLessons, recentAttempts] = await Promise.all([
    prisma.lessonCompletion.findMany({
      where: { studentId },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: { completedAt: true, lesson: { select: { title: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { studentId },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: { submittedAt: true, score: true, total: true, quiz: { select: { title: true } } },
    }),
  ]);
  // For the charts: weekly activity (8 weeks) and recent quiz scores.
  const since = trendStart(STUDENT_TREND_WEEKS);
  const [lessonTimes, quizTimes, submissions, scoreHistory] = await Promise.all([
    prisma.lessonCompletion.findMany({ where: { studentId, completedAt: { gte: since } }, select: { completedAt: true } }),
    prisma.quizAttempt.findMany({ where: { studentId, submittedAt: { gte: since } }, select: { submittedAt: true } }),
    prisma.assessmentAttempt.findMany({ where: { studentId, submittedAt: { gte: since } }, select: { submittedAt: true } }),
    prisma.quizAttempt.findMany({
      where: { studentId },
      orderBy: { submittedAt: 'desc' },
      take: 8,
      select: { submittedAt: true, score: true, total: true, quiz: { select: { title: true } } },
    }),
  ]);
  const activity = [
    ...lessonTimes.map((l) => ({ at: l.completedAt, kind: 'lessons' as const })),
    ...quizTimes.map((a) => ({ at: a.submittedAt, kind: 'quizzes' as const })),
    ...submissions.map((a) => ({ at: a.submittedAt as Date, kind: 'assessments' as const })),
  ];

  const recent = [
    ...recentLessons.map((l) => ({ kind: 'LESSON' as const, title: l.lesson.title, at: l.completedAt, score: null, total: null })),
    ...recentAttempts.map((a) => ({ kind: 'QUIZ' as const, title: a.quiz.title, at: a.submittedAt, score: a.score, total: a.total })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 10);

  // Predictive: each active class's outlook to the end of term. Prescriptive: what to do next, most urgent first.
  const forecasts = await Promise.all(
    classes
      .filter((c) => !c.isArchived && c.subjectId)
      .map(async (c) => {
        const outline = outlineBySubject.get(c.subjectId as string)!;
        const classItems = outlineItems(outline);
        const own = (await loadAssessmentStats(c.id, [{ studentId, createdAt: c.enrolledAt }])).perStudent.get(studentId);
        const dates = classItems
          .map((i) => (i.type === 'LESSON' ? progress.lessonsDone.get(i.id) : progress.quizzes.get(i.id)?.lastAt))
          .filter((d): d is Date => Boolean(d));
        const latest = [...dates, ...(own?.lastSubmission ? [own.lastSubmission] : [])].sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
        const end = termEnd(c.term, c.schoolYear);
        const { prediction, context } = forecastStudent({ outline, items: classItems, progress, own, enrolledAt: c.enrolledAt, lastActivity: latest, termEnd: end });
        return { cls: c, prediction, context, termEnd: end };
      }),
  );
  const outlook = forecasts.map(({ cls, prediction, termEnd: end }) => ({
    classId: cls.id,
    subjectCode: cls.subjectCode,
    subjectName: cls.subjectName,
    termEnd: end,
    status: prediction.predictedRisk === 'HIGH' ? 'AT_RISK' : prediction.predictedRisk === 'MODERATE' ? 'NEEDS_ATTENTION' : 'ON_TRACK',
    predictedScore: prediction.predictedScore,
    scoreLow: prediction.scoreLow,
    scoreHigh: prediction.scoreHigh,
    projectedCompletion: prediction.projectedCompletion,
    projectedFinish: prediction.projectedFinish,
    onTrack: prediction.onTrack,
    pacePerWeek: prediction.pacePerWeek,
    confidence: prediction.confidence,
    factors: prediction.factors,
  }));
  const recommendations = forecasts
    .flatMap(({ cls, context }) => studentRecommendations(context).map((r) => ({ ...r, classId: cls.id, subjectCode: cls.subjectCode })))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);

  return {
    ...overall,
    outlook,
    recommendations,
    lessonsDone: progress.lessonsDone.size,
    lastActivity: progress.lastActivity,
    classes: classes.map((c) => ({ id: c.id, subjectCode: c.subjectCode, subjectName: c.subjectName, section: c.section, completion: c.completion })),
    recent,
    trend: weeklyTrend(activity, STUDENT_TREND_WEEKS),
    quizScores: scoreHistory.reverse().map((a) => ({
      title: a.quiz.title,
      at: a.submittedAt,
      pct: Math.round((a.score / Math.max(a.total, 1)) * 100),
    })),
  };
}
