import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SecondaryButton, Tag } from '../../components/ui';
import { ApiError, apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';

interface ContentItem {
  id: string;
  type: 'LESSON' | 'QUIZ';
  title: string;
  questionCount: number;
  studentsDone: number;
  averageScore: number | null;
}

interface ContentResponse {
  subjectId: string | null;
  studentCount: number;
  modules: {
    id: string;
    title: string;
    description: string | null;
    chapters: { id: string; title: string; description: string | null; items: ContentItem[] }[];
  }[];
}

// Read-only view of what students in this class work through (managed by admins in the subject catalog),
// with how the class is doing on each lesson and quiz.
export default function ContentTab({ classId }: { classId: string }) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<ContentResponse>(`/api/instructor/classes/${classId}/content`, { token: accessToken })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to load content');
      });
    return () => {
      cancelled = true;
    };
  }, [classId, accessToken]);

  if (error) return <div style={{ color: 'var(--danger-text)' }}>{error}</div>;
  if (!data) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>;
  if (!data.subjectId) {
    return <Note text="This class was created before subjects were linked to the catalog, so it has no content to show." />;
  }
  if (data.modules.length === 0) return <Note text="The subject has no modules yet. Admins add modules, lessons and quizzes in the subject catalog." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Managed by your administrators · “done” counts are out of {data.studentCount} student{data.studentCount === 1 ? '' : 's'}
      </div>
      {data.modules.map((m, mi) => (
        <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
            Module {mi + 1}: {m.title}
          </div>
          {m.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.description}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {m.chapters.map((c, ci) => (
              <div key={c.id}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)', marginRight: 8 }}>
                    {mi + 1}.{ci + 1}
                  </span>
                  {c.title}
                </div>
                {c.items.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 38 }}>No lessons or quizzes yet.</div>
                ) : (
                  <div style={{ marginLeft: 38, border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden' }}>
                    {c.items.map((item, ii) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 12px',
                          borderTop: ii ? '1px solid var(--border-light)' : undefined,
                          background: 'var(--table-header-bg)',
                          fontSize: 13,
                        }}
                      >
                        <Tag tone={item.type === 'QUIZ' ? 'warning' : 'success'}>{item.type === 'QUIZ' ? 'Quiz' : 'Lesson'}</Tag>
                        <span style={{ flex: 1, color: 'var(--text)' }}>
                          {item.title}
                          {item.type === 'QUIZ' && <span style={{ color: 'var(--text-muted)' }}> · {item.questionCount} questions</span>}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 150, textAlign: 'right' }}>
                          {item.studentsDone}/{data.studentCount} done
                          {item.averageScore !== null && ` · avg ${item.averageScore}%`}
                        </span>
                        <SecondaryButton onClick={() => navigate(`/classes/${classId}/content/${item.id}`)} style={{ padding: '5px 10px', fontSize: 12 }}>
                          View
                        </SecondaryButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
      {text}
    </div>
  );
}
