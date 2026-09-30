import { inputStyle } from '../../../components/Modal';
import { parseYoutubeId, youtubeThumbnail, type DraftOf } from '../lessonBlocks';

type Changes = Partial<Pick<DraftOf<'video'>, 'url' | 'caption'>>;

export default function VideoBlockEditor({ block, onChange }: { block: DraftOf<'video'>; onChange: (changes: Changes) => void }) {
  const id = parseYoutubeId(block.url);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input aria-label="YouTube link" placeholder="https://www.youtube.com/watch?v=…" value={block.url} onChange={(e) => onChange({ url: e.target.value })} style={inputStyle} />
      {id ? (
        <img src={youtubeThumbnail(id)} alt="Video thumbnail" style={{ width: 240, borderRadius: 8 }} />
      ) : (
        block.url.trim() && <div style={{ color: 'var(--danger-text)', fontSize: 13 }}>Not a YouTube link</div>
      )}
      <input aria-label="Video caption" placeholder="Caption (optional)" maxLength={300} value={block.caption} onChange={(e) => onChange({ caption: e.target.value })} style={inputStyle} />
    </div>
  );
}
