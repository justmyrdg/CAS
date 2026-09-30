import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { fieldLabelStyle, inputStyle } from '../../components/Modal';
import { apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { Breadcrumbs, FormPage } from './components';
import { errorMessage, useSubjectDetail } from './subjectsData';

// /subjects/:subjectId/edit (new subjects are created from the dialog on the subjects list)
export default function SubjectFormPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { subject, error: loadError } = useSubjectDetail(subjectId, accessToken);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the form once the subject being edited has loaded.
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  useEffect(() => {
    if (subject && filledFrom !== subject.id) {
      setCode(subject.code);
      setName(subject.name);
      setDescription(subject.description ?? '');
      setFilledFrom(subject.id);
    }
  }, [subject, filledFrom]);

  const backTo = `/subjects/${subjectId}`;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { code, name: name.trim(), description: description.trim() };
      await apiRequest(`/api/admin/catalog/subjects/${subjectId}`, { method: 'PATCH', token: accessToken, body });
      navigate(backTo, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Unable to save subject'));
      setSaving(false);
    }
  }

  return (
    <Layout>
      <Breadcrumbs items={[{ label: 'Subjects', to: '/subjects' }, { label: subject?.code ?? '…', to: backTo }, { label: 'Edit' }]} />
      {loadError && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{loadError}</div>}

      {filledFrom && (
        <FormPage
          title={`Edit ${subject?.code ?? 'subject'}`}
          error={error}
          saving={saving}
          saveLabel="Save Changes"
          onCancel={() => navigate(backTo)}
          onSubmit={() => void save()}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14 }}>
            <label>
              <span style={fieldLabelStyle}>Code</span>
              <input
                required
                placeholder="CS101"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace' }}
              />
            </label>
            <label>
              <span style={fieldLabelStyle}>Name</span>
              <input required placeholder="Data Structures & Algorithms" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <label>
            <span style={fieldLabelStyle}>Description (optional)</span>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
        </FormPage>
      )}
    </Layout>
  );
}
