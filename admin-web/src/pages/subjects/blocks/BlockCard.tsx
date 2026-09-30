import type { ReactNode } from 'react';
import { IconButton } from '../components';

// Frame around one block in the lesson editor: number + type, and move / remove buttons.
export default function BlockCard({
  index,
  count,
  title,
  onMove,
  onRemove,
  children,
}: {
  index: number;
  count: number;
  title: string;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, margin: 0 }}>
      <legend style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: 0, marginBottom: 10, float: 'left' }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
          {index + 1}. {title}
        </span>
        <IconButton label={`Move block ${index + 1} up`} disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </IconButton>
        <IconButton label={`Move block ${index + 1} down`} disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </IconButton>
        <IconButton label={`Remove block ${index + 1}`} onClick={onRemove}>
          ✕
        </IconButton>
      </legend>
      <div style={{ clear: 'both' }} />
      {children}
    </fieldset>
  );
}
