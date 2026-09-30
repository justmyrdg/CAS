import { useState } from 'react';
import { BLOCK_LABELS, parseYoutubeId, prepareBlock, type BlockDraft, type BlockPayload } from '../lessonBlocks';
import { CHOICE_LETTERS } from '../subjectsData';
import { MobileBackHeader, MobileButton, PreviewLayout, mobileFooter, mobileScroll } from './PhoneFrame';

type CheckPayload = Extract<BlockPayload, { type: 'check' }>;

// Which blocks the app would show, and what's wrong with the rest (listed beside the phone).
export function lessonPreviewParts(title: string, blocks: BlockDraft[]) {
  const notes: string[] = [];
  const shown: { key: number; draft: BlockDraft; payload: BlockPayload }[] = [];
  for (const [i, b] of blocks.entries()) {
    const payload = prepareBlock(b, `Block ${i + 1} (${BLOCK_LABELS[b.type]})`);
    if (typeof payload === 'string') notes.push(payload);
    else shown.push({ key: b.key, draft: b, payload });
  }
  if (!title.trim()) notes.unshift('The lesson needs a title.');
  return { shown, notes };
}

// The unsaved lesson as student-mobile's LessonScreen shows it. Incomplete blocks are left out and listed beside the phone.
export default function LessonPreview(props: { title: string; crumb: string; blocks: BlockDraft[]; arModelName: string | null }) {
  return (
    <PreviewLayout notes={lessonPreviewParts(props.title, props.blocks).notes}>
      <LessonScreen {...props} />
    </PreviewLayout>
  );
}

// The phone screen itself; the module preview passes onBack/onComplete to walk through a module.
export function LessonScreen({
  title,
  crumb,
  blocks,
  arModelName,
  completed,
  onBack,
  onComplete,
}: {
  title: string;
  crumb: string;
  blocks: BlockDraft[];
  arModelName: string | null;
  completed?: boolean;
  onBack?: () => void;
  onComplete?: () => void;
}) {
  const { shown } = lessonPreviewParts(title, blocks);

  // Keys of the checks answered in this preview; like the app, "Mark as complete" waits for all of them.
  const [answered, setAnswered] = useState<ReadonlySet<number>>(new Set());
  const checkKeys = shown.filter((s) => s.payload.type === 'check').map((s) => s.key);
  const answeredCount = checkKeys.filter((k) => answered.has(k)).length;
  const locked = !completed && answeredCount < checkKeys.length;

  return (
    <>
      <MobileBackHeader crumb={crumb} title={title.trim() || 'Lesson'} onBack={onBack}>
        {completed && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginTop: 6 }}>✓ You've completed this lesson</div>}
      </MobileBackHeader>
      <div style={{ ...mobileScroll, padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {shown.length === 0 && <p style={{ margin: 0, fontSize: 16, lineHeight: '26px', color: 'var(--text-muted)' }}>This lesson has no content yet.</p>}
        {shown.map(({ key, draft, payload }) => (
          <PreviewBlock key={key} draft={draft} payload={payload} onAnswered={() => setAnswered((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))} />
        ))}
        {arModelName && (
          <div style={{ borderRadius: 14, background: 'var(--primary-dark)', padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--accent)' }}>HANDS-ON ACTIVITY</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>View “{arModelName}” in AR</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Rotate it, zoom in, and place it in your space →</div>
          </div>
        )}
      </div>
      <div style={mobileFooter}>
        {locked && (
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'center' }}>
            Answer all {checkKeys.length} {checkKeys.length === 1 ? 'check' : 'checks'} to finish ({answeredCount}/{checkKeys.length})
          </div>
        )}
        <MobileButton label={completed ? 'Back to chapter' : 'Mark as complete'} disabled={locked} onClick={completed ? onBack : onComplete} />
      </div>
    </>
  );
}

function PreviewBlock({ draft, payload, onAnswered }: { draft: BlockDraft; payload: BlockPayload; onAnswered: () => void }) {
  const caption = (text?: string) => (text ? <div style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-muted)' }}>{text}</div> : null);
  switch (payload.type) {
    case 'heading':
      return <h2 style={{ margin: '4px 0 0', fontSize: 19, lineHeight: '26px', fontWeight: 600, color: 'var(--text)' }}>{payload.text}</h2>;
    case 'text':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {payload.text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <p key={i} style={{ margin: 0, fontSize: 16, lineHeight: '26px', color: 'var(--text)', whiteSpace: 'pre-line' }}>
                {p}
              </p>
            ))}
        </div>
      );
    case 'image':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {draft.type === 'image' && draft.url && (
            <img src={draft.url} alt={payload.caption || 'Lesson image'} style={{ width: '100%', borderRadius: 12, background: 'var(--primary-light)', display: 'block' }} />
          )}
          {caption(payload.caption)}
        </div>
      );
    case 'video': {
      const id = parseYoutubeId(payload.url);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
            <iframe
              src={`https://www.youtube.com/embed/${id}?playsinline=1&rel=0`}
              title={payload.caption || 'Video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ border: 0, width: '100%', height: '100%' }}
            />
          </div>
          {caption(payload.caption)}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>Open in YouTube ↗</span>
        </div>
      );
    }
    case 'check':
      return <CheckPreview block={payload} onAnswered={onAnswered} />;
  }
}

// student-mobile CheckBlock: ungraded, instant feedback, retry when wrong.
function CheckPreview({ block, onAnswered }: { block: CheckPayload; onAnswered: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === block.correctChoice;
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--primary-light)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)' }}>CHECK YOUR UNDERSTANDING</div>
      <div style={{ fontSize: 16, lineHeight: '23px', fontWeight: 600, color: 'var(--text)' }}>{block.prompt}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {block.choices.map((choice, i) => {
          const isPicked = picked === i;
          return (
            <button
              key={i}
              type="button"
              disabled={picked !== null}
              aria-pressed={isPicked}
              onClick={() => {
                setPicked(i);
                onAnswered();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textAlign: 'left',
                borderRadius: 10,
                border: isPicked ? `1.5px solid ${correct ? 'var(--primary)' : 'var(--danger-text)'}` : '1px solid var(--border)',
                background: isPicked && !correct ? 'var(--danger-bg)' : '#fff',
                padding: '11px 12px',
                cursor: picked === null ? 'pointer' : 'default',
                color: 'var(--text)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', width: 16 }}>{CHOICE_LETTERS[i]}</span>
              <span style={{ flex: 1, fontSize: 15, lineHeight: '21px' }}>{choice}</span>
              {isPicked && <span style={{ fontSize: 16, fontWeight: 700, color: correct ? 'var(--primary)' : 'var(--danger-text)' }}>{correct ? '✓' : '✗'}</span>}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: correct ? 'var(--primary)' : 'var(--danger-text)' }}>{correct ? 'Correct!' : 'Not quite.'}</div>
          {block.explanation && <div style={{ fontSize: 14, lineHeight: '21px', color: 'var(--text)' }}>{block.explanation}</div>}
          {!correct && (
            <button type="button" onClick={() => setPicked(null)} style={{ border: 'none', background: 'none', padding: 0, fontSize: 14, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
