import { prisma } from '../config/prisma';
import { fullName } from '../utils/fullName';
import { presentBlocks } from '../utils/lessonBlocks';
import { ApiError } from '../utils/ApiError';
import { SCORE_BANDS, bandCounts, trendStart, weeklyTrend } from '../utils/activityTrend';
import type { TrendWeek } from '../utils/activityTrend';
import { presentQuestions } from '../utils/assessmentQuestions';
import type { QuestionResult } from '../utils/assessmentQuestions';
import { predictStudent, termEnd as termEndOf } from '../utils/predictive';
import type { Prediction } from '../utils/predictive';
import { classRecommendations, studentActions } from '../utils/prescriptive';
import type { Recommendation, StudentContext } from '../utils/prescriptive';
import { getClass } from './classes.service';
import { assessRisk, isItemDone, loadOutline, loadProgress, outlineItems, summarize } from './progress.service';
import type { OutlineItem, OutlineModule, StudentProgress } from './progress.service';

// Instructor-facing numbers for one class, computed from its enrolled
// students' lesson completions and quiz attempts (see progress.service for the rules).

const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

// instructorId scopes the lookup to that instructor's classes; null (admins) reads any class.
async function loadClassData(classId: string, instructorId: string | null) {
  const cls = instructorId
    ? await getClass(classId, instructorId)
    : await prisma.class.findUnique({ where: { id: classId } }).then((c) => {
        if (!c) throw ApiError.notFound('Class not found');
        return c;
      });
  const enrollments = await prisma.enrollment.findMany({
    where: { classId },
    include: { student: { select: { id: true, firstName: true, middleName: true, lastName: true, prefix: true, srCode: true } } },
  });
  const outline: OutlineModule[] = cls.subjectId ? await loadOutline(cls.subjectId) : [];
  const items = outlineItems(outline);
  const progress = await loadProgress(
    enrollments.map((e) => e.studentId),
    items.map((i) => i.id),
  );
  return { cls, enrollments, outline, items, progress };
}

