import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { fullName } from '../utils/fullName';
import { SCORE_BANDS, bandCounts, trendStart, weeklyTrend } from '../utils/activityTrend';
import { getAnalytics, topRecommendations } from './classAnalytics.service';

// Institution-wide views for admins/deans: dashboard counts, every class,
// every quiz, and the reports page.

const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);
const instructorName = { select: { firstName: true, middleName: true, lastName: true, prefix: true } } as const;

// ---------- Dashboard ----------

export async function getDashboard() {
  const [subjects, modules, lessons, quizzes, activeClasses, instructors, students, recentClasses, recentSubjects, recentAttempts] =
    await prisma.$transaction([
      prisma.subject.count(),
      prisma.module.count(),
      prisma.contentItem.count({ where: { type: 'LESSON' } }),
      prisma.contentItem.count({ where: { type: 'QUIZ' } }),
      prisma.class.count({ where: { isArchived: false } }),
      prisma.user.count({ where: { role: 'INSTRUCTOR', isActive: true } }),
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.class.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { subjectCode: true, section: true, createdAt: true, instructor: instructorName },
      }),
      prisma.subject.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { code: true, name: true, createdAt: true } }),
      prisma.quizAttempt.findMany({
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: { submittedAt: true, score: true, total: true, quiz: { select: { title: true } }, student: instructorName },
      }),
    ]);

  const activity = [
    ...recentClasses.map((c) => ({
      text: `${fullName(c.instructor)} created ${c.subjectCode} · Section ${c.section}`,
      at: c.createdAt,
    })),
    ...recentSubjects.map((s) => ({ text: `Subject ${s.code} — ${s.name} was added`, at: s.createdAt })),
    ...recentAttempts.map((a) => ({
      text: `${fullName(a.student)} scored ${a.score}/${a.total} on “${a.quiz.title}”`,
      at: a.submittedAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return { counts: { subjects, modules, lessons, quizzes, activeClasses, instructors, students }, activity, ...(await dashboardCharts()) };
}

// Chart data: weekly learning activity and module-quiz score bands.
async function dashboardCharts() {
  const since = trendStart();
  const [completions, attempts, submissions, scores] = await prisma.$transaction([
    prisma.lessonCompletion.findMany({ where: { completedAt: { gte: since } }, select: { completedAt: true } }),
    prisma.quizAttempt.findMany({ where: { submittedAt: { gte: since } }, select: { submittedAt: true } }),
    prisma.assessmentAttempt.findMany({ where: { submittedAt: { gte: since } }, select: { submittedAt: true } }),
    prisma.quizAttempt.findMany({ select: { score: true, total: true } }),
  ]);
  const trend = weeklyTrend([
    ...completions.map((c) => ({ at: c.completedAt, kind: 'lessons' as const })),
    ...attempts.map((a) => ({ at: a.submittedAt, kind: 'quizzes' as const })),
    ...submissions.map((a) => ({ at: a.submittedAt as Date, kind: 'assessments' as const })),
  ]);
  return {
    trend,
    scoreBands: bandCounts(
      scores.map((a) => Math.round((a.score / Math.max(a.total, 1)) * 100)),
      SCORE_BANDS,
    ),
  };
}

// ---------- All classes ----------

export interface ListClassesOptions {
  page: number;
  pageSize: number;
  search?: string;
  status: 'all' | 'active' | 'archived';
}

export async function listAllClasses({ page, pageSize, search, status }: ListClassesOptions) {
  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.ClassWhereInput = {
    ...(status !== 'all' && { isArchived: status === 'archived' }),
    ...(search && {
      OR: [
        { subjectCode: contains },
        { subjectName: contains },
        { section: contains },
        { joinCode: contains },
        { instructor: { OR: [{ firstName: contains }, { lastName: contains }] } },
      ],
    }),
  };
  const [classes, total] = await prisma.$transaction([
    prisma.class.findMany({
      where,
      orderBy: [{ isArchived: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { instructor: instructorName, _count: { select: { enrollments: true } } },
    }),
    prisma.class.count({ where }),
  ]);
  return {
    classes: classes.map(({ instructor, _count, ...c }) => ({
      ...c,
      instructorName: fullName(instructor),
      studentCount: _count.enrollments,
    })),
    total,
  };
}

// ---------- Assessments (every quiz) ----------

export async function listAssessments({ page, pageSize, search }: { page: number; pageSize: number; search?: string }) {
  const contains = { contains: search, mode: 'insensitive' as const };
  const where: Prisma.ContentItemWhereInput = {
    type: 'QUIZ',
    ...(search && {
      OR: [
        { title: contains },
        { chapter: { title: contains } },
        { chapter: { module: { subject: { OR: [{ code: contains }, { name: contains }] } } } },
      ],
    }),
  };
  const [quizzes, total] = await prisma.$transaction([
    prisma.contentItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: { select: { questions: true } },
        chapter: { select: { title: true, module: { select: { title: true, subject: { select: { id: true, code: true } } } } } },
      },
    }),
    prisma.contentItem.count({ where }),
  ]);

  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) } },
    select: { quizId: true, studentId: true, score: true, total: true },
  });

  return {
    total,
    assessments: quizzes.map((q) => {
      const mine = attempts.filter((a) => a.quizId === q.id);
      return {
        id: q.id,
        title: q.title,
        questionCount: q._count.questions,
        subjectId: q.chapter.module.subject.id,
        subjectCode: q.chapter.module.subject.code,
        moduleTitle: q.chapter.module.title,
        chapterTitle: q.chapter.title,
        attempts: mine.length,
        students: new Set(mine.map((a) => a.studentId)).size,
        averageScore: avg(mine.map((a) => Math.round((a.score / Math.max(a.total, 1)) * 100))),
        updatedAt: q.updatedAt,
      };
    }),
  };
}

