import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { PageHeader, SecondaryButton, Table, TableRow, Tag } from '../../components/ui';
import { ApiError, apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { formatDateTime, kindLabel, kindPlural, listPath, score } from './assessmentTypes';
import type { AssessmentKind } from './assessmentTypes';

interface ResultsResponse {
  assessment: { id: string; title: string; kind: AssessmentKind; totalPoints: number };
  students: {
    id: string;
    firstName: string;
    lastName: string;
    srCode: string | null;
    bestScore: number | null;
    needsGrading: boolean;
    attempts: { id: string; submittedAt: string; score: number | null; needsGrading: boolean }[];
  }[];
}

const COLS = '1.6fr 110px 100px 1.6fr';

// /classes/:id/assessments/:assessmentId — every student in the class and their submissions.
export default function AssessmentResultsPage() {
  const { id: classId, assessmentId } = useParams<{ id: string; assessmentId: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<ResultsResponse>(`/api/instructor/classes/${classId}/assessments/${assessmentId}/results`, { token: accessToken })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Unable to load results'));
  }, [classId, assessmentId, accessToken]);

  const submitted = data?.students.filter((s) => s.attempts.length > 0) ?? [];
  const toGrade = data?.students.reduce((n, s) => n + s.attempts.filter((a) => a.needsGrading).length, 0) ?? 0;
  const average = submitted.length ? submitted.reduce((sum, s) => sum + (s.bestScore ?? 0), 0) / submitted.length : null;

  return (
    <Layout>
      <nav style={{ fontSize: 13, marginBottom: 14, display: 'flex', gap: 8 }}>
        <Link to="/classes">My Classes</Link>
        <span style={{ color: 'var(--text-faint)' }}>›</span>
        <Link to={data ? listPath(classId, data.assessment.kind) : `/classes/${classId}`}>{data ? kindPlural(data.assessment.kind) : 'Class'}</Link>
      </nav>
      <PageHeader
        title={data ? data.assessment.title : 'Results'}
        action={<SecondaryButton onClick={() => navigate(`/classes/${classId}/assessments/${assessmentId}/edit`)}>Edit</SecondaryButton>}
      />
      {error && <div style={{ color: 'var(--danger-text)' }}>{error}</div>}
      {data && (
        <>
          <div style={{ display: 'flex', gap: 28, marginTop: -8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            <span>
              <Tag tone={data.assessment.kind === 'EXAM' ? 'danger' : 'success'}>{kindLabel(data.assessment.kind)}</Tag>
            </span>
            <span>
              <b style={{ color: 'var(--text)' }}>{submitted.length}</b> of {data.students.length} students submitted
            </span>
            <span>
              Average best score <b style={{ color: 'var(--text)' }}>{average === null ? '—' : score(Math.round(average * 100) / 100)}</b> / {data.assessment.totalPoints}
            </span>
            {toGrade > 0 && <span style={{ color: 'var(--warning-text)', fontWeight: 600 }}>{toGrade} submission{toGrade === 1 ? '' : 's'} to grade</span>}
          </div>

          <Table columns={['Student', 'Best score', 'Status', 'Submissions']} gridTemplateColumns={COLS}>
            {data.students.length === 0 && (
              <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>No students in this class yet.</div>
            )}
            {data.students.map((s) => (
              <TableRow
                key={s.id}
                gridTemplateColumns={COLS}
                faded={s.attempts.length === 0}
                columns={[
                  <div key="n">
                    <div style={{ fontWeight: 600 }}>
                      {s.lastName}, {s.firstName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.srCode}</div>
                  </div>,
                  s.attempts.length ? `${score(s.bestScore)} / ${data.assessment.totalPoints}` : '—',
                  s.needsGrading ? (
                    <Tag key="g" tone="warning">
                      To grade
                    </Tag>
                  ) : s.attempts.length ? (
                    <Tag key="d" tone="success">
                      Submitted
                    </Tag>
                  ) : (
                    <span key="x" style={{ color: 'var(--text-faint)' }}>
                      Not yet
                    </span>
                  ),
                  <div key="a" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.attempts.map((a, i) => (
                      <Link
                        key={a.id}
                        to={`/classes/${classId}/assessments/${assessmentId}/attempts/${a.id}`}
                        title={`Submitted ${formatDateTime(a.submittedAt)}`}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          border: `1px solid ${a.needsGrading ? 'var(--warning-text)' : 'var(--border)'}`,
                          color: a.needsGrading ? 'var(--warning-text)' : 'var(--primary)',
                          borderRadius: 7,
                          padding: '4px 9px',
                        }}
                      >
                        #{i + 1} · {score(a.score)}
                        {a.needsGrading ? ' · grade' : ''}
                      </Link>
                    ))}
                  </div>,
                ]}
              />
            ))}
          </Table>
        </>
      )}
    </Layout>
  );
}
