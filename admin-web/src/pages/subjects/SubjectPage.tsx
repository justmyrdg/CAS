import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { PrimaryButton, SecondaryButton, Table, TableRow } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { useAuth } from '../../state/AuthContext';
import { Breadcrumbs, ConfirmDeleteDialog, DangerButton, DetailHeader, IconButton, SectionHeader } from './components';
import { countContent, errorMessage, plural, saveMove, useSubjectDetail } from './subjectsData';
import type { ModuleItem } from './subjectsData';

type Dialog = { kind: 'deleteSubject' } | { kind: 'deleteModule'; item: ModuleItem };

const MODULE_COLS = '56px minmax(0, 2.4fr) 90px 90px 90px 190px';

// Display page for one subject: its details and a table of its modules.
// Everything inside a module (chapters, lessons, quizzes) is managed on the module's edit page.
export default function SubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { subject, error, reload } = useSubjectDetail(subjectId, accessToken);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function moveModule(index: number, delta: -1 | 1) {
    if (!subject) return;
    try {
      await saveMove(`/api/admin/catalog/subjects/${subject.id}/modules/order`, subject.modules, index, delta, accessToken);
      setActionError(null);
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to reorder modules'));
    }
    await reload();
  }

  const modules = subject?.modules ?? [];
  const totals = modules.reduce(
    (sum, m) => {
      const c = countContent(m);
      return { chapters: sum.chapters + m.chapters.length, lessons: sum.lessons + c.lessons, quizzes: sum.quizzes + c.quizzes };
    },
    { chapters: 0, lessons: 0, quizzes: 0 },
  );

  return (
    <Layout>
      <Breadcrumbs items={[{ label: 'Subjects', to: '/subjects' }, { label: subject?.code ?? '…' }]} />
      {error && <div style={{ color: 'var(--danger-text)', marginBottom: 16 }}>{error}</div>}

      {subject && (
        <>
          <DetailHeader
            eyebrow={`Subject · ${subject.code}`}
            title={subject.name}
            description={subject.description}
            stats={[
              { label: 'Modules', value: modules.length },
              { label: 'Chapters', value: totals.chapters },
              { label: 'Lessons', value: totals.lessons },
              { label: 'Quizzes', value: totals.quizzes },
              { label: 'Classes using it', value: subject.classCount },
            ]}
            actions={
              <>
                <SecondaryButton onClick={() => navigate(`/subjects/${subject.id}/edit`)}>Edit</SecondaryButton>
                <DangerButton onClick={() => setDialog({ kind: 'deleteSubject' })}>Delete</DangerButton>
              </>
            }
          />

          <SectionHeader title="Modules" action={<PrimaryButton onClick={() => navigate(`/subjects/${subject.id}/modules/new`)}>+ New Module</PrimaryButton>} />
          {actionError && <div style={{ color: 'var(--danger-text)', marginBottom: 12 }}>{actionError}</div>}

          <Table columns={['#', 'Module', 'Chapters', 'Lessons', 'Quizzes', '']} gridTemplateColumns={MODULE_COLS}>
            {modules.map((m, index) => {
              const c = countContent(m);
              return (
                <TableRow
                  key={m.id}
                  gridTemplateColumns={MODULE_COLS}
                  columns={[
                    <span
                      key="n"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: 'var(--primary)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {index + 1}
                    </span>,
                    <div key="title" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{m.title}</div>
                      {m.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.description}
                        </div>
                      )}
                    </div>,
                    m.chapters.length,
                    c.lessons,
                    c.quizzes,
                    <div key="actions" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <IconButton label="Move module up" disabled={index === 0} onClick={() => void moveModule(index, -1)}>
                        ↑
                      </IconButton>
                      <IconButton label="Move module down" disabled={index === modules.length - 1} onClick={() => void moveModule(index, 1)}>
                        ↓
                      </IconButton>
                      <SecondaryButton onClick={() => navigate(`/subjects/${subject.id}/modules/${m.id}/edit`)} style={{ padding: '6px 12px' }}>
                        Edit
                      </SecondaryButton>
                      <IconButton label="Delete module" onClick={() => setDialog({ kind: 'deleteModule', item: m })}>
                        ✕
                      </IconButton>
                    </div>,
                  ]}
                />
              );
            })}
            {modules.length === 0 && (
              <div style={{ padding: '24px 18px', borderTop: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)' }}>
                This subject has no modules yet. Use “+ New Module” to create one.
              </div>
            )}
          </Table>
        </>
      )}

      {subject && dialog?.kind === 'deleteSubject' && (
        <ConfirmDeleteDialog
          title={subject.classCount > 0 ? `Can't delete ${subject.code}` : `Delete ${subject.code}?`}
          blocked={subject.classCount > 0}
          message={
            subject.classCount > 0
              ? `${plural(subject.classCount, 'class')} ${subject.classCount === 1 ? 'is' : 'are'} using ${subject.code}, so it can't be deleted.`
              : `This permanently deletes ${subject.code} — ${subject.name}${modules.length > 0 ? ` and its ${plural(modules.length, 'module')}, including all their chapters, lessons and quizzes` : ''}.`
          }
          confirmLabel="Delete Subject"
          remove={async () => {
            await apiRequest(`/api/admin/catalog/subjects/${subject.id}`, { method: 'DELETE', token: accessToken });
            navigate('/subjects', { replace: true });
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'deleteModule' && (
        <ConfirmDeleteDialog
          title="Delete module?"
          message={`This permanently deletes “${dialog.item.title}”${dialog.item.chapters.length > 0 ? ` and its ${plural(dialog.item.chapters.length, 'chapter')}, including their lessons and quizzes` : ''}.`}
          confirmLabel="Delete Module"
          remove={() => apiRequest(`/api/admin/catalog/modules/${dialog.item.id}`, { method: 'DELETE', token: accessToken })}
          onClose={() => {
            setDialog(null);
            void reload();
          }}
        />
      )}
    </Layout>
  );
}