// ---------- Reports ----------

// Institution overview built from every active class's analytics.
export async function getReports() {
  const activeClasses = await prisma.class.findMany({
    where: { isArchived: false },
    select: { id: true, subjectId: true, subjectCode: true, subjectName: true, section: true, instructor: instructorName },
  });
  const perClass = await Promise.all(activeClasses.map(async (c) => ({ cls: c, analytics: await getAnalytics(c.id, null) })));

  const allStudents = perClass.flatMap((p) => p.analytics.students);
  const distinct = new Set(allStudents.map((s) => s.studentId));
  const atRisk = new Map<string, (typeof allStudents)[number] & { classLabel: string }>();
  for (const { cls, analytics } of perClass) {
    for (const s of analytics.students) {
      if (s.risk === 'HIGH' && !atRisk.has(`${s.studentId}:${cls.id}`)) {
        atRisk.set(`${s.studentId}:${cls.id}`, { ...s, classLabel: `${cls.subjectCode} · Section ${cls.section}` });
      }
    }
  }

  // Per subject: classes running, students, average completion and quiz score.
  const bySubject = new Map<string, { code: string; name: string; classes: number; completions: number[]; scores: number[]; students: Set<string> }>();
  for (const { cls, analytics } of perClass) {
    const key = cls.subjectId ?? cls.subjectCode;
    const row = bySubject.get(key) ?? { code: cls.subjectCode, name: cls.subjectName, classes: 0, completions: [], scores: [], students: new Set() };
    row.classes += 1;
    for (const s of analytics.students) {
      row.completions.push(s.completion);
      if (s.quizAverage !== null) row.scores.push(s.quizAverage);
      row.students.add(s.studentId);
    }
    bySubject.set(key, row);
  }

  // Quizzes students find hard: average best score under 60% with at least 3 attempts.
  const quizStats = await prisma.quizAttempt.groupBy({ by: ['quizId'], _count: { _all: true }, _avg: { score: true, total: true } });
  const hardIds = quizStats
    .filter((q) => q._count._all >= 3 && (q._avg.total ?? 0) > 0 && (q._avg.score ?? 0) / (q._avg.total ?? 1) < 0.6)
    .map((q) => q.quizId);
  const hardQuizzes = await prisma.contentItem.findMany({
    where: { id: { in: hardIds } },
    select: { id: true, title: true, chapter: { select: { title: true, module: { select: { subject: { select: { code: true } } } } } } },
  });

  const flagged = [
    ...[...atRisk.values()].map((s) => ({
      kind: 'STUDENT' as const,
      title: `${s.name} — ${s.classLabel}`,
      detail: s.reasons.join(' · '),
      tag: 'High risk',
    })),
    ...hardQuizzes.map((q) => {
      const stat = quizStats.find((s) => s.quizId === q.id)!;
      const pct = Math.round(((stat._avg.score ?? 0) / Math.max(stat._avg.total ?? 1, 1)) * 100);
      return {
        kind: 'QUIZ' as const,
        title: `“${q.title}” — ${q.chapter.module.subject.code} · ${q.chapter.title}`,
        detail: `Average ${pct}% over ${stat._count._all} attempts`,
        tag: 'Hard quiz',
      };
    }),
  ];

  return {
    // Every enrollment in an active class, by risk level and by how far through the subject the student is.
    riskCounts: {
      HIGH: allStudents.filter((s) => s.risk === 'HIGH').length,
      MODERATE: allStudents.filter((s) => s.risk === 'MODERATE').length,
      LOW: allStudents.filter((s) => s.risk === 'LOW').length,
    },
    completionBands: bandCounts(
      allStudents.map((s) => s.completion),
      [
        [0, 24],
        [25, 49],
        [50, 74],
        [75, 99],
        [100, 100],
      ],
    ),
    classes: perClass
      .map(({ cls, analytics }) => ({
        id: cls.id,
        label: `${cls.subjectCode} · ${cls.section}`,
        instructorName: fullName(cls.instructor),
        students: analytics.studentCount,
        completion: analytics.completionRate,
        averageScore: analytics.averageScore,
        predictedAverage: analytics.forecast.predictedAverage,
        projectedCompletion: analytics.forecast.projectedCompletion,
        predictedToFail: analytics.forecast.riskCounts.HIGH,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    // Predictive: where every active class is heading by the end of term.
    forecast: {
      predictedAverage: avg(allStudents.map((s) => s.prediction.predictedScore).filter((v): v is number => v !== null)),
      projectedCompletion: avg(allStudents.map((s) => s.prediction.projectedCompletion)),
      riskCounts: {
        HIGH: allStudents.filter((s) => s.prediction.predictedRisk === 'HIGH').length,
        MODERATE: allStudents.filter((s) => s.prediction.predictedRisk === 'MODERATE').length,
        LOW: allStudents.filter((s) => s.prediction.predictedRisk === 'LOW').length,
      },
    },
    // Prescriptive: the most urgent actions across all classes.
    recommendations: topRecommendations(
      perClass.map(({ cls, analytics }) => ({ id: cls.id, label: `${cls.subjectCode} · Section ${cls.section}`, recommendations: analytics.recommendations })),
      8,
    ),
    stats: {
      activeClasses: activeClasses.length,
      enrolledStudents: distinct.size,
      averageCompletion: avg(allStudents.map((s) => s.completion)),
      averageScore: avg(allStudents.map((s) => s.quizAverage).filter((v): v is number => v !== null)),
      atRiskStudents: new Set([...atRisk.values()].map((s) => s.studentId)).size,
    },
    subjects: [...bySubject.values()]
      .map((r) => ({
        code: r.code,
        name: r.name,
        classes: r.classes,
        students: r.students.size,
        averageCompletion: avg(r.completions),
        averageScore: avg(r.scores),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    flagged,
  };
}
