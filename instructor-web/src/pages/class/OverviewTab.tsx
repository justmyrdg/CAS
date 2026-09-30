import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Tag } from '../../components/ui';
import { schoolYearLabel, termLabel } from '../../data/classOptions';
import type { ClassRecord } from '../../data/classOptions';

const fieldLabel: CSSProperties = {
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
};

const fieldValue: CSSProperties = { fontWeight: 600, fontSize: 15, color: 'var(--text)' };

export default function OverviewTab({ cls }: { cls: ClassRecord }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(cls.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. non-secure origin); the code stays visible to copy by hand.
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, maxWidth: 1000, alignItems: 'stretch' }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={fieldLabel}>Subject</div>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>
            {cls.subjectCode} · {cls.subjectName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          <div>
            <div style={fieldLabel}>Section</div>
            <div style={fieldValue}>{cls.section}</div>
          </div>
          <div>
            <div style={fieldLabel}>Term</div>
            <div style={fieldValue}>
              {termLabel(cls.term)}, {schoolYearLabel(cls.schoolYear)}
            </div>
          </div>
          <div>
            <div style={fieldLabel}>Students</div>
            <div style={fieldValue}>{cls.studentCount}</div>
          </div>
          <div>
            <div style={fieldLabel}>Status</div>
            <Tag tone={cls.isArchived ? 'neutral' : 'success'}>{cls.isArchived ? 'Archived' : 'Active'}</Tag>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 'auto' }}>
          Share the join code with your students so they can join this class from the student app.
        </div>
      </div>

      <div style={{ background: 'var(--primary)', borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Join code
        </div>
        <div style={{ fontWeight: 700, fontSize: 36, fontFamily: 'ui-monospace, monospace', color: '#fff', letterSpacing: '0.06em', marginBottom: 20 }}>
          {cls.joinCode}
        </div>
        <div>
          <button
            type="button"
            onClick={() => void copyCode()}
            style={{
              background: 'rgba(255,255,255,0.16)',
              border: 'none',
              borderRadius: 8,
              padding: '11px 20px',
              fontWeight: 600,
              fontSize: 13,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy code'}
          </button>
        </div>
      </div>
    </div>
  );
}
