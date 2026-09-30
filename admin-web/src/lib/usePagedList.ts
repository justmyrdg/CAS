import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiRequest } from './apiClient';

const SEARCH_DEBOUNCE_MS = 300;

// Shared state for the admin list pages: debounced search, an optional status
// filter, pagination, and loading from `path` (which must return `total` plus the
// rows under `rowsKey`). Filter/search changes reset to page 1.
export function usePagedList<Row>({
  path,
  rowsKey,
  token,
  pageSize = 10,
  initialStatus,
  filterKey = 'status',
}: {
  path: string;
  rowsKey: string;
  token: string | null;
  pageSize?: number;
  initialStatus?: string;
  // Query-string name for the filter value (e.g. 'subjectId'); an empty value sends no filter.
  filterKey?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatusState] = useState(initialStatus);

  const reload = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (status) params.set(filterKey, status);
      const data = await apiRequest<Record<string, unknown> & { total: number }>(`${path}?${params}`, { token });
      const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setRows(data[rowsKey] as Row[]);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load');
    } finally {
      setLoading(false);
    }
  }, [path, rowsKey, token, page, pageSize, search, status, filterKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const setStatus = (value: string) => {
    setStatusState(value);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = (page - 1) * pageSize + rows.length;

  return {
    rows,
    total,
    page,
    setPage,
    totalPages,
    showing: (noun: string, plural = `${noun}s`) => `Showing ${firstShown}–${lastShown} of ${total} ${total === 1 ? noun : plural}`,
    loading,
    error,
    reload,
    searchInput,
    setSearchInput,
    search,
    status,
    setStatus,
  };
}
