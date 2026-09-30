import type { ReactNode } from 'react';
import { SecondaryButton, Tag } from '../../../components/ui';
import { absoluteUrl, youtubeThumbnail } from '../lessonBlocks';
import type { ApiBlock } from '../lessonBlocks';
import { CHOICE_LETTERS, plural } from '../subjectsData';
import type { ContentDetail, ContentOutline } from '../subjectsData';
import type { ModuleView } from './moduleView';

// Read-only admin view of a module: every chapter with its lessons and quizzes written out in full,
// so the whole module can be read through (and checked before saving) without opening each editor.
export default function ModuleOverview({
  view,
  details,
  arModelNames,
  error,
  notes = [],
  onEditItem,
}: {
  view: ModuleView;
  details: Record<string, ContentDetail>;
  arModelNames: Record<string, string>;
  error: string | null;
  notes?: string[];
  onEditItem: (item: ContentOutline) => void;
}) {
  const items = view.chapters.flatMap((c) => c.items);
  const quizzes = items.filter((i) => i.type === 'QUIZ').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Module {view.number}</div>
        <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)', marginTop: 2, overflowWrap: 'anywhere' }}>{view.title.trim() || 'Untitled module'}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, color: view.description.trim() ? 'var(--text-muted)' : 'var(--text-faint)', whiteSpace: 'pre-line' }}>
          {view.description.trim() || 'No description.'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
          {plural(view.chapters.length, 'chapter')} · {plural(items.length - quizzes, 'lesson')} · {plural(quizzes, 'quiz', 'quizzes')}
        </div>
      </div>

      {notes.map((n) => (
        <div key={n} style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          {n}
        </div>
      ))}
      {error && <div style={{ color: 'var(--danger-text)', fontSize: 13 }}>{error}</div>}

      {view.chapters.length === 0 && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          No chapters yet.
        </div>
      )}

      {view.chapters.map((chapter, ci) => (
        <section key={chapter.key} aria-label={`Chapter ${view.number}.${ci + 1}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--text-muted)', marginRight: 8 }}>
                {view.number}.{ci + 1}
              </span>
              {chapter.title.trim() || 'Untitled chapter'}
            </div>
            {chapter.description.trim() && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{chapter.description}</div>}
          </div>

          {chapter.items.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)', paddingLeft: 2 }}>No lessons or quizzes yet.</div>}

          {chapter.items.map((item) => {
            const detail = details[item.id];
            return (
              <article key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-light)' }}>
                  <Tag tone={item.type === 'QUIZ' ? 'warning' : 'success'}>{item.type === 'QUIZ' ? 'Quiz' : 'Lesson'}</Tag>
                  <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, color: 'var(--text)', overflowWrap: 'anywhere' }}>{item.title}</div>
                  <SecondaryButton onClick={() => onEditItem(item)} style={{ padding: '5px 12px', fontSize: 12 }}>
                    Edit
                  </SecondaryButton>
                </header>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {!detail ? (
                    <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Loading…</div>
                  ) : detail.type === 'QUIZ' ? (
                    <QuizReadout detail={detail} />
                  ) : (
                    <LessonReadout detail={detail} arModelName={detail.arModelId ? (arModelNames[detail.arModelId] ?? '3D model') : null} />
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function LessonReadout({ detail, arModelName }: { detail: ContentDetail; arModelName: string | null }) {
  return (
    <>
      {detail.blocks.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>This lesson has no content yet.</div>}
      {detail.blocks.map((b, i) => (
        <BlockReadout key={i} block={b} />
      ))}
      {arModelName && (
        <div style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--primary-dark)', borderRadius: 100, padding: '5px 12px' }}>
          Hands-on activity · {arModelName}
        </div>
      )}
    </>
  );
}

const caption = (text?: string) => (text ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</div> : null);

function BlockReadout({ block }: { block: ApiBlock }) {
  switch (block.type) {
    case 'heading':
      return <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{block.text}</div>;
    case 'text':
      return <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-line' }}>{block.text}</div>;
    case 'image':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <img src={absoluteUrl(block.url)} alt={block.caption || 'Lesson image'} style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', alignSelf: 'flex-start', borderRadius: 8 }} />
          {caption(block.caption)}
        </div>
      );
    case 'video':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <a href={`https://www.youtube.com/watch?v=${block.youtubeId}`} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start', position: 'relative' }}>
            <img src={youtubeThumbnail(block.youtubeId)} alt="Video thumbnail" style={{ width: 220, borderRadius: 8, display: 'block' }} />
            <span
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
            >
              ▶
            </span>
          </a>
          {caption(block.caption)}
        </div>
      );
    case 'check':
      return (
        <div style={{ border: '1px solid var(--border)', background: 'var(--primary-light)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)' }}>CHECK YOUR UNDERSTANDING</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{block.prompt}</div>
          <Choices choices={block.choices} correct={block.correctChoice} />
          {block.explanation && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{block.explanation}</div>}
        </div>
      );
  }
}

function QuizReadout({ detail }: { detail: ContentDetail }) {
  if (detail.questions.length === 0) return <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>This quiz has no questions yet.</div>;
  return (
    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {detail.questions.map((q) => (
        <li key={q.id} style={{ fontSize: 14, color: 'var(--text)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{q.prompt}</div>
          <Choices choices={q.choices} correct={q.correctChoice} />
        </li>
      ))}
    </ol>
  );
}

function Choices({ choices, correct }: { choices: string[]; correct: number }): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {choices.map((c, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: 13,
            padding: '4px 8px',
            borderRadius: 6,
            background: i === correct ? '#fff' : undefined,
            border: i === correct ? '1px solid var(--primary)' : '1px solid transparent',
            color: 'var(--text)',
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--text-muted)', width: 14 }}>{CHOICE_LETTERS[i]}</span>
          <span style={{ flex: 1 }}>{c}</span>
          {i === correct && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>✓ Correct</span>}
        </div>
      ))}
    </div>
  );
}
