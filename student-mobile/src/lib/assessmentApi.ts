// Class quizzes & exams made by the instructor (backend src/services/assessments.service.ts).

export type AssessmentKind = 'QUIZ' | 'EXAM';
export type AssessmentStatus = 'OPEN' | 'IN_PROGRESS' | 'NOT_OPEN' | 'CLOSED' | 'NO_ATTEMPTS_LEFT';

export interface AssessmentSummary {
  id: string;
  kind: AssessmentKind;
  title: string;
  instructions: string | null;
  questionCount: number;
  totalPoints: number;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  opensAt: string | null;
  closesAt: string | null;
  attemptsUsed: number;
  bestScore: number | null;
  pendingGrading: boolean;
  inProgressId: string | null;
  status: AssessmentStatus;
  attempts: { id: string; submittedAt: string; score: number | null; maxScore: number; needsGrading: boolean }[];
}

// A question as students see it before submitting (no answer key).
export type StudentQuestion =
  | { id: string; type: 'MULTIPLE_CHOICE'; prompt: string; points: number; choices: string[] }
  | { id: string; type: 'MULTIPLE_SELECT'; prompt: string; points: number; choices: string[]; selectCount: number }
  | { id: string; type: 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY'; prompt: string; points: number }
  | { id: string; type: 'ENUMERATION'; prompt: string; points: number; count: number; ordered: boolean }
  | { id: string; type: 'MATCHING'; prompt: string; points: number; left: string[]; options: string[] };

export interface StartedAttempt {
  attemptId: string;
  startedAt: string;
  deadline: string | null;
  serverTime: string;
  title: string;
  kind: AssessmentKind;
  questions: StudentQuestion[];
}

export interface ReviewQuestion {
  id: string;
  type: StudentQuestion['type'];
  prompt: string;
  points: number;
  choices?: string[];
  left?: string[];
  answer: unknown;
  earned: number;
  graded: boolean;
  feedback?: string;
  key?: { correct?: number | number[] | boolean; accepted?: string[]; answers?: string[]; matches?: string[] };
}

export interface AttemptReview {
  attemptId: string;
  assessmentId: string;
  title: string;
  kind: AssessmentKind;
  submittedAt: string;
  score: number | null;
  maxScore: number;
  needsGrading: boolean;
  showAnswers: boolean;
  questions: ReviewQuestion[];
}

export const kindLabel = (k: AssessmentKind) => (k === 'EXAM' ? 'Exam' : 'Quiz');
export const fmtScore = (n: number | null) => (n === null ? '—' : Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
export const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// One-line status for the class screen list.
export function statusLine(a: AssessmentSummary) {
  switch (a.status) {
    case 'IN_PROGRESS':
      return 'In progress — tap to continue';
    case 'NOT_OPEN':
      return a.opensAt ? `Opens ${fmtDate(a.opensAt)}` : 'Not open yet';
    case 'CLOSED':
      return a.attemptsUsed ? `Closed · best ${fmtScore(a.bestScore)}/${a.totalPoints}` : 'Closed';
    case 'NO_ATTEMPTS_LEFT':
      return a.pendingGrading ? 'Submitted · waiting for grading' : `Done · ${fmtScore(a.bestScore)}/${a.totalPoints}`;
    case 'OPEN':
      if (a.attemptsUsed) return `${a.pendingGrading ? 'Waiting for grading' : `Best ${fmtScore(a.bestScore)}/${a.totalPoints}`} · can retake`;
      return a.closesAt ? `Open until ${fmtDate(a.closesAt)}` : 'Open';
  }
}
