import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Pagination, SecondaryButton, Table, TableRow, Tag, Toolbar } from '../components/ui';
import { useAuth } from '../state/AuthContext';
import { usePagedList } from '../lib/usePagedList';

interface AssessmentRow {
  id: string;
  title: string;
  questionCount: number;
  subjectId: string;
  subjectCode: string;
  moduleTitle: string;
  chapterTitle: string;
  attempts: number;
  students: number;
  averageScore: number | null;
}

const ASSESSMENT_COLS = '1.4fr 1.6fr 90px 90px 90px 110px 90px';

// Every quiz in the catalog with how students are doing on it; Edit opens the quiz editor.
export default function Assessments() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const list = usePagedList<AssessmentRow>({ path: '/api/admin/assessments', rowsKey: 'assessments', token: accessToken });

  return (
    <Layout>
      <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)', marginBottom: 6 }}>Assessments</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
        Every quiz across all subjects. Scores are each student's best attempt.
      </div>
      {list.error && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{list.error}</div>}

      <Toolbar placeholder="Search by quiz, chapter or subject" search={list.searchInput} onSearchChange={list.setSearchInput} />

      <Table columns={['Quiz', 'Subject / Chapter', 'Questions', 'Students', 'Attempts', 'Avg. score', '']} gridTemplateColumns={ASSESSMENT_COLS}>
        {list.rows.map((a) => (
          <TableRow
            key={a.id}
            gridTemplateColumns={ASSESSMENT_COLS}
            columns={[
              <span key="t" style={{ fontWeight: 600 }}>{a.title}</span>,
              <div key="where">
                <div>{a.subjectCode} · {a.chapterTitle}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.moduleTitle}</div>
              </div>,
              a.questionCount,
              a.students,
              a.attempts,
              a.averageScore === null ? (
                <span key="s" style={{ color: 'var(--text-faint)' }}>—</span>
              ) : a.averageScore < 60 ? (
                <Tag key="s" tone="warning">{a.averageScore}%</Tag>
              ) : (
                `${a.averageScore}%`
              ),
              <SecondaryButton key="e" onClick={() => navigate(`/subjects/${a.subjectId}/quizzes/${a.id}/edit`)} style={{ padding: '6px 12px' }}>
                Edit
              </SecondaryButton>,
            ]}
          />
        ))}
        {!list.loading && list.rows.length === 0 && !list.error && (
          <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
            {list.search ? 'No quizzes match your search.' : 'No quizzes yet — add them to chapters on the Subjects page.'}
          </div>
        )}
      </Table>

      <Pagination page={list.page} totalPages={list.totalPages} showing={list.showing('quiz', 'quizzes')} onPageChange={list.setPage} />
    </Layout>
  );
}
