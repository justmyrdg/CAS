import { createElement, useEffect, useState } from 'react';

// Google's <model-viewer> web component renders .glb/.gltf models with orbit controls.
// Loaded once from Google's CDN on first use.
const SCRIPT_URL = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
let loading: Promise<void> | null = null;

export function loadModelViewer(): Promise<void> {
  if (customElements.get('model-viewer')) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load the 3D viewer'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export default function ModelViewer({ src, alt, height = 320 }: { src: string; alt: string; height?: number }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    loadModelViewer()
      .then(() => !cancelled && setState('ready'))
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  const frame = {
    width: '100%',
    height,
    borderRadius: 12,
    background: 'var(--table-header-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: 'var(--text-muted)',
  } as const;

  if (state === 'error') return <div style={frame}>3D preview unavailable (couldn't load the viewer — check your internet connection).</div>;
  if (state === 'loading') return <div style={frame}>Loading 3D viewer…</div>;

  // Custom element, so built with createElement rather than JSX (TS has no JSX types for it).
  return createElement('model-viewer', {
    src,
    alt,
    'camera-controls': '',
    'auto-rotate': '',
    'shadow-intensity': '1',
    style: { ...frame, display: 'block' },
  });
}
