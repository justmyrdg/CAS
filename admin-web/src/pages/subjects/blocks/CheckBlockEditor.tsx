import { inputStyle } from '../../../components/Modal';
import ChoiceEditor from '../ChoiceEditor';
import type { DraftOf } from '../lessonBlocks';

type Changes = Partial<Pick<DraftOf<'check'>, 'prompt' | 'choices' | 'correctChoice' | 'explanation'>>;

export default function CheckBlockEditor({ block, index, onChange }: { block: DraftOf<'check'>; index: number; onChange: (changes: Changes) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea aria-label={`Block ${index + 1} question`} rows={2} maxLength={1000} placeholder="Type the question…" value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
      <div>
        <ChoiceEditor name={`check-${block.key}`} label={`Block ${index + 1}`} choices={block.choices} correctChoice={block.correctChoice} onChange={onChange} />
      </div>
      <textarea
        aria-label={`Block ${index + 1} explanation`}
        rows={2}
        maxLength={1000}
        placeholder="Explanation shown after answering (optional)"
        value={block.explanation}
        onChange={(e) => onChange({ explanation: e.target.value })}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    </div>
  );
}
