import type { ContentType } from '@prisma/client';
import { prisma } from '../config/prisma';

// Progress math shared by the student app (what's done / unlocked) and the
// instructor's Performance and At-Risk views.
//
// Rules:
// - A lesson is done once the student marks it complete; a quiz is done once it
//   has at least one attempt, and its BEST attempt is the one that counts.
// - Chapters unlock in order across the whole subject (module order, then
//   chapter order): a chapter opens once every item in all earlier chapters is done.

export interface OutlineItem {
  id: string;
  type: ContentType;
  title: string;
  questionCount: number;
}

export interface OutlineChapter {
  id: string;
  title: string;
  description: string | null;
  items: OutlineItem[];
}

export interface OutlineModule {
  id: string;
  title: string;
  description: string | null;
  chapters: OutlineChapter[];
}

export async function loadOutline(subjectId: string): Promise<OutlineModule[]> {
  const modules = await prisma.module.findMany({
    where: { subjectId },
    orderBy: { position: 'asc' },
    include: {
      chapters: {
        orderBy: { position: 'asc' },
        include: {
          items: {
            orderBy: { position: 'asc' },
            select: { id: true, type: true, title: true, _count: { select: { questions: true } } },
          },
        },
      },
    },
  });
  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    chapters: m.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      items: c.items.map((i) => ({ id: i.id, type: i.type, title: i.title, questionCount: i._count.questions })),
    })),
  }));
}

export function outlineItems(outline: OutlineModule[]): OutlineItem[] {
  return outline.flatMap((m) => m.chapters.flatMap((c) => c.items));
}

export interface QuizBest {
  score: number;
  total: number;
  attempts: number;
  firstAt: Date;
  lastAt: Date;
}

export interface StudentProgress {
  lessonsDone: Map<string, Date>;
  quizzes: Map<string, QuizBest>;
  lastActivity: Date | null;
}

// Loads completions and quiz attempts for the given students, limited to the given items.
export async function loadProgress(studentIds: string[], itemIds: string[]): Promise<Map<string, StudentProgress>> {
  const result = new Map<string, StudentProgress>(
    studentIds.map((id) => [id, { lessonsDone: new Map(), quizzes: new Map(), lastActivity: null }]),
  );
  if (studentIds.length === 0 || itemIds.length === 0) return result;

  const [completions, attempts] = await Promise.all([
    prisma.lessonCompletion.findMany({
      where: { studentId: { in: studentIds }, lessonId: { in: itemIds } },
      select: { studentId: true, lessonId: true, completedAt: true },
    }),
    prisma.quizAttempt.findMany({
      where: { studentId: { in: studentIds }, quizId: { in: itemIds } },
      select: { studentId: true, quizId: true, score: true, total: true, submittedAt: true },
    }),
  ]);

  const touch = (p: StudentProgress, at: Date) => {
    if (!p.lastActivity || at > p.lastActivity) p.lastActivity = at;
  };

  for (const c of completions) {
    const p = result.get(c.studentId)!;
    p.lessonsDone.set(c.lessonId, c.completedAt);
    touch(p, c.completedAt);
  }
  for (const a of attempts) {
    const p = result.get(a.studentId)!;
    const prev = p.quizzes.get(a.quizId);
    const better = !prev || a.score / Math.max(a.total, 1) > prev.score / Math.max(prev.total, 1);
    p.quizzes.set(a.quizId, {
      score: better ? a.score : prev!.score,
      total: better ? a.total : prev!.total,
      attempts: (prev?.attempts ?? 0) + 1,
      firstAt: prev && prev.firstAt < a.submittedAt ? prev.firstAt : a.submittedAt,
      lastAt: prev && prev.lastAt > a.submittedAt ? prev.lastAt : a.submittedAt,
    });
    touch(p, a.submittedAt);
  }
  return result;
}

