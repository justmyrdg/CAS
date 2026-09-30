import { createElement, useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { PrimaryButton, SecondaryButton } from './ui';
import { fieldLabelStyle, inputStyle } from './Modal';
import { loadModelViewer } from './ModelViewer';

// A point of interest on an AR model (same shape as backend src/utils/arHotspots.ts). Coordinates are the model's
// own glTF coordinates, as <model-viewer>'s positionAndNormalFromPoint returns them.
export interface Hotspot {
  id: string;
  position: [number, number, number];
  normal: [number, number, number];
  title: string;
  description: string;
}

export const MAX_HOTSPOTS = 30;

interface ModelViewerElement extends HTMLElement {
  positionAndNormalFromPoint(clientX: number, clientY: number): { position: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } } | null;
}

const vec = (v: { x: number; y: number; z: number }): [number, number, number] => [v.x, v.y, v.z];
const attr = (v: number[]) => v.map((n) => `${n}m`).join(' ');

// The model with numbered pins. "+ Add point" (or a point's "Move") arms placement: the next click on the model's
// surface drops the pin there. Pins, titles and descriptions are saved together with "Save points".
export default function HotspotEditor({
  src,
  alt,
  initial,
  onSave,
}: {
  src: string;
  alt: string;
  initial: Hotspot[];
  onSave: (hotspots: Hotspot[]) => Promise<void>;
}) {
  const [ready, setReady] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hotspots, setHotspots] = useState<Hotspot[]>(initial);
  const [savedJson, setSavedJson] = useState(JSON.stringify(initial));
  const [selected, setSelected] = useState<string | null>(null);
  // 'new' = the next click adds a point; an id = the next click moves that point.
  const [placing, setPlacing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const viewer = useRef<ModelViewerElement | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const cards = useRef<Record<string, HTMLDivElement | null>>({});

  const dirty = JSON.stringify(hotspots) !== savedJson;

  useEffect(() => {
    let cancelled = false;
    loadModelViewer()
      .then(() => !cancelled && setReady('ready'))
      .catch(() => !cancelled && setReady('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selected) cards.current[selected]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  function update(id: string, patch: Partial<Hotspot>) {
    setHotspots((list) => list.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    setSavedNote(false);
  }

  // A click (not the end of a drag-to-rotate) while placing drops/moves the pin where it hits the model.
  function onViewerClick(e: MouseEvent) {
    const start = downAt.current;
    if (!placing || !viewer.current || (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5)) return;
    // model-viewer 4 takes viewport (client) coordinates here, not coordinates relative to the element.
    const hit = viewer.current.positionAndNormalFromPoint(e.clientX, e.clientY);
    if (!hit) return; // missed the model
    const position = vec(hit.position);
    const normal = vec(hit.normal);
    if (placing === 'new') {
      const id = crypto.randomUUID();
      setHotspots((list) => [...list, { id, position, normal, title: '', description: '' }]);
      setSelected(id);
    } else {
      update(placing, { position, normal });
      setSelected(placing);
    }
    setPlacing(null);
    setSavedNote(false);
  }

  async function save() {
    const untitled = hotspots.findIndex((h) => !h.title.trim());
    if (untitled >= 0) {
      setError(`Point ${untitled + 1} needs a title.`);
      setSelected(hotspots[untitled].id);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const clean = hotspots.map((h) => ({ ...h, title: h.title.trim(), description: h.description.trim() }));
      await onSave(clean);
      setHotspots(clean);
      setSavedJson(JSON.stringify(clean));
      setSavedNote(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save points');
    } finally {
      setSaving(false);
    }
  }

  const frame = { width: '100%', height: 440, borderRadius: 12, background: 'var(--table-header-bg)' } as const;
  const placingIndex = placing === 'new' ? hotspots.length + 1 : hotspots.findIndex((h) => h.id === placing) + 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative' }}>
        {ready === 'ready' ? (
          createElement(
            'model-viewer',
            {
              ref: viewer,
              src,
              alt,
              'camera-controls': '',
              'shadow-intensity': '1',
              'interaction-prompt': 'none',
              onPointerDown: (e: PointerEvent) => {
                downAt.current = { x: e.clientX, y: e.clientY };
              },
              onClick: onViewerClick,
              style: { ...frame, display: 'block', cursor: placing ? 'crosshair' : 'grab' },
            },
            hotspots.map((h, i) =>
              createElement(
                'button',
                {
                  // Re-created when moved: model-viewer reads data-position when a hotspot is slotted in.
                  key: `${h.id}:${h.position.join(',')}`,
                  slot: `hotspot-${h.id}`,
                  'data-position': attr(h.position),
                  'data-normal': attr(h.normal),
                  // model-viewer 4 only toggles data-visible (facing the camera) on hotspots that ask for it.
                  'data-visibility-attribute': 'visible',
                  className: `hs-pin${selected === h.id ? ' hs-pin-selected' : ''}`,
                  type: 'button',
                  'aria-label': `Point ${i + 1}${h.title ? `: ${h.title}` : ''}`,
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation();
                    setSelected(h.id);
                  },
                },
                String(i + 1),
              ),
            ),
          )
        ) : (
          <div style={{ ...frame, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            {ready === 'error' ? "3D preview unavailable (couldn't load the viewer — check your internet connection)." : 'Loading 3D viewer…'}
          </div>
        )}
        {placing && (
          <div
            role="status"
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--primary-dark)',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
            }}
          >
            <span style={{ flex: 1 }}>
              Click on the model to {placing === 'new' ? 'place' : 'move'} point {placingIndex}. Drag to turn the model first if you need to.
            </span>
            <button
              type="button"
              onClick={() => setPlacing(null)}
              style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Points of interest ({hotspots.length})</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Numbered pins students can tap in the 3D view and in AR to read about that part.</div>
          </div>
          <SecondaryButton disabled={hotspots.length >= MAX_HOTSPOTS || ready !== 'ready'} onClick={() => setPlacing('new')}>
            + Add point
          </SecondaryButton>
        </div>

        {hotspots.length === 0 && (
          <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
            No points yet. Click “+ Add point”, then click the spot on the model.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
          {hotspots.map((h, i) => (
            <div
              key={h.id}
              ref={(el) => {
                cards.current[h.id] = el;
              }}
              onFocus={() => setSelected(h.id)}
              style={{
                border: selected === h.id ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: 10,
                padding: 12,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span className="hs-pin hs-pin-static" aria-hidden="true">
                {i + 1}
              </span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <label>
                  <span style={fieldLabelStyle}>Title</span>
                  <input
                    value={h.title}
                    maxLength={80}
                    placeholder="e.g. Frontal lobe"
                    onChange={(e) => update(h.id, { title: e.target.value })}
                    style={{ ...inputStyle, padding: '8px 10px' }}
                  />
                </label>
                <label>
                  <span style={fieldLabelStyle}>Information</span>
                  <textarea
                    rows={3}
                    value={h.description}
                    maxLength={1000}
                    placeholder="What students should know about this part"
                    onChange={(e) => update(h.id, { description: e.target.value })}
                    style={{ ...inputStyle, padding: '8px 10px', resize: 'vertical' }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SecondaryButton onClick={() => setPlacing(h.id)} style={{ padding: '5px 10px', fontSize: 12 }}>
                  Move
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => {
                    setHotspots((list) => list.filter((x) => x.id !== h.id));
                    setSavedNote(false);
                  }}
                  style={{ padding: '5px 10px', fontSize: 12, color: 'var(--danger-text)' }}
                >
                  Delete
                </SecondaryButton>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div role="alert" style={{ color: 'var(--danger-text)', fontSize: 13 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {dirty && <span style={{ fontSize: 12, color: 'var(--warning-text)' }}>Unsaved changes</span>}
          {savedNote && !dirty && <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>✓ Points saved</span>}
          <PrimaryButton disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save points'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
