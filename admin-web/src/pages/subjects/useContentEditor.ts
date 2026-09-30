import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../../lib/apiClient';
import { errorMessage, locateChapter, locateContent } from './subjectsData';
import type { ContentDetail } from './subjectsData';
import { useWorkspace } from './ModuleWorkspace';

// Shared loading for the lesson and quiz editors, which live inside ModuleWorkspace at
//   /subjects/:subjectId/chapters/:chapterId/{lessons|quizzes}/new   (create)
//   /subjects/:subjectId/{lessons|quizzes}/:itemId/edit               (edit)
// Resolves where the item sits (module/chapter numbers) from the workspace's subject and, when editing, loads it.
export function useContentEditor(token: string | null) {
  const { subjectId, chapterId, itemId } = useParams<{ subjectId: string; chapterId?: string; itemId?: string }>();
  const isEdit = Boolean(itemId);
  const { subject, reload } = useWorkspace();

  const [item, setItem] = useState<ContentDetail | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    apiRequest<{ item: ContentDetail }>(`/api/admin/catalog/content/${itemId}`, { token })
      .then((data) => {
        if (!cancelled) setItem(data.item);
      })
      .catch((err: unknown) => {
        if (!cancelled) setItemError(errorMessage(err, 'Unable to load'));
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, token]);

  const location = isEdit ? locateContent(subject, itemId) : locateChapter(subject, chapterId);
  const subjectUrl = `/subjects/${subjectId}`;

  return {
    isEdit,
    item,
    location,
    subjectUrl,
    chapterId: chapterId ?? item?.chapterId,
    // Cancel / delete return to the module's details.
    moduleUrl: location ? `${subjectUrl}/modules/${location.module.id}/edit` : subjectUrl,
    reload,
    // Ready once everything the form needs has loaded.
    ready: Boolean(location && (!isEdit || item)),
    loadError: itemError,
  };
}
