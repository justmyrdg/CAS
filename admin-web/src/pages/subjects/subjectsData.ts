import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiRequest } from '../../lib/apiClient';
import type { ApiBlock } from './lessonBlocks';

export interface SubjectRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  moduleCount: number;
  classCount: number;
}

export type ContentType = 'LESSON' | 'QUIZ';

// A lesson or quiz as it appears in the subject outline (no lesson text / questions).
export interface ContentOutline {
  id: string;
  type: ContentType;
  title: string;
  position: number;
  questionCount: number;
}

export interface ChapterItem {
  id: string;
  title: string;
  description: string | null;
  position: number;
  items: ContentOutline[];
}

export interface ModuleItem {
  id: string;
  title: string;
  description: string | null;
  position: number;
  chapters: ChapterItem[];
}

export interface QuizQuestion {
  prompt: string;
  choices: string[];
  correctChoice: number;
}

// Full lesson/quiz as loaded by its editor.
export interface ContentDetail {
  id: string;
  type: ContentType;
  title: string;
  blocks: ApiBlock[];
  arModelId: string | null;
  chapterId: string;
  questions: (QuizQuestion & { id: string })[];
}

// Where a chapter (and optionally one of its items) sits in the subject, for breadcrumbs and numbering.
export function countContent(mod: ModuleItem) {
  let lessons = 0;
  let quizzes = 0;
  for (const chapter of mod.chapters) {
    for (const item of chapter.items) {
      if (item.type === 'QUIZ') quizzes += 1;
      else lessons += 1;
    }
  }
  return { lessons, quizzes };
}

export function locateChapter(subject: SubjectDetail, chapterId: string | undefined) {
  for (const [moduleIndex, mod] of subject.modules.entries()) {
    const chapterIndex = mod.chapters.findIndex((c) => c.id === chapterId);
    if (chapterIndex >= 0) {
      return { module: mod, moduleIndex, chapter: mod.chapters[chapterIndex], chapterIndex };
    }
  }
  return null;
}

export function locateContent(subject: SubjectDetail, itemId: string | undefined) {
  for (const mod of subject.modules) {
    for (const chapter of mod.chapters) {
      if (chapter.items.some((i) => i.id === itemId)) return locateChapter(subject, chapter.id);
    }
  }
  return null;
}

export interface SubjectDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  classCount: number;
  modules: ModuleItem[];
}

export function errorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.details && typeof err.details === 'object') {
    for (const value of Object.values(err.details as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    }
  }
  return err.message;
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

// Loads one subject with its modules and chapters; the subject and module pages both work off this.
export function useSubjectDetail(subjectId: string | undefined, token: string | null) {
  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!subjectId) return;
    try {
      const data = await apiRequest<{ subject: SubjectDetail }>(`/api/admin/catalog/subjects/${subjectId}`, { token });
      setSubject(data.subject);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Unable to load subject'));
    }
  }, [subjectId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { subject, error, reload };
}

// Wraps a save/delete call with busy + error state for a FormModal.
export function useDialogAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run };
}

// Multiple-choice rules shared by quiz questions and lesson check blocks.
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;
export const CHOICE_LETTERS = 'ABCDEF';

// Drops blank choices and re-points the correct answer; returns a problem ("needs at least 2 choices") or the cleaned list.
export function cleanChoices(choices: string[], correctChoice: number): { choices: string[]; correctChoice: number } | string {
  if (!choices[correctChoice]?.trim()) return "the correct answer can't be blank";
  const kept = choices.map((c, i) => ({ text: c.trim(), i })).filter((c) => c.text);
  if (kept.length < MIN_CHOICES) return `needs at least ${MIN_CHOICES} choices`;
  return { choices: kept.map((c) => c.text), correctChoice: kept.findIndex((c) => c.i === correctChoice) };
}

// Swaps two neighbours and saves the new order for a subject's modules or a module's chapters.
export async function saveMove(url: string, items: { id: string }[], index: number, delta: -1 | 1, token: string | null) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  const ids = items.map((i) => i.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await apiRequest(url, { method: 'PUT', token, body: { ids } });
}
