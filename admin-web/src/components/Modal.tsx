import { useEffect } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { PrimaryButton, SecondaryButton } from './ui';

export const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
};

export const inputStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--text)',
  width: '100%',
  fontFamily: 'inherit',
};

// A centered form dialog. Escape or Cancel closes it; the submit button shows `busyLabel` while saving.
export function FormModal({
  title,
  submitLabel,
  busyLabel = 'Saving…',
  busy,
  error,
  danger,
  hideSubmit,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  submitLabel: string;
  busyLabel?: string;
  busy: boolean;
  error: string | null;
  danger?: boolean;
  // For dialogs that only explain why an action can't be done.
  hideSubmit?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <form
        role="dialog"
        aria-label={title}
        onSubmit={handleSubmit}
        style={{ background: '#fff', borderRadius: 12, padding: 28, width: 460, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
        {children}
        {error && (
          <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <SecondaryButton onClick={onClose} disabled={busy}>
            {hideSubmit ? 'Close' : 'Cancel'}
          </SecondaryButton>
          {!hideSubmit && (
            <PrimaryButton type="submit" disabled={busy} style={danger ? { background: 'var(--danger-text)' } : undefined}>
              {busy ? busyLabel : submitLabel}
            </PrimaryButton>
          )}
        </div>
      </form>
    </div>
  );
}
