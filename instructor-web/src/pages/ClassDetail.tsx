import { useCallback, useEffect, useState } from 'react';
import { Navigate, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader, PrimaryButton, SecondaryButton, Tag } from '../components/ui';
import { FormModal } from '../components/Modal';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { schoolYearLabel, termLabel } from '../data/classOptions';
import type { ClassRecord } from '../data/classOptions';
import OverviewTab from './class/OverviewTab';
import StudentsTab from './class/StudentsTab';
import PerformanceTab from './class/PerformanceTab';
import AtRiskTab from './class/AtRiskTab';
import ContentTab from './class/ContentTab';
import AssessmentsTab from './class/AssessmentsTab';

// '' is the Overview tab, served at /classes/:id with no tab segment.
const TABS = [
  { slug: '', label: 'Overview' },
  { slug: 'students', label: 'Students' },
  { slug: 'content', label: 'Content' },
  { slug: 'quizzes', label: 'Quizzes' },
  { slug: 'exams', label: 'Exams' },
  { slug: 'performance', label: 'Performance' },
  { slug: 'at-risk', label: 'At-Risk' },
] as const;

export default function ClassDetail() {
  const { id, tab = '' } = useParams<{ id: string; tab?: string }>();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get('created') === '1';
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [cls, setCls] = useState<ClassRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadClass = useCallback(async () => {
    try {
      const data = await apiRequest<{ class: ClassRecord }>(`/api/instructor/classes/${id}`, { token: accessToken });
      setCls(data.class);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load class');
    }
  }, [id, accessToken]);

  useEffect(() => {
    void loadClass();
  }, [loadClass]);

  async function runConfirmed() {
    if (!cls || !confirm) return;
    setBusy(true);
    setActionError(null);
    try {
      if (confirm === 'delete') {
        await apiRequest(`/api/instructor/classes/${cls.id}`, { method: 'DELETE', token: accessToken });
        navigate('/classes', { replace: true });
        return;
      }
      await apiRequest(`/api/instructor/classes/${cls.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: { isArchived: !cls.isArchived },
      });
      setConfirm(null);
      await loadClass();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  // The combined tab was split into Quizzes and Exams; keep old links working.
  if (tab === 'assessments') return <Navigate to={`/classes/${id}/quizzes`} replace />;
  if (!TABS.some((t) => t.slug === tab)) {
    return <Navigate to={`/classes/${id}`} replace />;
  }

  const title = justCreated && tab === '' ? 'Class created' : cls ? `${cls.subjectCode} · Section ${cls.section}` : 'Class';

  return (
    <Layout>
      <PageHeader
        title={title}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <SecondaryButton onClick={() => navigate('/classes')}>Back to My Classes</SecondaryButton>
            {justCreated && <PrimaryButton onClick={() => navigate('/classes?new=1')}>+ Create Another</PrimaryButton>}
            {cls && !justCreated && (
              <>
                <SecondaryButton onClick={() => navigate(`/classes/${cls.id}/edit`)}>Edit</SecondaryButton>
                <SecondaryButton onClick={() => setConfirm('archive')}>{cls.isArchived ? 'Unarchive' : 'Archive'}</SecondaryButton>
                <SecondaryButton onClick={() => setConfirm('delete')} style={{ color: 'var(--danger-text)' }}>
                  Delete
                </SecondaryButton>
              </>
            )}
          </div>
        }
      />
      {cls && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -16, marginBottom: 20 }}>
          {cls.subjectName} · {termLabel(cls.term)}, {schoolYearLabel(cls.schoolYear)}
          {cls.isArchived && (
            <span style={{ marginLeft: 10 }}>
              <Tag>Archived — no new students can join</Tag>
            </span>
          )}
        </div>
      )}

      {error && <div style={{ color: 'var(--danger-text)' }}>{error}</div>}

      {cls && (
        <>
          <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
            {TABS.map((t) => (
              <NavLink
                key={t.slug}
                role="tab"
                to={t.slug ? `/classes/${cls.id}/${t.slug}` : `/classes/${cls.id}`}
                end
                style={({ isActive }) => ({
                  padding: '10px 14px',
                  marginBottom: -1,
                  fontWeight: 600,
                  fontSize: 13,
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                })}
              >
                {t.label}
                {t.slug === 'students' && (
                  <span style={{ marginLeft: 6, fontWeight: 500, color: 'var(--text-faint)' }}>{cls.studentCount}</span>
                )}
              </NavLink>
            ))}
          </div>

          {tab === '' && <OverviewTab cls={cls} />}
          {tab === 'students' && (
            <StudentsTab classId={cls.id} isArchived={cls.isArchived} onRosterChange={() => void loadClass()} />
          )}
          {tab === 'content' && <ContentTab classId={cls.id} />}
          {tab === 'quizzes' && <AssessmentsTab key="quizzes" classId={cls.id} kind="QUIZ" />}
          {tab === 'exams' && <AssessmentsTab key="exams" classId={cls.id} kind="EXAM" />}
          {tab === 'performance' && <PerformanceTab classId={cls.id} />}
          {tab === 'at-risk' && <AtRiskTab classId={cls.id} />}
        </>
      )}
      {cls && confirm && (
        <FormModal
          title={confirm === 'delete' ? `Delete ${cls.subjectCode} · Section ${cls.section}?` : cls.isArchived ? 'Unarchive this class?' : 'Archive this class?'}
          submitLabel={confirm === 'delete' ? 'Delete Class' : cls.isArchived ? 'Unarchive' : 'Archive'}
          busyLabel={confirm === 'delete' ? 'Deleting…' : 'Saving…'}
          danger={confirm === 'delete'}
          busy={busy}
          error={actionError}
          onSubmit={() => void runConfirmed()}
          onClose={() => {
            setConfirm(null);
            setActionError(null);
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
            {confirm === 'delete'
              ? `This permanently deletes the class and its roster of ${cls.studentCount} student${cls.studentCount === 1 ? '' : 's'}. Students keep their own lesson and quiz progress.`
              : cls.isArchived
                ? 'Students will be able to join with the join code again.'
                : 'Archived classes stay visible to you and enrolled students, but no one new can join and you can’t add students.'}
          </div>
        </FormModal>
      )}
    </Layout>
  );
}
