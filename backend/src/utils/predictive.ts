import type { Term } from '@prisma/client';

// Predictive analytics: an explainable statistical model (no black box) that forecasts, for one student in one
// class, how far they will get by the end of the term and what final score to expect, with an uncertainty range
// and a probability of failing. Every number comes from the student's own record:
//
//  • Pace — items (lessons + chapter quizzes) completed per week, blending the last 4 weeks (60%) with the whole
//    enrolment (40%, or 20% if idle for 2+ weeks) so a recent slowdown or speed-up counts more.
//    Projected completion = done + pace × weeks left.
//  • Expected score — weighted average of the instructor's quizzes & exams (60%) and the chapter quizzes (40%),
//    adjusted for the recent score trend (least-squares slope over the last 6 scores, capped at ±10 points),
//    for coursework that won't be finished by the end of term, and for missed exams (−8) / quizzes (−3).
//  • Uncertainty — the spread of the student's scores divided by √(number of scores), plus a fixed 6-point error.
//    The range shown is the 80% interval (±1.28σ); fewer scores ⇒ wider range and lower confidence.
//  • Probability of failing = P(final < 60%) under a normal distribution around the expected score.

export const PASSING_SCORE = 60;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

// Approximate end of each term (Philippine school calendar); schoolYear is "2026-2027".
export function termEnd(term: Term, schoolYear: string): Date {
  const [startYear, endYear] = schoolYear.split('-').map(Number);
  if (term === 'FIRST_SEM') return new Date(Date.UTC(startYear, 11, 18)); // Dec 18
  if (term === 'SECOND_SEM') return new Date(Date.UTC(endYear || startYear + 1, 4, 22)); // May 22
  return new Date(Date.UTC(endYear || startYear + 1, 6, 31)); // Summer: Jul 31
}

export interface StudentSignals {
  itemsDone: number;
  itemsTotal: number;
  doneDates: Date[]; // when each finished item was first finished
  quizScores: { pct: number; at: Date }[]; // best score on each chapter quiz, dated by first attempt
  assessmentScores: { pct: number; at: Date }[]; // best graded score on each instructor quiz/exam
  missedExams: number;
  missedQuizzes: number;
  enrolledAt: Date;
  termEnd: Date;
  now?: Date;
}

