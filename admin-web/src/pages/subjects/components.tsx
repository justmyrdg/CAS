import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../../components/ui';
import { FormModal } from '../../components/Modal';
import { useDialogAction } from './subjectsData';

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 14, flexWrap: 'wrap' }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {i > 0 && <span style={{ color: 'var(--text-faint)' }}>›</span>}
          {item.to ? (
            <Link to={item.to} style={{ fontWeight: 500 }}>
              {item.label}
            </Link>
          ) : (
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// The title card at the top of the subject page.
export function DetailHeader({
  eyebrow,
  title,
  description,
  stats,
  actions,
}: {
  eyebrow: ReactNode;
  title: string;
  description: string | null;
  stats: { label: string; value: number }[];
  actions: ReactNode;
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 28, display: 'flex', gap: 24, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 360px' }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {eyebrow}
        </div>
        <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)', marginBottom: 6, overflowWrap: 'anywhere' }}>{title}</div>
        <div style={{ fontSize: 14, color: description ? 'var(--text-muted)' : 'var(--text-faint)', lineHeight: 1.5, maxWidth: 640 }}>
          {description ?? 'No description.'}
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 18 }}>
          {stats.map((s) => (
            <div key={s.label}>
              <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>{actions}</div>
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{title}</div>
      {action}
    </div>
  );
}

export function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: 30,
        height: 30,
        border: '1px solid var(--border)',
        borderRadius: 7,
        background: '#fff',
        color: 'var(--text)',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// Layout for the full-page create/edit forms: a titled card with Cancel / Save at the bottom.
export function FormPage({
  title,
  subtitle,
  error,
  saving,
  saveLabel,
  onCancel,
  onSubmit,
  footerStart,
  previews,
  children,
}: {
  title: string;
  subtitle?: string;
  error: string | null;
  saving: boolean;
  saveLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  // Left side of the button row (e.g. a Delete button or a "Saved" note).
  footerStart?: ReactNode;
  // Adds tabs next to "Edit"; each renders only while open, so it always shows the current draft.
  previews?: { label: string; render: () => ReactNode }[];
  children: ReactNode;
}) {
  const [tab, setTab] = useState('Edit');
  const open = previews?.find((p) => p.label === tab);
  const previewing = Boolean(open);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      // A required field left empty can't show its message while hidden behind the preview.
      onInvalidCapture={() => setTab('Edit')}
      style={{ width: '100%' }}
    >
      <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{subtitle}</div>}
      {previews && <Tabs label="Editor view" tabs={['Edit', ...previews.map((p) => p.label)]} value={tab} onChange={setTab} />}
      {/* Kept mounted (just hidden) while previewing so in-progress work like an image upload isn't lost. */}
      <div
        hidden={previewing}
        style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: previewing ? 'none' : 'flex', flexDirection: 'column', gap: 18 }}
      >
        {children}
      </div>
      {open?.render()}
      {error && (
        <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13, marginTop: 14 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginTop: 18 }}>
        {footerStart && <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginRight: 'auto' }}>{footerStart}</div>}
        <SecondaryButton onClick={onCancel} disabled={saving}>
          Cancel
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </PrimaryButton>
      </div>
    </form>
  );
}

export function ConfirmDeleteDialog({
  title,
  message,
  confirmLabel,
  blocked,
  remove,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  // When set, deletion isn't allowed: show only the message and a Close button.
  blocked?: boolean;
  remove: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { busy, error, run } = useDialogAction(onClose);
  return (
    <FormModal
      title={title}
      submitLabel={confirmLabel}
      busyLabel="Deleting…"
      danger
      hideSubmit={blocked}
      busy={busy}
      error={error}
      onSubmit={() => void run(remove)}
      onClose={onClose}
    >
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{message}</div>
    </FormModal>
  );
}

export function DangerButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <SecondaryButton onClick={onClick} style={{ color: 'var(--danger-text)' }}>
      {children}
    </SecondaryButton>
  );
}

export function SavedNote({ children = 'Changes saved' }: { children?: ReactNode }) {
  return (
    <span role="status" style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary)' }}>
      ✓ {children}
    </span>
  );
}

export function Tabs({ label, tabs, value, onChange }: { label: string; tabs: string[]; value: string; onChange: (tab: string) => void }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          style={{
            border: 'none',
            background: 'none',
            padding: '8px 14px',
            marginBottom: -1,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            color: value === t ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: `2px solid ${value === t ? 'var(--primary)' : 'transparent'}`,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
