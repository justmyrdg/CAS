import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Pagination, PrimaryButton, SecondaryButton, Table, TableRow, Toolbar } from '../../components/ui';
import { ApiError, apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';

interface RosterEntry {
  id: string;
  source: 'JOIN_CODE' | 'MANUAL';
  enrolledAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    srCode: string | null;
    email: string;
  };
}

interface RosterResponse {
  students: RosterEntry[];
  total: number;
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const ROSTER_COLS = '1.5fr 110px 1.6fr 130px 110px 170px';

const SOURCE_LABELS: Record<RosterEntry['source'], string> = {
  JOIN_CODE: 'Join code',
  MANUAL: 'Added manually',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function StudentsTab({
  classId,
  isArchived,
  onRosterChange,
}: {
  classId: string;
  isArchived: boolean;
  onRosterChange: () => void;
}) {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [srCode, setSrCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const data = await apiRequest<RosterResponse>(`/api/instructor/classes/${classId}/students?${params}`, {
        token: accessToken,
      });
      const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setEntries(data.students);
      setTotal(data.total);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Unable to load students');
    } finally {
      setLoading(false);
    }
  }, [classId, page, search, accessToken]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  async function addStudent(e: FormEvent) {
    e.preventDefault();
    setAddMessage(null);
    setAdding(true);
    try {
      const data = await apiRequest<{ enrollment: RosterEntry }>(`/api/instructor/classes/${classId}/students`, {
        method: 'POST',
        token: accessToken,
        body: { srCode: srCode.trim() },
      });
      setAddMessage({ tone: 'success', text: `${data.enrollment.student.fullName} was added to this class.` });
      setSrCode('');
      await loadRoster();
      onRosterChange();
    } catch (err) {
      const fieldError = err instanceof ApiError ? (err.details as { srCode?: string[] } | undefined)?.srCode?.[0] : undefined;
      setAddMessage({
        tone: 'error',
        text: fieldError ?? (err instanceof ApiError ? err.message : 'Unable to add student'),
      });
    } finally {
      setAdding(false);
    }
  }

  async function removeStudent(entry: RosterEntry) {
    setConfirmingId(null);
    try {
      await apiRequest(`/api/instructor/classes/${classId}/students/${entry.id}`, { method: 'DELETE', token: accessToken });
      setAddMessage({ tone: 'success', text: `${entry.student.fullName} was removed from this class.` });
      await loadRoster();
      onRosterChange();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Unable to remove student');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = (page - 1) * PAGE_SIZE + entries.length;

  return (
    <>
      {!isArchived && (
        <form onSubmit={addStudent} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <input
            aria-label="Student SR code"
            placeholder="SR code, e.g. 23-01452"
            value={srCode}
            onChange={(e) => setSrCode(e.target.value)}
            required
            style={{
              width: 240,
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              fontFamily: 'ui-monospace, monospace',
              color: 'var(--text)',
            }}
          />
          <PrimaryButton type="submit" disabled={adding}>
            {adding ? 'Adding…' : '+ Add Student'}
          </PrimaryButton>
        </form>
      )}
      <div
        role="status"
        style={{
          minHeight: 20,
          marginBottom: 12,
          fontSize: 13,
          color: addMessage?.tone === 'error' ? 'var(--danger-text)' : 'var(--primary)',
        }}
      >
        {addMessage?.text}
      </div>

      <Toolbar placeholder="Search students by name, SR code or email" search={searchInput} onSearchChange={setSearchInput} />

      {loadError && <div style={{ color: 'var(--danger-text)', marginBottom: 12 }}>{loadError}</div>}

      <Table columns={['Student', 'SR code', 'Email', 'Added via', 'Enrolled', '']} gridTemplateColumns={ROSTER_COLS}>
        {entries.map((entry) => (
          <TableRow
            key={entry.id}
            gridTemplateColumns={ROSTER_COLS}
            columns={[
              <div key="name" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {`${entry.student.firstName[0] ?? ''}${entry.student.lastName[0] ?? ''}`.toUpperCase()}
                </div>
                <span style={{ fontWeight: 600 }}>{entry.student.fullName}</span>
              </div>,
              <span key="sr" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{entry.student.srCode ?? '—'}</span>,
              <span key="email" style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{entry.student.email}</span>,
              SOURCE_LABELS[entry.source],
              formatDate(entry.enrolledAt),
              confirmingId === entry.id ? (
                <div key="confirm" style={{ display: 'flex', gap: 6 }}>
                  <SecondaryButton
                    onClick={() => void removeStudent(entry)}
                    style={{ padding: '6px 10px', color: 'var(--danger-text)', borderColor: 'var(--danger-text)' }}
                  >
                    Remove
                  </SecondaryButton>
                  <SecondaryButton onClick={() => setConfirmingId(null)} style={{ padding: '6px 10px' }}>
                    Cancel
                  </SecondaryButton>
                </div>
              ) : (
                <SecondaryButton key="remove" onClick={() => setConfirmingId(entry.id)} style={{ padding: '6px 12px' }}>
                  Remove
                </SecondaryButton>
              ),
            ]}
          />
        ))}
        {!loading && entries.length === 0 && !loadError && (
          <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
            {search
              ? 'No students match your search.'
              : 'No students yet. Share the join code from the Overview tab, or add a student by SR code above.'}
          </div>
        )}
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        showing={`Showing ${firstShown}–${lastShown} of ${total} student${total === 1 ? '' : 's'}`}
        onPageChange={setPage}
      />
    </>
  );
}
