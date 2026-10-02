import type { ReactNode } from 'react';

// Prescriptive analytics: a ranked list of recommended actions (backend utils/prescriptive.ts). instructor-web has a copy
// of this file — keep the two in sync by hand.

export interface RecommendationItem {
  priority: 1 | 2 | 3;
  title: string;
  detail: string;
  classLabel?: string;
}

const PRIORITY = {
  1: { label: 'Do now', bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
  2: { label: 'This week', bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  3: { label: 'Suggested', bg: 'var(--primary-light)', color: 'var(--primary)' },
} as const;

export function RecommendationList({ items, empty, action }: { items: RecommendationItem[]; empty: string; action?: (item: RecommendationItem, index: number) => ReactNode }) {
  if (!items.length) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{empty}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-light)' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 100,
              padding: '3px 9px',
              whiteSpace: 'nowrap',
              background: PRIORITY[r.priority].bg,
              color: PRIORITY[r.priority].color,
              marginTop: 1,
            }}
          >
            {PRIORITY[r.priority].label}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
              {r.classLabel && <span style={{ color: 'var(--primary)' }}>{r.classLabel} · </span>}
              {r.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{r.detail}</div>
          </div>
          {action?.(r, i)}
        </div>
      ))}
    </div>
  );
}
