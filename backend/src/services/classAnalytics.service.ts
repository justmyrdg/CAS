import { prisma } from '../config/prisma';
import { fullName } from '../utils/fullName';
import { presentBlocks } from '../utils/lessonBlocks';
import { ApiError } from '../utils/ApiError';
import { trendStart, weeklyTrend } from '../utils/activityTrend';
import type { TrendWeek } from '../utils/activityTrend';
import { getClass } from './classes.service';
import { assessRisk, loadOutline, loadProgress, outlineItems, summarize } from './progress.service';
import type { OutlineModule, StudentProgress } from './progress.service';

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
// submission with essays still to grade doesn't count yet) and which closed ones they missed; per assessment, how
// the class did. Students who joined after one closed aren't counted as missing it.
async function loadAssessmentStats(classId: string, enrollments: { studentId: string; createdAt: Date }[]) {
  const assessments = await prisma.assessment.findMany({
    where: { classId, published: true },
    select: {
      id: true,
      title: true,
      kind: true,
      closesAt: true,
      attempts: {
        where: { submittedAt: { not: null }, studentId: { in: enrollments.map((e) => e.studentId) } },
        select: { studentId: true, score: true, maxScore: true, needsGrading: true, submittedAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const now = Date.now();
  const bestPct = (attempts: { score: number | null; maxScore: number; needsGrading: boolean }[]) => {
    const graded = attempts.filter((t) => !t.needsGrading && t.score !== null).map((t) => Math.round(((t.score as number) / Math.max(t.maxScore, 1)) * 100));
    return graded.length ? Math.max(...graded) : null;
  };

  const perStudent = new Map(
    enrollments.map((e) => {
      const scores: number[] = [];
      let taken = 0;
      let missedExams = 0;
      let missedQuizzes = 0;
      let lastSubmission: Date | null = null;
      for (const a of assessments) {
        const mine = a.attempts.filter((t) => t.studentId === e.studentId);
        if (mine.length) {
          taken += 1;
          const best = bestPct(mine);
          if (best !== null) scores.push(best);
          for (const t of mine) if (t.submittedAt && (!lastSubmission || t.submittedAt > lastSubmission)) lastSubmission = t.submittedAt;
        } else if (a.closesAt && a.closesAt.getTime() < now && e.createdAt < a.closesAt) {
          if (a.kind === 'EXAM') missedExams += 1;
          else missedQuizzes += 1;
        }
      }
      return [e.studentId, { average: avg(scores), taken, missedExams, missedQuizzes, lastSubmission }] as const;
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
  const submissions = assessments.flatMap((a) => a.attempts.map((t) => t.submittedAt as Date));
  return { perStudent, summary, submissions };
}

const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

// Per-student stats plus at-risk assessment, and class-wide performance.
export async function getAnalytics(classId: string, instructorId: string | null) {
  const { enrollments, outline, items, progress } = await loadClassData(classId, instructorId);
  const assessments = await loadAssessmentStats(classId, enrollments);
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
      if (average !== null && (!lowestTopic || average < lowestTopic.average)) {
        lowestTopic = { moduleTitle: m.title, chapterTitle: c.title, average };
      }
    }
  }

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
    lowestTopic,
    riskCounts: {
      HIGH: students.filter((s) => s.risk === 'HIGH').length,
      MODERATE: students.filter((s) => s.risk === 'MODERATE').length,
      LOW: students.filter((s) => s.risk === 'LOW').length,
    },
    students,
  };
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
    })),
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
