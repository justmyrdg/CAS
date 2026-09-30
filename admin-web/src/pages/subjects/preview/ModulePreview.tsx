import { useState } from 'react';
import { draftFromApi } from '../lessonBlocks';
import type { ContentDetail } from '../subjectsData';
import { LessonScreen } from './LessonPreview';
import type { ModuleView } from './moduleView';
import { MobileBackHeader, MobileProgressBar, PreviewLayout, mobileScroll } from './PhoneFrame';
import { QuizScreen } from './QuizPreview';

// The module as student-mobile's ModuleChapterScreen lists it, for a student who has just reached it:
// chapters unlock in order as their lessons are marked complete and quizzes submitted (same rule as
// backend progress.service — an empty chapter counts as complete). Tapping an item opens its preview.
export default function ModulePreview({
  view,
  subjectCode,
  subjectName,
  details,
  arModelNames,
  notes = [],
}: {
  view: ModuleView;
  subjectCode: string;
  subjectName: string;
  details: Record<string, ContentDetail>;
  arModelNames: Record<string, string>;
  notes?: string[];
}) {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [unlockAll, setUnlockAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const chapters: (ModuleView['chapters'][number] & { label: string; locked: boolean; complete: boolean })[] = [];
  for (const [ci, ch] of view.chapters.entries()) {
    // Locked unless every earlier chapter is complete.
    const locked = !unlockAll && chapters.some((c) => !c.complete);
    chapters.push({ ...ch, label: `${view.number}.${ci + 1}`, locked, complete: ch.items.every((i) => done.has(i.id)) });
  }
  const total = chapters.reduce((n, c) => n + c.items.length, 0);
  const doneCount = chapters.reduce((n, c) => n + c.items.filter((i) => done.has(i.id)).length, 0);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const markDone = (id: string) => setDone((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  const openChapter = chapters.find((c) => c.items.some((i) => i.id === openId));
  const openDetail = openId ? details[openId] : undefined;

  const aside = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        Shown as for a student who has just reached this module: each chapter unlocks once the one before it is finished. In the app it's listed with the
        subject's other modules.
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)', cursor: 'pointer' }}>
        <input type="checkbox" checked={unlockAll} onChange={(e) => setUnlockAll(e.target.checked)} />
        Unlock every chapter
      </label>
      {done.size > 0 && (
        <button
          type="button"
          onClick={() => setDone(new Set())}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
        >
          Reset preview progress
        </button>
      )}
    </div>
  );

  let screen;
  if (openId && openChapter) {
    const crumb = `${openChapter.label} ${openChapter.title}`;
    const back = () => setOpenId(null);
    if (!openDetail) {
      screen = (
        <>
          <MobileBackHeader crumb={crumb} title="…" onBack={back} />
          <div style={{ ...mobileScroll, padding: 20, fontSize: 14, color: 'var(--text-muted)' }}>Loading…</div>
        </>
      );
    } else if (openDetail.type === 'QUIZ') {
      screen = <QuizScreen key={openId} title={openDetail.title} crumb={crumb} questions={openDetail.questions} onClose={back} onSubmitted={() => markDone(openDetail.id)} />;
    } else {
      screen = (
        <LessonScreen
          key={openId}
          title={openDetail.title}
          crumb={crumb}
          blocks={openDetail.blocks.map((b, i) => draftFromApi(b, i))}
          arModelName={openDetail.arModelId ? (arModelNames[openDetail.arModelId] ?? '3D model') : null}
          completed={done.has(openDetail.id)}
          onBack={back}
          onComplete={() => {
            markDone(openDetail.id);
            back();
          }}
        />
      );
    }
  } else {
    screen = (
      <>
        <MobileBackHeader crumb={`${subjectCode} · Your section`} title={subjectName}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 12px' }}>Your instructor</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MobileProgressBar pct={pct} />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
              {pct}% · {doneCount} of {total} completed
            </span>
          </div>
        </MobileBackHeader>
        {/* student-mobile Tabs (underline); only Lessons is previewed. */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 12px' }}>
          {['Lessons', 'Quizzes', 'Exams'].map((t, i) => (
            <span
              key={t}
              style={{
                padding: '12px 10px',
                marginBottom: -1,
                fontSize: 13,
                fontWeight: 600,
                color: i === 0 ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${i === 0 ? 'var(--primary)' : 'transparent'}`,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <div style={{ ...mobileScroll, background: 'var(--bg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Module {view.number}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', overflowWrap: 'anywhere' }}>{view.title.trim() || 'Untitled module'}</div>
            </div>
            {total > 0 && (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
                {pct}% · {doneCount}/{total}
              </span>
            )}
          </div>
          {chapters.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', marginTop: 30 }}>No chapters yet.</div>}
          {chapters.map((ch) => (
            <div
              key={ch.key}
              aria-label={`Chapter ${ch.label}${ch.locked ? ' (locked)' : ''}`}
              role="group"
              style={{
                background: ch.locked ? 'var(--table-header-bg)' : '#fff',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' }}>
                    {ch.label} {ch.title.trim() || 'Untitled chapter'}
                  </div>
                  {ch.locked ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Complete the previous chapters to unlock.</div>
                  ) : ch.description.trim() ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ch.description}</div>
                  ) : null}
                </div>
                {ch.locked ? (
                  <MobileTag label="Locked" tone="neutral" />
                ) : ch.complete ? (
                  <MobileTag label="Completed" tone="success" />
                ) : (
                  <MobileTag label="In progress" tone="warning" />
                )}
              </div>

              {!ch.locked && ch.items.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden' }}>
                  {ch.items.map((item, ii) => {
                    const quiz = item.type === 'QUIZ';
                    const isDone = done.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={`${quiz ? 'Quiz' : 'Lesson'}: ${item.title}`}
                        onClick={() => setOpenId(item.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '11px 12px',
                          border: 'none',
                          borderTop: ii === 0 ? 'none' : '1px solid var(--border-light)',
                          background: '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <MobileTag label={quiz ? 'Quiz' : 'Lesson'} tone={quiz ? 'warning' : 'success'} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{item.title}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isDone ? 'var(--primary)' : 'var(--text-muted)' }}>{isDone ? 'Completed' : 'Open'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!ch.locked && ch.items.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No lessons in this chapter yet.</div>}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <PreviewLayout notes={notes} aside={aside}>
      {screen}
    </PreviewLayout>
  );
}

// student-mobile Tag: a small rounded label.
const TAG_TONES = {
  success: { background: 'var(--primary-light)', color: 'var(--primary)' },
  warning: { background: 'var(--warning-bg)', color: 'var(--warning-text)' },
  neutral: { background: 'var(--border-light)', color: 'var(--text-muted)' },
} as const;

function MobileTag({ label, tone }: { label: string; tone: keyof typeof TAG_TONES }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 100, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap', ...TAG_TONES[tone] }}>{label}</span>
  );
}
