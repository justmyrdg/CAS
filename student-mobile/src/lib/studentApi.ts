import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest, errorText } from './api';

// Shapes returned by the backend's /api/student routes.

export type Term = 'FIRST_SEM' | 'SECOND_SEM' | 'SUMMER';

export interface ClassSummary {
  id: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  term: Term;
  schoolYear: string;
  isArchived: boolean;
  instructorName: string;
  joinedVia: 'JOIN_CODE' | 'MANUAL';
  moduleCount: number;
  completion: number;
  itemsDone: number;
  itemsTotal: number;
}

export interface OutlineItem {
  id: string;
  type: 'LESSON' | 'QUIZ';
  title: string;
  questionCount: number;
  done: boolean;
  bestScore: number | null;
  bestTotal: number | null;
  attempts: number;
}

export interface OutlineChapter {
  id: string;
  title: string;
  description: string | null;
  locked: boolean;
  complete: boolean;
  items: OutlineItem[];
}

export interface OutlineModule {
  id: string;
  title: string;
  description: string | null;
  chapters: OutlineChapter[];
  completion: number;
  itemsDone: number;
  itemsTotal: number;
}

export interface ClassDetail {
  class: Omit<ClassSummary, 'joinedVia' | 'moduleCount' | 'completion' | 'itemsDone' | 'itemsTotal'>;
  modules: OutlineModule[];
  completion: number;
  itemsDone: number;
  itemsTotal: number;
  quizzesTaken: number;
  quizzesTotal: number;
  quizAverage: number | null;
}

export type LessonBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; imageId: string; url: string; caption?: string }
  | { type: 'video'; youtubeId: string; caption?: string }
  | { type: 'check'; prompt: string; choices: string[]; correctChoice: number; explanation?: string };

export interface Lesson {
  id: string;
  title: string;
  blocks: LessonBlock[];
  chapterTitle: string;
  moduleTitle: string;
  completedAt: string | null;
  arModel: { id: string; name: string; fileUrl: string } | null;
}

export interface Quiz {
  id: string;
  title: string;
  chapterTitle: string;
  moduleTitle: string;
  questions: { id: string; prompt: string; choices: string[] }[];
  attempts: { id: string; score: number; total: number; submittedAt: string }[];
}

export interface QuizResult {
  attemptId: string;
  score: number;
  total: number;
  submittedAt: string;
  results: { questionId: string; chosen: number; correctChoice: number; correct: boolean }[];
}

export interface Progress {
  completion: number;
  itemsDone: number;
  itemsTotal: number;
  quizzesTaken: number;
  quizzesTotal: number;
  quizAverage: number | null;
  lessonsDone: number;
  lastActivity: string | null;
  classes: { id: string; subjectCode: string; subjectName: string; section: string; completion: number }[];
  recent: { kind: 'LESSON' | 'QUIZ'; title: string; at: string; score: number | null; total: number | null }[];
  // Weekly counts for the last 8 weeks (oldest first): lessons completed, module quizzes and class quizzes/exams taken.
  trend: { weekStart: string; lessons: number; quizzes: number; assessments: number }[];
  // The last 8 module-quiz attempts, oldest first.
  quizScores: { title: string; at: string; pct: number }[];
}

const TERM_LABELS: Record<Term, string> = { FIRST_SEM: '1st Sem', SECOND_SEM: '2nd Sem', SUMMER: 'Summer' };

export function termLabel(term: Term, schoolYear: string) {
  const [start, end] = schoolYear.split('-');
  return `${TERM_LABELS[term]} ${start}–${end?.slice(2) ?? ''}`;
}

// Loads `path` and reloads it whenever the screen regains focus (e.g. after
// finishing a lesson and coming back), so progress on screen stays current.
export function useStudentData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const result = await apiRequest<T>(path);
      if (!mounted.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (mounted.current) setError(errorText(err, 'Unable to load'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, error, loading, reload };
}
