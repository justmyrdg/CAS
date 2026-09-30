import type { CSSProperties, ReactNode } from 'react';

// Look-alikes of the student app's screens (student-mobile/src), drawn with the same palette so admins can
// preview a lesson or quiz before saving. Keep them roughly in step when the mobile screens change.

// A phone-sized frame with the preview on the left and notes (what's incomplete, etc.) beside it.
export function PreviewLayout({ notes, aside, children }: { notes: string[]; aside?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div
        aria-label="Student app preview"
        role="region"
        style={{
          width: 390,
          // As tall as the screen allows, within real-phone proportions.
          height: 'clamp(640px, calc(100vh - 190px), 860px)',
          flexShrink: 0,
          border: '10px solid #14231c',
          borderRadius: 44,
          background: '#fff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(18, 60, 44, 0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 24px 4px', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          <span>9:41</span>
          <span aria-hidden="true">▂▄▆ ▮</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>

      <div style={{ flex: '1 1 260px', maxWidth: 440, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          This is how students will see it in the app, <strong style={{ color: 'var(--text)' }}>including any unsaved changes</strong>. You can click through it —
          nothing you answer here is recorded.
        </div>
        {aside}
        {notes.length > 0 && (
          <div style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Not shown until fixed:</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// student-mobile BackHeader: back arrow + breadcrumb, then the title. The arrow works when onBack is given.
export function MobileBackHeader({ crumb, title, onBack, children }: { crumb: string; title: string; onBack?: () => void; children?: ReactNode }) {
  const arrow = (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M11 3l-6 6 6 6" stroke="var(--text)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const crumbText = (
    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{crumb}</span>
  );
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, minWidth: 0 };
  return (
    <div style={{ padding: '16px 20px 18px', borderBottom: '1px solid var(--border)' }}>
      {onBack ? (
        <button type="button" aria-label="Back" onClick={onBack} style={{ ...row, width: '100%', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          {arrow}
          {crumbText}
        </button>
      ) : (
        <div style={row}>
          {arrow}
          {crumbText}
        </div>
      )}
      <div style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', overflowWrap: 'anywhere' }}>{title}</div>
      {children}
    </div>
  );
}

export function MobileButton({
  label,
  onClick,
  disabled,
  secondary,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const style: CSSProperties = {
    width: '100%',
    borderRadius: 100,
    padding: secondary ? '13px 0' : '14px 0',
    fontSize: 15,
    fontWeight: 600,
    border: secondary ? '1px solid var(--border)' : 'none',
    background: secondary ? '#fff' : 'var(--primary)',
    color: secondary ? 'var(--text)' : '#fff',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled || !onClick ? 'default' : 'pointer',
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={style}>
      {label}
    </button>
  );
}

export function MobileProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ flex: 1, height: 5, background: 'var(--primary-light)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: 'var(--primary)' }} />
    </div>
  );
}

export const mobileScroll: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto' };
export const mobileFooter: CSSProperties = { padding: 20, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 };
