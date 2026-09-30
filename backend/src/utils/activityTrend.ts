// Weekly activity counts for the dashboard charts: lessons completed, module quizzes taken and class quizzes/exams
// submitted, bucketed into Monday-starting weeks (UTC), oldest first, ending with the current week.

export type TrendKind = 'lessons' | 'quizzes' | 'assessments';

export interface TrendWeek {
  weekStart: string; // YYYY-MM-DD, the week's Monday
  lessons: number;
  quizzes: number;
  assessments: number;
}

export const TREND_WEEKS = 12;
const DAY = 86_400_000;

function mondayOf(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
}

// The earliest moment that lands in the trend — use it to limit the queries.
export function trendStart(weeks = TREND_WEEKS, now = new Date()) {
  return new Date(mondayOf(now).getTime() - (weeks - 1) * 7 * DAY);
}

export function weeklyTrend(events: { at: Date; kind: TrendKind }[], weeks = TREND_WEEKS, now = new Date()): TrendWeek[] {
  const start = trendStart(weeks, now).getTime();
  const result: TrendWeek[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(start + i * 7 * DAY).toISOString().slice(0, 10),
    lessons: 0,
    quizzes: 0,
    assessments: 0,
  }));
  for (const e of events) {
    const index = Math.floor((e.at.getTime() - start) / (7 * DAY));
    if (index >= 0 && index < weeks) result[index][e.kind] += 1;
  }
  return result;
}

// Counts how many values fall in each [from, to] band (inclusive), e.g. score bands for a histogram.
export function bandCounts(values: number[], bands: readonly (readonly [number, number])[]) {
  return bands.map(([from, to]) => values.filter((v) => v >= from && v <= to).length);
}

export const SCORE_BANDS = [
  [0, 59],
  [60, 74],
  [75, 89],
  [90, 100],
] as const;
