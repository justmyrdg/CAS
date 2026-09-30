import { inputStyle } from '../../../components/Modal';
import type { DraftOf } from '../lessonBlocks';

export default function TextBlockEditor({ block, onChange }: { block: DraftOf<'heading'> | DraftOf<'text'>; onChange: (text: string) => void }) {
  if (block.type === 'heading') {
    return (
      <input aria-label="Heading text" placeholder="Section heading" maxLength={200} value={block.text} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    );
  }
  return (
    <>
      <textarea
        aria-label="Text"
        rows={6}
        maxLength={20000}
        placeholder="Write the text students will read… (leave a blank line between paragraphs)"
        value={block.text}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
      />
      <span style={{ display: 'block', textAlign: 'right', fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
        {block.text.length.toLocaleString()} / 20,000 characters
      </span>
    </>
  );
}
