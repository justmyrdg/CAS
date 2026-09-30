import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader, SecondaryButton, Tag } from '../components/ui';
import LessonBlocks, { type LessonBlock } from '../components/LessonBlocks';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';

interface ContentItemDetail {
  id: string;
  type: 'LESSON' | 'QUIZ';
  title: string;
  blocks: LessonBlock[];
  arModel: { name: string } | null;
  chapterTitle: string;
  questions: { prompt: string; choices: string[]; correctChoice: number }[];
}

const LETTERS = 'ABCDEF';

// /classes/:id/content/:itemId — read a lesson, or a quiz with its answer key.
export default function ContentItemPage() {
  const { id, itemId } = useParams<{ id: string; itemId: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState<ContentItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ item: ContentItemDetail }>(`/api/instructor/classes/${id}/content/${itemId}`, { token: accessToken })
      .then((data) => {
        if (!cancelled) setItem(data.item);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to load');
      });
    return () => {
      cancelled = true;
    };
  }, [id, itemId, accessToken]);

  return (
    <Layout>
      <PageHeader
        title={item?.title ?? 'Content'}
        action={<SecondaryButton onClick={() => navigate(`/classes/${id}/content`)}>Back to Content</SecondaryButton>}
      />
      {error && <div style={{ color: 'var(--danger-text)' }}>{error}</div>}
      {item && (
        <div style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: -12, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            <Tag tone={item.type === 'QUIZ' ? 'warning' : 'success'}>{item.type === 'QUIZ' ? 'Quiz' : 'Lesson'}</Tag>
            {item.chapterTitle}
          </div>

          {item.type === 'LESSON' ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
              <LessonBlocks blocks={item.blocks} />
              {item.arModel && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
                  Hands-on activity: <strong style={{ color: 'var(--text)' }}>{item.arModel.name}</strong> (3D / AR model)
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {item.questions.map((q, qi) => (
                <div key={qi} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
                    {qi + 1}. {q.prompt}
                  </div>
                  {q.choices.map((choice, ci) => (
                    <div
                      key={ci}
                      style={{
                        display: 'flex',
                        gap: 10,
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 13,
                        background: ci === q.correctChoice ? 'var(--primary-light)' : undefined,
                        fontWeight: ci === q.correctChoice ? 600 : 400,
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', width: 14 }}>{LETTERS[ci]}</span>
                      <span style={{ flex: 1 }}>{choice}</span>
                      {ci === q.correctChoice && <span style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 700 }}>Correct</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
