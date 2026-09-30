// Class quizzes & exams (backend src/utils/assessmentQuestions.ts has the same question shapes and the marking rules).

export type AssessmentKind = 'QUIZ' | 'EXAM';

export type Question =
  | { id: string; type: 'MULTIPLE_CHOICE'; prompt: string; points: number; choices: string[]; correct: number }
  | { id: string; type: 'MULTIPLE_SELECT'; prompt: string; points: number; choices: string[]; correct: number[] }
  | { id: string; type: 'TRUE_FALSE'; prompt: string; points: number; correct: boolean }
  | { id: string; type: 'SHORT_ANSWER'; prompt: string; points: number; accepted: string[] }
  | { id: string; type: 'ENUMERATION'; prompt: string; points: number; answers: string[]; ordered: boolean }
  | { id: string; type: 'MATCHING'; prompt: string; points: number; pairs: { left: string; right: string }[] }
  | { id: string; type: 'ESSAY'; prompt: string; points: number; guide: string };

export type QuestionType = Question['type'];

export const QUESTION_TYPES: { type: QuestionType; label: string; hint: string }[] = [
  { type: 'MULTIPLE_CHOICE', label: 'Multiple choice', hint: 'One correct answer' },
  { type: 'MULTIPLE_SELECT', label: 'Multiple select', hint: 'Several correct answers (partial credit)' },
  { type: 'TRUE_FALSE', label: 'True or false', hint: 'True / False' },
  { type: 'SHORT_ANSWER', label: 'Identification', hint: 'Typed answer; list every accepted answer' },
  { type: 'ENUMERATION', label: 'Enumeration', hint: 'List several answers (credit per item)' },
  { type: 'MATCHING', label: 'Matching', hint: 'Match each item to its pair (credit per pair)' },
  { type: 'ESSAY', label: 'Essay', hint: 'Written answer you grade yourself' },
];

export const typeLabel = (t: QuestionType) => QUESTION_TYPES.find((x) => x.type === t)?.label ?? t;

export function newQuestion(type: QuestionType): Question {
  const base = { id: crypto.randomUUID(), prompt: '', points: 1 };
  switch (type) {
    case 'MULTIPLE_CHOICE':
      return { ...base, type, choices: ['', '', '', ''], correct: 0 };
    case 'MULTIPLE_SELECT':
      return { ...base, type, choices: ['', '', '', ''], correct: [] };
    case 'TRUE_FALSE':
      return { ...base, type, correct: true };
    case 'SHORT_ANSWER':
      return { ...base, type, accepted: [''] };
    case 'ENUMERATION':
      return { ...base, type, points: 3, answers: ['', '', ''], ordered: false };
    case 'MATCHING':
      return { ...base, type, points: 3, pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }] };
    case 'ESSAY':
      return { ...base, type, points: 10, guide: '' };
  }
}

export interface AssessmentDetail {
  id: string;
  kind: AssessmentKind;
  title: string;
  instructions: string | null;
  questions: Question[];
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  opensAt: string | null;
  closesAt: string | null;
  showAnswers: boolean;
  published: boolean;
  submissions: number;
}

export interface AssessmentSummary {
  id: string;
  kind: AssessmentKind;
  title: string;
  published: boolean;
  opensAt: string | null;
  closesAt: string | null;
  timeLimitMinutes: number | null;
  questionCount: number;
  totalPoints: number;
  studentsSubmitted: number;
  needsGrading: number;
}

export const kindLabel = (k: AssessmentKind) => (k === 'EXAM' ? 'Exam' : 'Quiz');
export const kindPlural = (k: AssessmentKind) => (k === 'EXAM' ? 'Exams' : 'Quizzes');
// The class page tab that lists this kind (/classes/:id/quizzes or /classes/:id/exams).
export const listPath = (classId: string | undefined, k: AssessmentKind) => `/classes/${classId}/${k === 'EXAM' ? 'exams' : 'quizzes'}`;

// Draft / Scheduled / Open / Closed, from the publish flag and the open/close window.
export function statusOf(a: { published: boolean; opensAt: string | null; closesAt: string | null }) {
  const now = Date.now();
  if (!a.published) return { label: 'Draft', tone: 'neutral' as const };
  if (a.opensAt && now < new Date(a.opensAt).getTime()) return { label: 'Scheduled', tone: 'warning' as const };
  if (a.closesAt && now > new Date(a.closesAt).getTime()) return { label: 'Closed', tone: 'neutral' as const };
  return { label: 'Open', tone: 'success' as const };
}

export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const score = (n: number | null) => (n === null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));
