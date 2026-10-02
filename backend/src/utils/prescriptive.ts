import type { Prediction } from './predictive';

// Prescriptive analytics: turns a forecast (utils/predictive.ts) and the facts behind it into concrete, ranked
// actions — for the student ("what should I do next?"), for the instructor about one student ("what should I do for
// them?") and for the instructor about the whole class ("what should I do in class?"). Every rule is explicit, so
// each recommendation can be traced back to the data that triggered it.

export type Priority = 1 | 2 | 3; // 1 = do this first
export interface Recommendation {
  priority: Priority;
  kind: 'DEADLINE' | 'RESUME' | 'REVIEW' | 'PACE' | 'CONTACT' | 'MAKEUP' | 'RETEACH' | 'QUESTION' | 'REMIND' | 'GRADE' | 'ON_TRACK';
  title: string;
  detail: string;
}

const DAY = 86_400_000;
const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const byPriority = (a: Recommendation, b: Recommendation) => a.priority - b.priority;

export interface StudentContext {
  prediction: Prediction;
  itemsDone: number;
  itemsTotal: number;
  termEnd: Date;
  lastActivity: Date | null;
  nextItem: { title: string; type: 'LESSON' | 'QUIZ' } | null; // first unfinished item, in course order
  weakQuizzes: { chapterTitle: string; pct: number }[]; // chapter quizzes with a best score under 75%
  openAssessments: { title: string; kind: 'QUIZ' | 'EXAM'; closesAt: Date | null }[]; // open now, not yet taken
  missedExams: number;
  now?: Date;
}

// What the student should do next (shown in the student app).
export function studentRecommendations(c: StudentContext): Recommendation[] {
  const now = c.now ?? new Date();
  const recs: Recommendation[] = [];
  for (const a of c.openAssessments) {
    const soon = a.closesAt && a.closesAt.getTime() - now.getTime() <= 7 * DAY;
    recs.push({
      priority: soon ? 1 : 2,
      kind: 'DEADLINE',
      title: `Take “${a.title}”`,
      detail: a.closesAt ? `Open until ${shortDate(a.closesAt)}. Unsubmitted ${a.kind === 'EXAM' ? 'exams' : 'quizzes'} count against you once they close.` : 'It is open now.',
    });
  }
  const idle = c.lastActivity ? Math.floor((now.getTime() - c.lastActivity.getTime()) / DAY) : null;
  if (c.nextItem && (idle === null || idle >= 7)) {
    recs.push({
      priority: 1,
      kind: 'RESUME',
      title: idle === null ? 'Start the first lesson' : `Pick up where you left off`,
      detail: `${idle === null ? 'You have not started yet.' : `Your last activity was ${idle} days ago.`} Next: ${c.nextItem.type === 'QUIZ' ? 'the quiz' : 'the lesson'} “${c.nextItem.title}”.`,
    });
  }
  const weakest = [...c.weakQuizzes].sort((a, b) => a.pct - b.pct)[0];
  if (weakest) {
    recs.push({
      priority: weakest.pct < 60 ? 1 : 2,
      kind: 'REVIEW',
      title: `Review “${weakest.chapterTitle}”`,
      detail: `Your best score on its quiz is ${weakest.pct}%. Re-read the lessons, then retake the quiz — your best attempt is the one that counts.`,
    });
  }
  const remaining = c.itemsTotal - c.itemsDone;
  const weeksLeft = Math.max((c.termEnd.getTime() - now.getTime()) / (7 * DAY), 0);
  if (remaining > 0 && !c.prediction.onTrack && weeksLeft > 0) {
    const needed = Math.ceil(remaining / weeksLeft);
    recs.push({
      priority: 2,
      kind: 'PACE',
      title: `Aim for ${needed} lesson${needed === 1 ? '' : 's'} or quiz${needed === 1 ? '' : 'zes'} a week`,
      detail: `At your current pace you will finish about ${c.prediction.projectedCompletion}% by ${shortDate(c.termEnd)}. ${remaining} item${remaining === 1 ? '' : 's'} left.`,
    });
  }
  if (!recs.length) {
    recs.push({
      priority: 3,
      kind: 'ON_TRACK',
      title: remaining > 0 ? 'You are on track' : 'All lessons and quizzes done',
      detail: remaining > 0 && c.nextItem ? `Keep your current pace. Next: “${c.nextItem.title}”.` : 'Review any quiz you would like to improve before the final exam.',
    });
  }
  return recs.sort(byPriority).slice(0, 4);
}