export function isItemDone(item: OutlineItem, progress: StudentProgress): boolean {
  return item.type === 'LESSON' ? progress.lessonsDone.has(item.id) : progress.quizzes.has(item.id);
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

// Completion and quiz stats for one student over a set of items.
export function summarize(items: OutlineItem[], progress: StudentProgress) {
  const done = items.filter((i) => isItemDone(i, progress)).length;
  const quizzes = items.filter((i) => i.type === 'QUIZ');
  const taken = quizzes.map((q) => progress.quizzes.get(q.id)).filter((b): b is QuizBest => Boolean(b));
  const quizAverage = taken.length ? Math.round(taken.reduce((sum, b) => sum + pct(b.score, b.total), 0) / taken.length) : null;
  return {
    itemsDone: done,
    itemsTotal: items.length,
    completion: pct(done, items.length),
    quizzesTaken: taken.length,
    quizzesTotal: quizzes.length,
    quizAverage,
  };
}

// The outline annotated for one student: each item's status, each chapter's locked/complete state,
// and per-module completion — what the student app renders.
export function annotateOutline(outline: OutlineModule[], progress: StudentProgress) {
  let unlocked = true; // flips to false after the first incomplete chapter
  return outline.map((mod) => {
    const chapters = mod.chapters.map((ch) => {
      const locked = !unlocked;
      const items = ch.items.map((item) => {
        const best = item.type === 'QUIZ' ? progress.quizzes.get(item.id) : undefined;
        return {
          ...item,
          done: isItemDone(item, progress),
          bestScore: best ? best.score : null,
          bestTotal: best ? best.total : null,
          attempts: best?.attempts ?? 0,
        };
      });
      const complete = items.every((i) => i.done);
      if (!complete) unlocked = false;
      return { ...ch, locked, complete, items };
    });
    return { ...mod, chapters, ...summarize(mod.chapters.flatMap((c) => c.items), progress) };
  });
}

// Whether an item is reachable for the student (its chapter isn't locked).
export function isItemUnlocked(outline: OutlineModule[], progress: StudentProgress, itemId: string): boolean {
  for (const mod of annotateOutline(outline, progress)) {
    for (const ch of mod.chapters) {
      if (ch.items.some((i) => i.id === itemId)) return !ch.locked;
    }
  }
  return false;
}

// ---------- At-risk rules (instructor view) ----------

export type RiskLevel = 'HIGH' | 'MODERATE' | 'LOW';

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 14;
const NOT_STARTED_GRACE_DAYS = 7;

// Flags a student from their module-quiz average, their average on the instructor's own quizzes & exams (and any
// they missed after they closed), activity, and completion relative to the class.
export function assessRisk(input: {
  quizAverage: number | null;
  assessmentAverage?: number | null;
  missedExams?: number;
  missedQuizzes?: number;
  completion: number;
  classAverageCompletion: number;
  lastActivity: Date | null;
  enrolledAt: Date;
  now?: Date;
}): { level: RiskLevel; reasons: string[] } {
  const now = input.now ?? new Date();
  const reasons: { level: RiskLevel; text: string }[] = [];

  if (input.quizAverage !== null && input.quizAverage < 60) reasons.push({ level: 'HIGH', text: `Module quiz avg. ${input.quizAverage}%` });
  else if (input.quizAverage !== null && input.quizAverage < 75) reasons.push({ level: 'MODERATE', text: `Module quiz avg. ${input.quizAverage}%` });

  const classAvg = input.assessmentAverage ?? null;
  if (classAvg !== null && classAvg < 60) reasons.push({ level: 'HIGH', text: `Quiz & exam avg. ${classAvg}%` });
  else if (classAvg !== null && classAvg < 75) reasons.push({ level: 'MODERATE', text: `Quiz & exam avg. ${classAvg}%` });
  const exams = input.missedExams ?? 0;
  const quizzes = input.missedQuizzes ?? 0;
  if (exams > 0) reasons.push({ level: 'HIGH', text: `Missed ${exams} exam${exams === 1 ? '' : 's'}` });
  if (quizzes > 0) reasons.push({ level: 'MODERATE', text: `Missed ${quizzes} quiz${quizzes === 1 ? '' : 'zes'}` });

  const daysEnrolled = (now.getTime() - input.enrolledAt.getTime()) / DAY_MS;
  if (!input.lastActivity) {
    if (daysEnrolled >= NOT_STARTED_GRACE_DAYS) reasons.push({ level: 'HIGH', text: 'Not started' });
  } else {
    const idle = Math.floor((now.getTime() - input.lastActivity.getTime()) / DAY_MS);
    if (idle >= INACTIVE_DAYS) reasons.push({ level: 'MODERATE', text: `No activity in ${idle} days` });
  }

  const behind = input.classAverageCompletion - input.completion;
  if (behind >= 40) reasons.push({ level: 'HIGH', text: `${behind}% behind class` });
  else if (behind >= 25) reasons.push({ level: 'MODERATE', text: `${behind}% behind class` });

  const level: RiskLevel = reasons.some((r) => r.level === 'HIGH') ? 'HIGH' : reasons.length ? 'MODERATE' : 'LOW';
  return { level, reasons: reasons.map((r) => r.text) };
}
