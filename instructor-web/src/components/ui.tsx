import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)' }}>{title}</div>
      {action}
    </div>
  );
}

export function PrimaryButton({ children, style, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      style={{
        background: 'var(--primary)',
        color: '#fff',
        fontWeight: 600,
        fontSize: 13,
        borderRadius: 8,
        padding: '10px 18px',
        border: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, style, type, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type={type ?? 'button'}
      {...props}
      style={{
        border: '1px solid var(--border)',
        background: '#fff',
        color: 'var(--text)',
        fontWeight: 600,
        fontSize: 13,
        borderRadius: 8,
        padding: '10px 18px',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function StatCard({ value, label, danger }: { value: string; label: string; danger?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 26, color: danger ? 'var(--danger-text)' : 'var(--text)' }}>{value}</div>
      <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
      {children}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15">
      <circle cx="6.5" cy="6.5" r="5" stroke="#5B6B62" strokeWidth="1.6" fill="none" />
      <path d="M10.5 10.5L14 14" stroke="#5B6B62" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <path
        d="M1.5 3.5L5 7l3.5-3.5"
        stroke="#5B6B62"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Pass `onSearchChange` / `filterOptions` + `onFilterChange` for a live toolbar;
// omit them to render the static mock-up version the fixture-backed pages use.
export function Toolbar({
  placeholder,
  filterLabel,
  search,
  onSearchChange,
  filterValue,
  filterOptions,
  onFilterChange,
}: {
  placeholder: string;
  filterLabel?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  filterValue?: string;
  filterOptions?: readonly { value: string; label: string }[];
  onFilterChange?: (value: string) => void;
}) {
  const boxStyle = {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
  } as const;

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      <label style={{ ...boxStyle, flex: 1, gap: 10 }}>
        <SearchIcon />
        {onSearchChange ? (
          <input
            type="search"
            aria-label={placeholder}
            placeholder={placeholder}
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', background: 'transparent', padding: 0 }}
          />
        ) : (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{placeholder}</span>
        )}
      </label>
      {filterOptions && onFilterChange ? (
        <label style={{ ...boxStyle, position: 'relative', gap: 8, paddingRight: 34 }}>
          <select
            aria-label="Filter"
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            style={{
              appearance: 'none',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontWeight: 500,
              fontSize: 13,
              color: 'var(--text)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span style={{ position: 'absolute', right: 14, display: 'flex', pointerEvents: 'none' }}>
            <ChevronIcon />
          </span>
        </label>
      ) : (
        filterLabel && (
          <div style={{ ...boxStyle, gap: 8 }}>
            <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{filterLabel}</span>
            <ChevronIcon />
          </div>
        )
      )}
    </div>
  );
}

export function Table({
  columns,
  gridTemplateColumns,
  children,
}: {
  columns: string[];
  gridTemplateColumns?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplateColumns || `repeat(${columns.length}, 1fr)`,
          padding: '12px 18px',
          background: 'var(--table-header-bg)',
          fontWeight: 600,
          fontSize: 11,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {columns.map((c) => (
          <div key={c}>{c}</div>
        ))}
      </div>
      {children}
    </div>
  );
}

export function TableRow({
  columns,
  gridTemplateColumns,
  highlighted,
  faded,
}: {
  columns: ReactNode[];
  gridTemplateColumns?: string;
  highlighted?: boolean;
  faded?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplateColumns || `repeat(${columns.length}, 1fr)`,
        padding: '14px 18px',
        borderTop: '1px solid var(--border-light)',
        fontWeight: 500,
        fontSize: 13,
        color: 'var(--text)',
        alignItems: 'center',
        background: highlighted ? 'var(--primary-light)' : undefined,
        opacity: faded ? 0.55 : 1,
      }}
    >
      {columns.map((c, i) => (
        <div key={i}>{c}</div>
      ))}
    </div>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' | 'danger' | 'success' }) {
  const styles: Record<string, { bg: string; color: string }> = {
    neutral: { bg: 'var(--border-light)', color: 'var(--text-muted)' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
    danger: { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
    success: { bg: 'var(--primary-light)', color: 'var(--primary)' },
  };
  const s = styles[tone];
  return (
    <span
      style={{
        fontWeight: 700,
        fontSize: 11,
        color: s.color,
        background: s.bg,
        borderRadius: 100,
        padding: '3px 10px',
      }}
    >
      {children}
    </span>
  );
}

export function Pagination({
  page,
  totalPages,
  showing,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  showing: string;
  // Omit to render a static (non-clickable) pager, as the fixture-backed pages do.
  onPageChange?: (page: number) => void;
}) {
  const last = Math.max(totalPages, 1);
  // Show up to 4 page numbers, sliding the window so the current page stays visible.
  const windowStart = Math.max(1, Math.min(page - 1, last - 3));
  const pages = Array.from({ length: Math.min(last, 4) }, (_, i) => windowStart + i);
  const go = (p: number) => onPageChange?.(p);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
      <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>{showing}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PageBox disabled={page <= 1} onClick={onPageChange && (() => go(page - 1))} label="Previous page">
          <svg width="8" height="8" viewBox="0 0 8 8">
            <path d="M6 1L2 4l4 3" stroke="#14231C" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PageBox>
        {pages.map((p) => (
          <PageBox key={p} active={p === page} onClick={onPageChange && (() => go(p))}>
            {p}
          </PageBox>
        ))}
        {windowStart + 3 < last && <PageBox disabled>...</PageBox>}
        <PageBox disabled={page >= last} onClick={onPageChange && (() => go(page + 1))} label="Next page">
          <svg width="8" height="8" viewBox="0 0 8 8">
            <path d="M2 1l4 3-4 3" stroke="#14231C" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PageBox>
      </div>
    </div>
  );
}

function PageBox({
  children,
  active,
  disabled,
  onClick,
  label,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled || !onClick}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        border: active ? 'none' : '1px solid var(--border)',
        background: active ? 'var(--primary)' : 'transparent',
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: 12,
        color: active ? '#fff' : 'var(--text)',
        opacity: disabled ? 0.4 : 1,
        padding: 0,
        cursor: onClick && !disabled && !active ? 'pointer' : 'default',
      }}
    >
      {children}
    </button>
  );
}