// What the instructor could do for one student (shown next to them on the Insights tab).
export function studentActions(c: StudentContext): string[] {
  const now = c.now ?? new Date();
  const actions: { priority: number; text: string }[] = [];
  const idle = c.lastActivity ? Math.floor((now.getTime() - c.lastActivity.getTime()) / DAY) : null;
  if (idle === null && c.itemsDone === 0) actions.push({ priority: 1, text: 'Contact the student — they have not started' });
  else if (idle !== null && idle >= 14) actions.push({ priority: 1, text: `Check in — no activity in ${idle} days` });
  if (c.missedExams > 0) actions.push({ priority: 1, text: `Arrange a make-up for the missed exam${c.missedExams === 1 ? '' : 's'}` });
  const weakest = [...c.weakQuizzes].sort((a, b) => a.pct - b.pct)[0];
  if (weakest && weakest.pct < 60) actions.push({ priority: 2, text: `Offer remediation on “${weakest.chapterTitle}” (best ${weakest.pct}%)` });
  if (c.prediction.predictedRisk === 'HIGH' && actions.length === 0) actions.push({ priority: 2, text: 'Schedule a consultation before the final exam' });
  if (!c.prediction.onTrack && c.prediction.predictedRisk !== 'LOW') actions.push({ priority: 3, text: 'Agree on a weekly catch-up target' });
  // A reminder only when nothing more important applies (the class-wide list already covers reminders).
  const closing = c.openAssessments.find((a) => a.closesAt && a.closesAt.getTime() - now.getTime() <= 7 * DAY);
  if (closing && !actions.length) actions.push({ priority: 3, text: `Remind them to take “${closing.title}”` });
  return actions.sort((a, b) => a.priority - b.priority).slice(0, 2).map((a) => a.text);
}

export interface ClassContext {
  studentCount: number;
  predictedHigh: { name: string }[]; // students predicted likely to fail
  notOnTrack: number; // students who won't finish by the end of term at their pace
  weakChapters: { title: string; average: number; students: number }[]; // class average on each chapter quiz
  hardQuestions: { assessmentTitle: string; prompt: string; correctRate: number; responses: number }[];
  openAssessments: { title: string; closesAt: Date | null; notTaken: number }[];
  essaysToGrade: number;
  termEnd: Date;
  now?: Date;
}

// What the instructor could do for the whole class (Insights tab), most urgent first.
export function classRecommendations(c: ClassContext): Recommendation[] {
  const now = c.now ?? new Date();
  const recs: Recommendation[] = [];
  if (c.predictedHigh.length) {
    const names = c.predictedHigh.slice(0, 3).map((s) => s.name).join(', ') + (c.predictedHigh.length > 3 ? ` and ${c.predictedHigh.length - 3} more` : '');
    recs.push({
      priority: 1,
      kind: 'CONTACT',
      title: `Reach out to ${c.predictedHigh.length} student${c.predictedHigh.length === 1 ? '' : 's'} predicted to fail`,
      detail: `${names}. Each student's suggested action is on the class's Insights tab.`,
    });
  }
  for (const a of c.openAssessments) {
    if (!a.notTaken) continue;
    const soon = a.closesAt && a.closesAt.getTime() - now.getTime() <= 3 * DAY;
    recs.push({
      priority: soon ? 1 : 2,
      kind: 'REMIND',
      title: `Remind ${a.notTaken} student${a.notTaken === 1 ? '' : 's'} to take “${a.title}”`,
      detail: a.closesAt ? `It closes on ${shortDate(a.closesAt)}.` : 'It has no closing date.',
    });
  }
  if (c.essaysToGrade) {
    recs.push({ priority: 2, kind: 'GRADE', title: `Grade ${c.essaysToGrade} essay submission${c.essaysToGrade === 1 ? '' : 's'}`, detail: 'Their scores do not count toward the analytics until they are graded.' });
  }
  for (const ch of c.weakChapters.filter((w) => w.average < 70 && w.students >= 3).sort((a, b) => a.average - b.average).slice(0, 2)) {
    recs.push({
      priority: ch.average < 60 ? 1 : 2,
      kind: 'RETEACH',
      title: `Reteach “${ch.title}”`,
      detail: `Class average on its quiz is ${ch.average}% (${ch.students} students). A short review before moving on would help.`,
    });
  }
  for (const q of c.hardQuestions.filter((h) => h.correctRate < 50 && h.responses >= 3).sort((a, b) => a.correctRate - b.correctRate).slice(0, 2)) {
    recs.push({
      priority: 2,
      kind: 'QUESTION',
      title: `Go over a question from “${q.assessmentTitle}”`,
      detail: `Only ${q.correctRate}% answered “${q.prompt.length > 80 ? `${q.prompt.slice(0, 77)}…` : q.prompt}” correctly — check the wording or reteach the idea.`,
    });
  }
  if (c.notOnTrack >= Math.max(2, Math.ceil(c.studentCount * 0.2))) {
    recs.push({
      priority: 3,
      kind: 'PACE',
      title: `${c.notOnTrack} students will not finish by ${shortDate(c.termEnd)} at their current pace`,
      detail: 'Consider a catch-up session or weekly targets for the class.',
    });
  }
  if (!recs.length) recs.push({ priority: 3, kind: 'ON_TRACK', title: 'The class is on track', detail: 'No urgent actions. Keep monitoring the forecast weekly.' });
  return recs.sort(byPriority).slice(0, 6);
}
