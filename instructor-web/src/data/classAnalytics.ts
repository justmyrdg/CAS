import { useEffect, useState } from 'react';
import { ApiError, apiRequest } from '../lib/apiClient';
import type { TrendWeek } from '../components/charts';

// Shape of GET /api/instructor/classes/:id/analytics (see backend classAnalytics.service).

export type RiskLevel = 'HIGH' | 'MODERATE' | 'LOW';

export interface StudentAnalytics {
  studentId: string;
  name: string;
  srCode: string | null;
  completion: number;
  itemsDone: number;
  quizAverage: number | null;
  quizzesTaken: number;
  // The instructor's own quizzes & exams (best fully-graded score on each).
  assessmentAverage: number | null;
  assessmentsTaken: number;
  lastActivity: string | null;
  risk: RiskLevel;
  reasons: string[];
}

export interface ClassAnalytics {
  studentCount: number;
  itemsTotal: number;
  averageScore: number | null;
  completionRate: number | null;
  assessmentAverage: number | null;
  assessments: {
    id: string;
    title: string;
    kind: 'QUIZ' | 'EXAM';
    closesAt: string | null;
    submitted: number;
    average: number | null;
    toGrade: number;
  }[];
  modules: { id: string; title: string; itemsTotal: number; completion: number }[];
  // Weekly activity on this class's content, last 12 weeks.
  trend: TrendWeek[];
  lowestTopic: { moduleTitle: string; chapterTitle: string; average: number } | null;
  riskCounts: Record<RiskLevel, number>;
  students: StudentAnalytics[];
}

export const RISK_LABELS: Record<RiskLevel, string> = { HIGH: 'High risk', MODERATE: 'Moderate', LOW: 'Low risk' };
export const RISK_TONES = { HIGH: 'danger', MODERATE: 'warning', LOW: 'success' } as const;

export function formatLastActive(iso: string | null) {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function useClassAnalytics(classId: string, token: string | null) {
  const [data, setData] = useState<ClassAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<ClassAnalytics>(`/api/instructor/classes/${classId}/analytics`, { token })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to load class analytics');
      });
    return () => {
      cancelled = true;
    };
  }, [classId, token]);

  return { data, error };
}
