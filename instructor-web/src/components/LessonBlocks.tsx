import { API_BASE_URL } from '../lib/apiClient';

export type LessonBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; imageId: string; url: string; caption?: string }
  | { type: 'video'; youtubeId: string; caption?: string }
  | { type: 'check'; prompt: string; choices: string[]; correctChoice: number; explanation?: string };

const LETTERS = 'ABCDEF';
const caption = (text?: string) => text && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{text}</div>;

// A lesson's content as the student sees it, with check answers revealed for the instructor.
export default function LessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  if (blocks.length === 0) return <div style={{ color: 'var(--text-muted)' }}>This lesson has no content yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={i} style={{ margin: 0, fontSize: 18 }}>
                {block.text}
              </h3>
            );
          case 'text':
            return (
              <div key={i} style={{ whiteSpace: 'pre-wrap' }}>
                {block.text}
              </div>
            );
          case 'image':
            return (
              <figure key={i} style={{ margin: 0 }}>
                <img src={`${API_BASE_URL}${block.url}`} alt={block.caption || 'Lesson image'} style={{ maxWidth: '100%', borderRadius: 8 }} />
                {caption(block.caption)}
              </figure>
            );
          case 'video':
            return (
              <div key={i}>
                <a href={`https://www.youtube.com/watch?v=${block.youtubeId}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', position: 'relative' }}>
                  <img src={`https://img.youtube.com/vi/${block.youtubeId}/hqdefault.jpg`} alt="Video thumbnail — opens YouTube" style={{ width: 320, borderRadius: 8, display: 'block' }} />
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 40, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,.6)' }}>▶</span>
                </a>
                {caption(block.caption)}
              </div>
            );
          case 'check':
            return (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--primary-light)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: 'var(--primary)', marginBottom: 6 }}>CHECK YOUR UNDERSTANDING</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{block.prompt}</div>
                {block.choices.map((choice, ci) => (
                  <div key={ci} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '3px 0', fontWeight: ci === block.correctChoice ? 600 : 400 }}>
                    <span style={{ color: 'var(--text-muted)', width: 14 }}>{LETTERS[ci]}</span>
                    <span style={{ flex: 1 }}>{choice}</span>
                    {ci === block.correctChoice && <span style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 700 }}>Correct</span>}
                  </div>
                ))}
                {block.explanation && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{block.explanation}</div>}
              </div>
            );
        }
      })}
    </div>
  );
}
