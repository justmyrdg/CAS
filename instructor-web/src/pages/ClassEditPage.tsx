import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader, PrimaryButton, SecondaryButton } from '../components/ui';
import { ApiError, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { TERM_OPTIONS, schoolYearLabel, schoolYearOptions } from '../data/classOptions';
import type { ClassRecord, TermValue } from '../data/classOptions';

const fieldLabel: CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--text)',
  width: '100%',
};

// /classes/:id/edit — change a class's section or term. Its subject and join code stay the same.
export default function ClassEditPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [cls, setCls] = useState<ClassRecord | null>(null);
  const [section, setSection] = useState('');
  const [term, setTerm] = useState<TermValue>('FIRST_SEM');
  const [schoolYear, setSchoolYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ class: ClassRecord }>(`/api/instructor/classes/${id}`, { token: accessToken })
      .then((data) => {
        if (cancelled) return;
        setCls(data.class);
        setSection(data.class.section);
        setTerm(data.class.term);
        setSchoolYear(data.class.schoolYear);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to load class');
      });
    return () => {
      cancelled = true;
    };
  }, [id, accessToken]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/instructor/classes/${id}`, {
        method: 'PATCH',
        token: accessToken,
        body: { section: section.trim(), term, schoolYear },
      });
      navigate(`/classes/${id}`, { replace: true });
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as Record<string, string[]> | undefined) : undefined;
      setError(details ? (Object.values(details)[0]?.[0] ?? null) : err instanceof ApiError ? err.message : 'Unable to save');
      setSaving(false);
    }
  }

  // Keep the class's current school year selectable even if it's no longer in the default range.
  const years = cls && !schoolYearOptions().includes(cls.schoolYear) ? [cls.schoolYear, ...schoolYearOptions()] : schoolYearOptions();

  return (
    <Layout>
      <PageHeader title={cls ? `Edit ${cls.subjectCode} · Section ${cls.section}` : 'Edit class'} />
      {cls && (
        <form onSubmit={save} style={{ maxWidth: 560 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={fieldLabel}>Subject</span>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>
                {cls.subjectCode} — {cls.subjectName}
              </div>
            </div>
            <label>
              <span style={fieldLabel}>Section</span>
              <input required value={section} onChange={(e) => setSection(e.target.value)} style={inputStyle} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                <span style={fieldLabel}>Term</span>
                <select value={term} onChange={(e) => setTerm(e.target.value as TermValue)} style={inputStyle}>
                  {TERM_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span style={fieldLabel}>School year</span>
                <select value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} style={inputStyle}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {schoolYearLabel(y)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The subject and join code can't be changed.</div>
          </div>
          {error && (
            <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13, marginTop: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <SecondaryButton onClick={() => navigate(`/classes/${id}`)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </PrimaryButton>
          </div>
        </form>
      )}
      {!cls && error && <div style={{ color: 'var(--danger-text)' }}>{error}</div>}
    </Layout>
  );
}
