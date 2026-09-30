import Layout from '../components/Layout';
import { PageHeader, Pagination, Table, TableRow, Tag, Toolbar } from '../components/ui';
import { useAuth } from '../state/AuthContext';
import { usePagedList } from '../lib/usePagedList';

interface ClassRow {
  id: string;
  subjectCode: string;
  subjectName: string;
  section: string;
  term: 'FIRST_SEM' | 'SECOND_SEM' | 'SUMMER';
  schoolYear: string;
  joinCode: string;
  isArchived: boolean;
  instructorName: string;
  studentCount: number;
}

const TERM_LABELS = { FIRST_SEM: '1st Sem', SECOND_SEM: '2nd Sem', SUMMER: 'Summer' } as const;
const STATUS_FILTERS = [
  { value: 'all', label: 'All classes' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];
const CLASSES_COLS = '100px 1.4fr 1.2fr 1fr 90px 100px 110px';

// Every class in the institution (instructors create and manage their own; this is the oversight view).
export default function Classes() {
  const { accessToken } = useAuth();
  const list = usePagedList<ClassRow>({ path: '/api/admin/classes', rowsKey: 'classes', token: accessToken, initialStatus: 'all' });

  return (
    <Layout>
      <PageHeader title="Classes — Institution-wide" />
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -16, marginBottom: 20 }}>
        Classes are created by instructors. Manage instructor and student accounts on their own pages.
      </div>
      {list.error && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{list.error}</div>}

      <Toolbar
        placeholder="Search by subject, section, join code or instructor"
        search={list.searchInput}
        onSearchChange={list.setSearchInput}
        filterValue={list.status}
        filterOptions={STATUS_FILTERS}
        onFilterChange={list.setStatus}
      />

      <Table columns={['Subject', 'Name', 'Instructor', 'Section / Term', 'Students', 'Status', 'Join code']} gridTemplateColumns={CLASSES_COLS}>
        {list.rows.map((c) => (
          <TableRow
            key={c.id}
            gridTemplateColumns={CLASSES_COLS}
            faded={c.isArchived}
            columns={[
              <span key="code" style={{ fontWeight: 600 }}>{c.subjectCode}</span>,
              c.subjectName,
              c.instructorName,
              `Sec. ${c.section} · ${TERM_LABELS[c.term]} ${c.schoolYear.replace(/-(\d\d)(\d\d)$/, '–$2')}`,
              c.studentCount,
              <Tag key="status" tone={c.isArchived ? 'neutral' : 'success'}>{c.isArchived ? 'Archived' : 'Active'}</Tag>,
              <span key="join" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--text-muted)' }}>{c.joinCode}</span>,
            ]}
          />
        ))}
        {!list.loading && list.rows.length === 0 && !list.error && (
          <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
            {list.search || list.status !== 'all' ? 'No classes match your search or filter.' : 'No classes yet — instructors create them from the instructor portal.'}
          </div>
        )}
      </Table>

      <Pagination page={list.page} totalPages={list.totalPages} showing={list.showing('class', 'classes')} onPageChange={list.setPage} />
    </Layout>
  );
}
