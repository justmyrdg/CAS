import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { PrimaryButton } from '../components/ui';
import { API_BASE_URL, apiRequest } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import type { ArModelRow } from './ArLibrary';

const MARKER_URL = `${API_BASE_URL}/api/ar-marker/marker.png`;

// What the student app's AR scanner looks for (student-mobile src/lib/arPages.ts reads the same prefix).
const arCardCode = (modelId: string) => `cogniview-ar:${modelId}`;

// /ar-library/:id/card — the printable AR card for one model: the shared tracking marker plus a QR code that tells the
// student app's scanner which model to show on it. The QR sits outside the marker image so it doesn't affect tracking.
export default function ArCardPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const [model, setModel] = useState<ArModelRow | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiRequest<{ model: ArModelRow }>(`/api/admin/ar-models/${id}`, { token: accessToken })
      .then((data) => setModel(data.model))
      .catch(() => setError('Unable to load this model.'));
    QRCode.toDataURL(arCardCode(id), { errorCorrectionLevel: 'M', margin: 1, width: 480, color: { dark: '#123C2C', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setError('Unable to make the QR code.'));
  }, [id, accessToken]);

  return (
    <div className="print-sheet" style={{ minHeight: '100vh', background: '#fff', padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print { .no-print { display: none !important; } .print-sheet { padding: 0 !important; } }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16 }}>
        <Link to={id ? `/ar-library/${id}` : '/ar-library'} style={{ fontSize: 13, fontWeight: 500 }}>
          ‹ Back to model
        </Link>
        <PrimaryButton onClick={() => window.print()} disabled={!model || !qr}>
          Print card
        </PrimaryButton>
      </div>
      {error && <div style={{ color: 'var(--danger-text)', marginBottom: 12 }}>{error}</div>}

      {model && qr && (
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <img src={MARKER_URL} alt="CogniView AR marker" style={{ width: '100%', display: 'block' }} />
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 18, border: '2px solid var(--primary-dark)', borderRadius: 12, padding: 16 }}>
            <img src={qr} alt={`QR code for ${model.name}`} style={{ width: 150, height: 150, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--primary)', textTransform: 'uppercase' }}>CogniView AR card</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '2px 0 8px', overflowWrap: 'anywhere' }}>{model.name}</div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                <li>Open the CogniView AR app and tap the camera button at the bottom.</li>
                <li>Scan this QR code, then point the camera at the marker above.</li>
                <li>Tap the numbered pins on the model to learn about each part.</li>
              </ol>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
            Print at full size and keep the card flat. Good light and no glare help the camera find the marker.
          </div>
        </div>
      )}
    </div>
  );
}
