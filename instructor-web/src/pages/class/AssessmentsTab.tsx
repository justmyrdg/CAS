import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton, Table, TableRow, Tag } from '../../components/ui';
import { ApiError, apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { formatDateTime, kindLabel, statusOf } from '../assessments/assessmentTypes';
import type { AssessmentKind, AssessmentSummary } from '../assessments/assessmentTypes';

const COLS = '2fr 100px 90px 90px 120px 150px';

// The class's own quizzes (Quizzes tab) or exams (Exams tab), made here by the instructor. Creating/editing opens its own page.
export default function AssessmentsTab({ classId, kind }: { classId: string; kind: AssessmentKind }) {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<AssessmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noun = kind === 'EXAM' ? 'exams' : 'quizzes';

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ assessments: AssessmentSummary[] }>(`/api/instructor/classes/${classId}/assessments`, { token: accessToken })
      .then((data) => !cancelled && setList(data.assessments.filter((a) => a.kind === kind)))
      .catch((err: unknown) => !cancelled && setError(err instanceof ApiError ? err.message : `Unable to load ${noun}`));
    return () => {
      cancelled = true;
    };
  }, [classId, accessToken, kind, noun]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {kind === 'EXAM'
            ? 'Exams you give this class — usually timed, one attempt, answers hidden. Mix any question types; students take them in the app.'
            : 'Quizzes for this class — practice or graded, any mix of question types. Students take them in the app.'}
        </div>
        <PrimaryButton onClick={() => navigate(`/classes/${classId}/assessments/new?kind=${kind}`)} style={{ flexShrink: 0 }}>
          + New {kindLabel(kind)}
        </PrimaryButton>
      </div>

      {error && <div style={{ color: 'var(--danger-text)', marginBottom: 12 }}>{error}</div>}
      {!list && !error && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>}

      {list && (
        <Table columns={['Title', 'Status', 'Questions', 'Points', 'Submitted', '']} gridTemplateColumns={COLS}>
          {list.length === 0 && (
            <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
              No {noun} yet. Use “+ New {kindLabel(kind)}” to make one.
            </div>
          )}
          {list.map((a) => {
            const status = statusOf(a);
            return (
              <div
                key={a.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/classes/${classId}/assessments/${a.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/classes/${classId}/assessments/${a.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <TableRow
                  gridTemplateColumns={COLS}
                  columns={[
                    <div key="t">
                      <div style={{ fontWeight: 600 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {a.timeLimitMinutes ? `${a.timeLimitMinutes} min · ` : ''}
                        {a.closesAt ? `closes ${formatDateTime(a.closesAt)}` : a.opensAt ? `opens ${formatDateTime(a.opensAt)}` : 'no deadline'}
                      </div>
                    </div>,
                    <Tag key="s" tone={status.tone}>
                      {status.label}
                    </Tag>,
                    a.questionCount,
                    a.totalPoints,
                    <div key="sub">
                      {a.studentsSubmitted}
                      {a.needsGrading > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning-text)', marginTop: 2 }}>{a.needsGrading} to grade</div>
                      )}
                    </div>,
                    <div key="act" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <SecondaryButton
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/classes/${classId}/assessments/${a.id}/edit`);
                        }}
                        style={{ padding: '5px 12px', fontSize: 12 }}
                      >
                        Edit
                      </SecondaryButton>
                    </div>,
                  ]}
                />
              </div>
            );
          })}
        </Table>
      )}
    </div>
  );
}
