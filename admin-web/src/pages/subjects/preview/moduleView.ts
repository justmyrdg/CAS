import { useEffect, useState } from 'react';
import { ApiError, apiRequest } from '../../../lib/apiClient';
import { errorMessage } from '../subjectsData';
import type { ContentDetail, ContentOutline } from '../subjectsData';

// What the module overview and the student preview draw: the saved module, or the unsaved draft from the editor
// (draft chapters keep the lessons/quizzes of the saved chapter they came from; new chapters have none yet).
export interface ModuleView {
  number: number;
  title: string;
  description: string;
  chapters: { key: string; title: string; description: string; items: ContentOutline[] }[];
}

// Loads every lesson/quiz in the module in full (blocks, questions) plus AR model names, for the previews.
export function useModuleContent(items: ContentOutline[], token: string | null) {
  const idsKey = items.map((i) => i.id).join(',');
  const [details, setDetails] = useState<Record<string, ContentDetail>>({});
  const [arModelNames, setArModelNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    void Promise.allSettled(idsKey.split(',').map((id) => apiRequest<{ item: ContentDetail }>(`/api/admin/catalog/content/${id}`, { token }))).then((results) => {
      if (cancelled) return;
      setDetails(Object.fromEntries(results.flatMap((r) => (r.status === 'fulfilled' ? [[r.value.item.id, r.value.item]] : []))));
      // A 404 is an item deleted a moment ago (the outline catches up on its next reload), not an error.
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected' && !(r.reason instanceof ApiError && r.reason.status === 404));
      setError(failed ? errorMessage(failed.reason, 'Unable to load lesson content') : null);
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey, token]);

  useEffect(() => {
    apiRequest<{ models: { id: string; name: string }[] }>('/api/admin/ar-models?pageSize=100', { token })
      .then((data) => setArModelNames(Object.fromEntries(data.models.map((m) => [m.id, m.name]))))
      .catch(() => undefined);
  }, [token]);

  return { details, arModelNames, error };
}