export type PredictedRisk = 'HIGH' | 'MODERATE' | 'LOW';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Prediction {
  pacePerWeek: number;
  projectedCompletion: number; // % of the subject done by the end of term, at the current pace
  projectedFinish: Date | null; // when the last item would be done at the current pace (null = no pace yet)
  onTrack: boolean; // will finish everything by the end of term
  predictedScore: number | null; // expected final % (null when there are no scores yet)
  scoreLow: number | null;
  scoreHigh: number | null;
  failProbability: number; // 0–100
  predictedRisk: PredictedRisk;
  confidence: Confidence;
  factors: string[]; // the main reasons behind the forecast, most important first
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (v: number) => Math.round(v * 10) / 10;

function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

// Least-squares slope of y over its index (points per score).
export function slope(ys: number[]) {
  if (ys.length < 3) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

// Standard normal CDF (Abramowitz–Stegun 7.1.26 approximation of erf).
export function normalCdf(z: number) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export function predictStudent(s: StudentSignals): Prediction {
  const now = s.now ?? new Date();
  const factors: { weight: number; text: string }[] = [];

  // ---- Pace and projected completion ----
  const weeksEnrolled = Math.max((now.getTime() - s.enrolledAt.getTime()) / WEEK, 1);
  const overallPace = s.itemsDone / weeksEnrolled;
  const recentPace = s.doneDates.filter((d) => now.getTime() - d.getTime() <= 4 * WEEK).length / Math.min(4, weeksEnrolled);
  // A student idle for 2+ weeks is assumed to come back at only half their earlier pace.
  const lastDone = Math.max(0, ...s.doneDates.map((d) => d.getTime()));
  const idle = s.itemsDone > 0 && now.getTime() - lastDone >= 2 * WEEK;
  const pace = 0.6 * recentPace + (idle ? 0.2 : 0.4) * overallPace;
  const weeksLeft = Math.max((s.termEnd.getTime() - now.getTime()) / WEEK, 0);
  const remaining = s.itemsTotal - s.itemsDone;
  const projectedItems = Math.min(s.itemsTotal, s.itemsDone + pace * weeksLeft);
  const projectedCompletion = s.itemsTotal ? Math.round((projectedItems / s.itemsTotal) * 100) : 100;
  const projectedFinish = remaining <= 0 ? now : pace > 0 ? new Date(now.getTime() + (remaining / pace) * WEEK) : null;
  const onTrack = remaining <= 0 || projectedCompletion >= 100;
  if (!onTrack) {
    factors.push({
      weight: 100 - projectedCompletion,
      text: pace > 0 ? `At ${round1(pace)} items a week, only ${projectedCompletion}% will be done by the end of term` : 'No lessons or quizzes completed recently',
    });
  }

  // ---- Expected score ----
  const quiz = s.quizScores.map((x) => x.pct);
  const assess = s.assessmentScores.map((x) => x.pct);
  const all = [...s.quizScores, ...s.assessmentScores].sort((a, b) => a.at.getTime() - b.at.getTime()).map((x) => x.pct);
  let predictedScore: number | null = null;
  let scoreLow: number | null = null;
  let scoreHigh: number | null = null;
  let failProbability: number;

  if (all.length) {
    const base = assess.length && quiz.length ? 0.6 * mean(assess) + 0.4 * mean(quiz) : mean(assess.length ? assess : quiz);
    const trend = clamp(slope(all.slice(-6)) * 2, -10, 10);
    const unfinishedPenalty = (100 - projectedCompletion) * 0.15;
    const missedPenalty = s.missedExams * 8 + s.missedQuizzes * 3;
    const expected = clamp(base + trend - unfinishedPenalty - missedPenalty, 0, 100);
    const sigma = Math.sqrt((all.length > 1 ? stdev(all) : 15) ** 2 / all.length + 6 ** 2);
    predictedScore = Math.round(expected);
    scoreLow = Math.round(clamp(expected - 1.28 * sigma, 0, 100));
    scoreHigh = Math.round(clamp(expected + 1.28 * sigma, 0, 100));
    failProbability = Math.round(normalCdf((PASSING_SCORE - expected) / sigma) * 100);

    if (assess.length) factors.push({ weight: Math.abs(75 - mean(assess)), text: `Quiz & exam average ${Math.round(mean(assess))}%` });
    if (quiz.length) factors.push({ weight: Math.abs(75 - mean(quiz)) * 0.7, text: `Chapter quiz average ${Math.round(mean(quiz))}%` });
    if (Math.abs(trend) >= 3) factors.push({ weight: Math.abs(trend) * 2, text: trend < 0 ? 'Scores are going down' : 'Scores are improving' });
    if (missedPenalty) factors.push({ weight: missedPenalty * 4, text: [s.missedExams && `missed ${s.missedExams} exam${s.missedExams === 1 ? '' : 's'}`, s.missedQuizzes && `missed ${s.missedQuizzes} quiz${s.missedQuizzes === 1 ? '' : 'zes'}`].filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase()) });
  } else {
    // No scores yet: the forecast rests on engagement alone (low confidence).
    failProbability = s.itemsDone === 0 ? 70 : projectedCompletion < 50 ? 55 : projectedCompletion < 80 ? 35 : 15;
    factors.push({ weight: 50, text: 'No quiz or exam scores yet' });
  }

  const predictedRisk: PredictedRisk = failProbability >= 50 ? 'HIGH' : failProbability >= 25 ? 'MODERATE' : 'LOW';
  const confidence: Confidence = all.length >= 6 ? 'HIGH' : all.length >= 3 ? 'MEDIUM' : 'LOW';

  return {
    pacePerWeek: round1(pace),
    projectedCompletion,
    projectedFinish,
    onTrack,
    predictedScore,
    scoreLow,
    scoreHigh,
    failProbability,
    predictedRisk,
    confidence,
    factors: factors.sort((a, b) => b.weight - a.weight).slice(0, 3).map((f) => f.text),
  };
}
