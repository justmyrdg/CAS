export const TERM_OPTIONS = [
  { value: 'FIRST_SEM', label: '1st Semester' },
  { value: 'SECOND_SEM', label: '2nd Semester' },
  { value: 'SUMMER', label: 'Summer' },
] as const;

export type TermValue = (typeof TERM_OPTIONS)[number]['value'];

export interface ClassRecord {
  id: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  term: TermValue;
  schoolYear: string;
  joinCode: string;
  isArchived: boolean;
  createdAt: string;
  studentCount: number;
}

export function termLabel(term: TermValue): string {
  return TERM_OPTIONS.find((t) => t.value === term)?.label ?? term;
}

// "2026-2027" -> "2026–27", matching how terms are written elsewhere in the UI.
export function schoolYearLabel(schoolYear: string): string {
  const [start, end] = schoolYear.split('-');
  return end ? `${start}–${end.slice(2)}` : schoolYear;
}

// The school year that's running now (it starts in June), plus the next one.
export function schoolYearOptions(now = new Date()): string[] {
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return [start, start + 1].map((y) => `${y}-${y + 1}`);
}
