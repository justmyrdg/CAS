import { useRef, useState } from 'react';
import { SecondaryButton } from '../../../components/ui';
import { inputStyle } from '../../../components/Modal';
import { apiRequest } from '../../../lib/apiClient';
import { absoluteUrl, MAX_IMAGE_BYTES, type DraftOf } from '../lessonBlocks';
import { errorMessage } from '../subjectsData';

type Changes = Partial<Pick<DraftOf<'image'>, 'imageId' | 'url' | 'caption'>>;

// Uploads as soon as a file is picked; the lesson save then just references the image id.
export default function ImageBlockEditor({ block, token, onChange }: { block: DraftOf<'image'>; token: string | null; onChange: (changes: Changes) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Images must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const data = await apiRequest<{ image: { id: string; url: string } }>(`/api/admin/images?${new URLSearchParams({ fileName: file.name })}`, {
        method: 'POST',
        token,
        rawBody: file,
      });
      onChange({ imageId: data.image.id, url: absoluteUrl(data.image.url) });
    } catch (err) {
      setError(errorMessage(err, 'Unable to upload image'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {block.url && <img src={block.url} alt={block.caption || 'Lesson image'} style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 8, alignSelf: 'flex-start' }} />}
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
      <div>
        <SecondaryButton disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? 'Uploading…' : block.url ? 'Replace image' : 'Upload image'}
        </SecondaryButton>
        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>PNG, JPEG, WebP or GIF · up to 5 MB</span>
      </div>
      {error && <div style={{ color: 'var(--danger-text)', fontSize: 13 }}>{error}</div>}
      <input aria-label="Image caption" placeholder="Caption (optional)" maxLength={300} value={block.caption} onChange={(e) => onChange({ caption: e.target.value })} style={inputStyle} />
    </div>
  );
}
