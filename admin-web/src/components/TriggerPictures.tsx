import { useCallback, useEffect, useState } from 'react';
import { SecondaryButton } from './ui';
import { API_BASE_URL, ApiError, apiRequest } from '../lib/apiClient';

// Trigger pictures for an AR model: when the student AR camera sees one of these pictures (printed or on a screen),
// the model appears standing on it. Each picture is compiled into MindAR tracking data here in the browser, then the
// picture and its data are uploaded (backend services/arTriggers.service.ts merges them for the app).

const MINDAR_COMPILER = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';
// Tracking works fine at this size and keeps each picture's data small for the phone to download.
const MAX_SIDE = 720;

interface Trigger {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
}

interface MindArCompiler {
  compileImageTargets(images: HTMLImageElement[], onProgress: (percent: number) => void): Promise<unknown>;
  exportData(): Promise<ArrayBuffer>;
}

let compilerLoad: Promise<new () => MindArCompiler> | null = null;
function loadCompiler() {
  compilerLoad ??= import(/* @vite-ignore */ MINDAR_COMPILER).then(() => {
    const mindar = (window as unknown as { MINDAR?: { IMAGE: { Compiler: new () => MindArCompiler } } }).MINDAR;
    if (!mindar) throw new Error('compiler missing');
    return mindar.IMAGE.Compiler;
  });
  compilerLoad.catch(() => {
    compilerLoad = null;
  });
  return compilerLoad;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('unreadable'));
    img.src = src;
  });
}

function toBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < view.length; i += 0x8000) s += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(s);
}

export default function TriggerPictures({ modelId, token }: { modelId: string; token: string | null }) {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [max, setMax] = useState(10);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ triggers: Trigger[]; max: number }>(`/api/admin/ar-models/${modelId}/triggers`, { token });
      setTriggers(data.triggers);
      setMax(data.max);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load trigger pictures');
    }
  }, [modelId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Choose a picture (JPG, PNG or WebP).');
      return;
    }
    setProgress(0);
    const url = URL.createObjectURL(file);
    try {
      const Compiler = await loadCompiler();
      const original = await loadImage(url);
      const scale = Math.min(1, MAX_SIDE / Math.max(original.naturalWidth, original.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(original.naturalWidth * scale);
      canvas.height = Math.round(original.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff'; // transparent PNGs get a white background, like on paper
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL('image/jpeg', 0.9);
      const picture = await loadImage(jpeg);

      const compiler = new Compiler();
      await compiler.compileImageTargets([picture], (p) => setProgress(Math.round(p)));
      const target = toBase64(await compiler.exportData());
      await apiRequest(`/api/admin/ar-models/${modelId}/triggers`, { method: 'POST', token, body: { image: jpeg.split(',')[1], target } });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error && err.message === 'unreadable'
            ? "That picture couldn't be read."
            : "Couldn't prepare that picture (the tracking tool needs an internet connection). Try again.",
      );
    } finally {
      URL.revokeObjectURL(url);
      setProgress(null);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await apiRequest(`/api/admin/ar-models/${modelId}/triggers/${id}`, { method: 'DELETE', token });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to remove that picture');
    }
  }

  const full = triggers.length >= max;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
            Trigger pictures <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({triggers.length}/{max})</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
            When a student’s AR camera sees one of these pictures — printed, or on a screen — this model appears standing on it.
          </div>
        </div>
        <label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={progress !== null || full}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void add(f);
            }}
          />
          <SecondaryButton
            disabled={progress !== null || full}
            onClick={(e) => ((e.currentTarget.parentElement as HTMLLabelElement).querySelector('input') as HTMLInputElement).click()}
          >
            + Add picture
          </SecondaryButton>
        </label>
      </div>

      {progress !== null && (
        <div role="status" style={{ fontSize: 13, color: 'var(--text)' }}>
          Preparing the picture for tracking… {progress}%
          <div style={{ height: 6, background: 'var(--primary-light)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)' }} />
          </div>
        </div>
      )}
      {error && (
        <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {triggers.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {triggers.map((t, i) => (
            <div key={t.id} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--table-header-bg)' }}>
              <img src={`${API_BASE_URL}${t.imageUrl}`} alt={`Trigger picture ${i + 1}`} style={{ width: '100%', height: 110, objectFit: 'contain', display: 'block' }} />
              <button
                type="button"
                aria-label={`Remove trigger picture ${i + 1}`}
                title="Remove"
                onClick={() => void remove(t.id)}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  border: 'none',
                  background: 'rgba(20,35,28,0.75)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        progress === null && (
          <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No trigger pictures yet. Add the pictures students will have in front of them — a diagram from the lesson, a textbook page, a poster.
          </div>
        )
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Detailed pictures work best (labelled diagrams, photos). Plain outlines, mostly-empty pages or repeating patterns are hard for the camera to
        recognise. The camera recognises these exact pictures, not every drawing of the same thing.
      </div>
    </div>
  );
}