// The instructor's own quizzes & exams for the class: per student, their best fully-graded score on each (a
// submission with essays still to grade doesn't count yet), which closed ones they missed and which open ones they
// haven't taken; per assessment, how the class did and how often each question was answered correctly. Students who
// joined after one closed aren't counted as missing it.
export async function loadAssessmentStats(classId: string, enrollments: { studentId: string; createdAt: Date }[]) {
  const assessments = await prisma.assessment.findMany({
    where: { classId, published: true },
    select: {
      id: true,
      title: true,
      kind: true,
      opensAt: true,
      closesAt: true,
      questions: true,
      attempts: {
        where: { submittedAt: { not: null }, studentId: { in: enrollments.map((e) => e.studentId) } },
        select: { studentId: true, score: true, maxScore: true, needsGrading: true, submittedAt: true, results: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const now = Date.now();
  const isOpen = (a: { opensAt: Date | null; closesAt: Date | null }) => (!a.opensAt || a.opensAt.getTime() <= now) && (!a.closesAt || a.closesAt.getTime() > now);
  const bestPct = (attempts: { score: number | null; maxScore: number; needsGrading: boolean }[]) => {
    const graded = attempts.filter((t) => !t.needsGrading && t.score !== null).map((t) => Math.round(((t.score as number) / Math.max(t.maxScore, 1)) * 100));
    return graded.length ? Math.max(...graded) : null;
  };

  const perStudent = new Map(
    enrollments.map((e) => {
      const scores: { pct: number; at: Date }[] = [];
      const openNotTaken: { title: string; kind: 'QUIZ' | 'EXAM'; closesAt: Date | null }[] = [];
      let taken = 0;
      let missedExams = 0;
      let missedQuizzes = 0;
      let lastSubmission: Date | null = null;
      for (const a of assessments) {
        const mine = a.attempts.filter((t) => t.studentId === e.studentId);
        if (mine.length) {
          taken += 1;
          const best = bestPct(mine);
          const first = mine.reduce((d, t) => (t.submittedAt && t.submittedAt < d ? t.submittedAt : d), mine[0].submittedAt as Date);
          if (best !== null) scores.push({ pct: best, at: first });
          for (const t of mine) if (t.submittedAt && (!lastSubmission || t.submittedAt > lastSubmission)) lastSubmission = t.submittedAt;
        } else if (a.closesAt && a.closesAt.getTime() < now && e.createdAt < a.closesAt) {
          if (a.kind === 'EXAM') missedExams += 1;
          else missedQuizzes += 1;
        } else if (isOpen(a)) {
          openNotTaken.push({ title: a.title, kind: a.kind, closesAt: a.closesAt });
        }
      }
      const average = scores.length ? Math.round(scores.reduce((sum, x) => sum + x.pct, 0) / scores.length) : null;
      return [e.studentId, { average, scores, taken, missedExams, missedQuizzes, openNotTaken, lastSubmission }] as const;
    }),
  );

  const summary = assessments.map((a) => {
    const students = [...new Set(a.attempts.map((t) => t.studentId))];
    const bests = students.map((id) => bestPct(a.attempts.filter((t) => t.studentId === id))).filter((v): v is number => v !== null);
    return {
      id: a.id,
      title: a.title,
      kind: a.kind,
      closesAt: a.closesAt,
      submitted: students.length,
      average: avg(bests),
      toGrade: a.attempts.filter((t) => t.needsGrading).length,
    };
  });

  // Item analysis: the share of the points students earned on each graded question.
  const hardQuestions = assessments.flatMap((a) =>
    presentQuestions(a.questions).map((q) => {
      const rates = a.attempts
        .map((t) => (t.results as Record<string, QuestionResult> | null)?.[q.id])
        .filter((r): r is QuestionResult => Boolean(r?.graded))
        .map((r) => r.points / Math.max(q.points, 1));
      return { assessmentTitle: a.title, prompt: q.prompt, responses: rates.length, correctRate: rates.length ? Math.round((rates.reduce((x, y) => x + y, 0) / rates.length) * 100) : 100 };
    }),
  );
  const open = assessments.filter(isOpen).map((a) => ({ title: a.title, closesAt: a.closesAt, notTaken: enrollments.length - new Set(a.attempts.map((t) => t.studentId)).size }));
  const submissions = assessments.flatMap((a) => a.attempts.map((t) => t.submittedAt as Date));
  return { perStudent, summary, submissions, hardQuestions, open, essaysToGrade: summary.reduce((n, a) => n + a.toGrade, 0) };
}

export type AssessmentStats = Awaited<ReturnType<typeof loadAssessmentStats>>;

// The forecast for one student in one class (utils/predictive.ts) and the facts the recommendations need
// (utils/prescriptive.ts). Shared by the instructor analytics and the student app.
export function forecastStudent(input: {
  outline: OutlineModule[];
  items: OutlineItem[];
  progress: StudentProgress;
  own: AssessmentStats['perStudent'] extends Map<string, infer V> ? V | undefined : never;
  enrolledAt: Date;
  lastActivity: Date | null;
  termEnd: Date;
}): { prediction: Prediction; context: StudentContext } {
  const { outline, items, progress: p, own } = input;
  const stats = summarize(items, p);
  const quizChapter = new Map(outline.flatMap((m) => m.chapters.flatMap((c) => c.items.filter((i) => i.type === 'QUIZ').map((i) => [i.id, c.title] as const))));
  const quizBests = items
    .filter((i) => i.type === 'QUIZ')
    .map((i) => ({ item: i, best: p.quizzes.get(i.id) }))
    .filter((x): x is { item: OutlineItem; best: NonNullable<typeof x.best> } => Boolean(x.best));
  const pctOf = (b: { score: number; total: number }) => Math.round((b.score / Math.max(b.total, 1)) * 100);
  const prediction = predictStudent({
    itemsDone: stats.itemsDone,
    itemsTotal: stats.itemsTotal,
    doneDates: [...items.filter((i) => i.type === 'LESSON').map((i) => p.lessonsDone.get(i.id)), ...quizBests.map((q) => q.best.firstAt)].filter((d): d is Date => Boolean(d)),
    quizScores: quizBests.map((q) => ({ pct: pctOf(q.best), at: q.best.firstAt })),
    assessmentScores: own?.scores ?? [],
    missedExams: own?.missedExams ?? 0,
    missedQuizzes: own?.missedQuizzes ?? 0,
    enrolledAt: input.enrolledAt,
    termEnd: input.termEnd,
  });
  const next = items.find((i) => !isItemDone(i, p));
  return {
    prediction,
    context: {
      prediction,
      itemsDone: stats.itemsDone,
      itemsTotal: stats.itemsTotal,
      termEnd: input.termEnd,
      lastActivity: input.lastActivity,
      nextItem: next ? { title: next.title, type: next.type } : null,
      weakQuizzes: quizBests.map((q) => ({ chapterTitle: quizChapter.get(q.item.id) ?? q.item.title, pct: pctOf(q.best) })).filter((q) => q.pct < 75),
      openAssessments: own?.openNotTaken ?? [],
      missedExams: own?.missedExams ?? 0,
    },
  };
}

// Class completion week by week: what actually happened up to now, then the projection to the end of term if every
// student keeps their current pace.
function completionSeries(students: { doneDates: Date[]; itemsDone: number; pace: number }[], itemsTotal: number, termEnd: Date) {
  const WEEK = 7 * 86_400_000;
  const now = Date.now();
  const firstWeek = trendStart().getTime();
  const out: { weekStart: string; actual: number | null; projected: number | null }[] = [];
  if (!students.length || !itemsTotal) return out;
  const pct = (v: number) => Math.round(v);
  for (let t = firstWeek; t <= Math.max(termEnd.getTime(), now); t += WEEK) {
    const weekEnd = Math.min(t + WEEK, now);
    const isPast = t <= now;
    const current = isPast && t + WEEK > now;
    const actual = isPast
      ? pct((students.reduce((sum, s) => sum + s.doneDates.filter((d) => d.getTime() <= weekEnd).length, 0) / (students.length * itemsTotal)) * 100)
      : null;
    const weeksAhead = (t + WEEK - now) / WEEK;
    const projected =
      !isPast || current
        ? pct((students.reduce((sum, s) => sum + Math.min(itemsTotal, s.itemsDone + s.pace * Math.max(weeksAhead, 0)), 0) / (students.length * itemsTotal)) * 100)
        : null;
    out.push({ weekStart: new Date(t).toISOString().slice(0, 10), actual, projected });
  }
  return out;
}

const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

// Per-student stats plus at-risk assessment, and class-wide performance.
export async function getAnalytics(classId: string, instructorId: string | null) {
  const { cls, enrollments, outline, items, progress } = await loadClassData(classId, instructorId);
  const assessments = await loadAssessmentStats(classId, enrollments);
  const termEnd = termEndOf(cls.term, cls.schoolYear);
  const quizIds = items.filter((i) => i.type === 'QUIZ').map((i) => i.id);
  const quizTimes =
    quizIds.length && enrollments.length
      ? await prisma.quizAttempt.findMany({
          where: { studentId: { in: enrollments.map((e) => e.studentId) }, quizId: { in: quizIds }, submittedAt: { gte: trendStart() } },
          select: { submittedAt: true },
        })
      : [];
  // Weekly activity of this class's students on this class's content.
  const trend: TrendWeek[] = weeklyTrend([
    ...[...progress.values()].flatMap((p) => [...p.lessonsDone.values()].map((at) => ({ at, kind: 'lessons' as const }))),
    ...quizTimes.map((a) => ({ at: a.submittedAt, kind: 'quizzes' as const })),
    ...assessments.submissions.map((at) => ({ at, kind: 'assessments' as const })),
  ]);

  const perStudent = enrollments.map((e) => {
    const p = progress.get(e.studentId) as StudentProgress;
    return { enrollment: e, progress: p, stats: summarize(items, p) };
  });
  const classAverageCompletion = avg(perStudent.map((s) => s.stats.completion)) ?? 0;

  const students = perStudent
    .map(({ enrollment, progress: p, stats }) => {
      const own = assessments.perStudent.get(enrollment.studentId);
      // Submitting a quiz or exam counts as activity too.
      const lastActivity = later(p.lastActivity, own?.lastSubmission ?? null);
      const { prediction, context } = forecastStudent({
        outline,
        items,
        progress: p,
        own,
        enrolledAt: enrollment.createdAt,
        lastActivity,
        termEnd,
      });
      const risk = assessRisk({
        quizAverage: stats.quizAverage,
        assessmentAverage: own?.average ?? null,
        missedExams: own?.missedExams ?? 0,
        missedQuizzes: own?.missedQuizzes ?? 0,
        completion: stats.completion,
        classAverageCompletion,
        lastActivity,
        enrolledAt: enrollment.createdAt,
      });
      return {
        studentId: enrollment.studentId,
        name: fullName(enrollment.student),
        srCode: enrollment.student.srCode,
        completion: stats.completion,
        itemsDone: stats.itemsDone,
        quizAverage: stats.quizAverage,
        quizzesTaken: stats.quizzesTaken,
        assessmentAverage: own?.average ?? null,
        assessmentsTaken: own?.taken ?? 0,
        lastActivity,
        risk: risk.level,
        reasons: risk.reasons,
        // Predictive: the forecast to the end of term. Prescriptive: what the instructor could do.
        prediction,
        actions: studentActions(context),
        // When each item was finished (progress is loaded for this class's items only) — for the completion chart.
        doneDates: [...p.lessonsDone.values(), ...[...p.quizzes.values()].map((q) => q.firstAt)],
      };
    })
    .sort((a, b) => ['HIGH', 'MODERATE', 'LOW'].indexOf(a.risk) - ['HIGH', 'MODERATE', 'LOW'].indexOf(b.risk) || a.name.localeCompare(b.name));

  // Module completion = average over students of their completion within that module.
  const modules = outline.map((m) => {
    const moduleItems = m.chapters.flatMap((c) => c.items);
    return {
      id: m.id,
      title: m.title,
      itemsTotal: moduleItems.length,
      completion: avg(perStudent.map((s) => summarize(moduleItems, s.progress).completion)) ?? 0,
    };
  });

  // Weakest chapter = lowest average best-score across its quizzes, among chapters students have attempted.
  let lowestTopic: { moduleTitle: string; chapterTitle: string; average: number } | null = null;
  const chapterAverages: { title: string; average: number; students: number }[] = [];
  for (const m of outline) {
    for (const c of m.chapters) {
      const scores = c.items
        .filter((i) => i.type === 'QUIZ')
        .flatMap((q) =>
          perStudent
            .map((s) => s.progress.quizzes.get(q.id))
            .filter((best): best is NonNullable<typeof best> => Boolean(best))
            .map((best) => Math.round((best.score / Math.max(best.total, 1)) * 100)),
        );
      const average = avg(scores);
      if (average !== null) chapterAverages.push({ title: c.title, average, students: scores.length });
      if (average !== null && (!lowestTopic || average < lowestTopic.average)) {
        lowestTopic = { moduleTitle: m.title, chapterTitle: c.title, average };
      }
    }
  }

  const predictions = students.map((s) => s.prediction);
  const forecast = {
    termEnd,
    predictedAverage: avg(predictions.map((p) => p.predictedScore).filter((v): v is number => v !== null)),
    projectedCompletion: avg(predictions.map((p) => p.projectedCompletion)),
    onTrack: predictions.filter((p) => p.onTrack).length,
    riskCounts: {
      HIGH: predictions.filter((p) => p.predictedRisk === 'HIGH').length,
      MODERATE: predictions.filter((p) => p.predictedRisk === 'MODERATE').length,
      LOW: predictions.filter((p) => p.predictedRisk === 'LOW').length,
    },
    scoreBands: bandCounts(
      predictions.map((p) => p.predictedScore).filter((v): v is number => v !== null),
      SCORE_BANDS,
    ),
    completion: completionSeries(
      students.map((s) => ({ doneDates: s.doneDates, itemsDone: s.itemsDone, pace: s.prediction.pacePerWeek })),
      items.length,
      termEnd,
    ),
  };
  const recommendations = classRecommendations({
    studentCount: enrollments.length,
    predictedHigh: students.filter((s) => s.prediction.predictedRisk === 'HIGH').map((s) => ({ name: s.name })),
    notOnTrack: predictions.filter((p) => !p.onTrack).length,
    weakChapters: chapterAverages,
    hardQuestions: assessments.hardQuestions,
    openAssessments: assessments.open,
    essaysToGrade: assessments.essaysToGrade,
    termEnd,
  });

  return {
    studentCount: enrollments.length,
    itemsTotal: items.length,
    averageScore: avg(perStudent.map((s) => s.stats.quizAverage).filter((v): v is number => v !== null)),
    completionRate: enrollments.length ? classAverageCompletion : null,
    // The instructor's own quizzes & exams.
    assessmentAverage: avg(students.map((s) => s.assessmentAverage).filter((v): v is number => v !== null)),
    assessments: assessments.summary,
    modules,
    trend,
    forecast,
    recommendations,
    lowestTopic,
    riskCounts: {
      HIGH: students.filter((s) => s.risk === 'HIGH').length,
      MODERATE: students.filter((s) => s.risk === 'MODERATE').length,
      LOW: students.filter((s) => s.risk === 'LOW').length,
    },
    students: students.map(({ doneDates: _dates, ...s }) => s),
  };
}

// The most urgent class recommendations across several classes, each tagged with its class.
export function topRecommendations(classes: { id: string; label: string; recommendations: Recommendation[] }[], limit: number) {
  return classes
    .flatMap((c) => c.recommendations.filter((r) => r.kind !== 'ON_TRACK').map((r) => ({ ...r, classId: c.id, classLabel: c.label })))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}

// Dashboard numbers across an instructor's active classes: average quiz score over
// all their students, and how many distinct students are flagged high/moderate risk.
export async function getInstructorOverview(instructorId: string) {
  const classes = await prisma.class.findMany({
    where: { instructorId, isArchived: false },
    select: { id: true, subjectCode: true, section: true },
    orderBy: [{ subjectCode: 'asc' }, { section: 'asc' }],
  });
  const analytics = await Promise.all(classes.map((c) => getAnalytics(c.id, instructorId)));
  const students = analytics.flatMap((a) => a.students);
  const trend = weeklyTrend([]).map((w, i) => ({
    ...w,
    lessons: analytics.reduce((n, a) => n + a.trend[i].lessons, 0),
    quizzes: analytics.reduce((n, a) => n + a.trend[i].quizzes, 0),
    assessments: analytics.reduce((n, a) => n + a.trend[i].assessments, 0),
  }));
  return {
    averageScore: avg(students.map((s) => s.quizAverage).filter((v): v is number => v !== null)),
    atRiskStudents: new Set(students.filter((s) => s.risk !== 'LOW').map((s) => s.studentId)).size,
    // Chart data across the instructor's active classes.
    trend,
    riskCounts: {
      HIGH: students.filter((s) => s.risk === 'HIGH').length,
      MODERATE: students.filter((s) => s.risk === 'MODERATE').length,
      LOW: students.filter((s) => s.risk === 'LOW').length,
    },
    classes: classes.map((c, i) => ({
      id: c.id,
      label: `${c.subjectCode} · ${c.section}`,
      students: analytics[i].studentCount,
      completion: analytics[i].completionRate,
      averageScore: analytics[i].averageScore,
      assessmentAverage: analytics[i].assessmentAverage,
      predictedAverage: analytics[i].forecast.predictedAverage,
      projectedCompletion: analytics[i].forecast.projectedCompletion,
    })),
    // Predictive: distinct students forecast likely to fail. Prescriptive: the most urgent actions across classes.
    predictedToFail: new Set(students.filter((s) => s.prediction.predictedRisk === 'HIGH').map((s) => s.studentId)).size,
    recommendations: topRecommendations(classes.map((c, i) => ({ id: c.id, label: `${c.subjectCode} · ${c.section}`, recommendations: analytics[i].recommendations })), 6),
  };
}

// The class's subject content (read-only) with how the class is doing on each lesson/quiz.
export async function getContent(classId: string, instructorId: string) {
  const { cls, enrollments, outline, progress } = await loadClassData(classId, instructorId);
  const students = enrollments.map((e) => progress.get(e.studentId) as StudentProgress);

  return {
    subjectId: cls.subjectId,
    studentCount: enrollments.length,
    modules: outline.map((m) => ({
      ...m,
      chapters: m.chapters.map((c) => ({
        ...c,
        items: c.items.map((item) => {
          if (item.type === 'LESSON') {
            return { ...item, studentsDone: students.filter((p) => p.lessonsDone.has(item.id)).length, averageScore: null };
          }
          const bests = students.map((p) => p.quizzes.get(item.id)).filter((b): b is NonNullable<typeof b> => Boolean(b));
          return {
            ...item,
            studentsDone: bests.length,
            averageScore: avg(bests.map((b) => Math.round((b.score / Math.max(b.total, 1)) * 100))),
          };
        }),
      })),
    })),
  };
}

// A single lesson or quiz from the class's subject, for the instructor to read (quizzes include answers).
export async function getContentItem(classId: string, instructorId: string, itemId: string) {
  const cls = await getClass(classId, instructorId);
  const item = await prisma.contentItem.findFirst({
    where: { id: itemId, chapter: { module: { subjectId: cls.subjectId ?? '__none__' } } },
    include: {
      questions: { orderBy: { position: 'asc' } },
      chapter: { select: { title: true } },
      arModel: { select: { name: true } },
    },
  });
  if (!item) return null;
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    blocks: presentBlocks(item.blocks),
    arModel: item.arModel ? { name: item.arModel.name } : null,
    chapterTitle: item.chapter.title,
    questions: item.questions.map((q) => ({ prompt: q.prompt, choices: q.choices, correctChoice: q.correctChoice })),
  };
}
