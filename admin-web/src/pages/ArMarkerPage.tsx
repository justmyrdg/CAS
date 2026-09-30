import { Link } from 'react-router-dom';
import { PrimaryButton } from '../components/ui';
import { API_BASE_URL } from '../lib/apiClient';

const MARKER_URL = `${API_BASE_URL}/api/ar-marker/marker.png`;

// /ar-library/marker — the printed marker every AR model appears on (student app → AR camera).
// A plain page without the sidebar so it prints as one clean A4 sheet.
export default function ArMarkerPage() {
  return (
    <div className="print-sheet" style={{ minHeight: '100vh', background: '#fff', padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print { .no-print { display: none !important; } .print-sheet { padding: 0 !important; } }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <Link to="/ar-library" style={{ fontSize: 13, fontWeight: 500 }}>
          ‹ AR Model Library
        </Link>
        <PrimaryButton onClick={() => window.print()}>Print marker</PrimaryButton>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div className="serif" style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary-dark)' }}>
          CogniView <span style={{ color: 'var(--primary)' }}>AR</span> marker
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
          Open a lesson's hands-on activity in the CogniView AR app, then point the camera at this marker.
        </div>
        <img src={MARKER_URL} alt="CogniView AR marker" style={{ width: '100%', maxWidth: 560, display: 'block', margin: '22px auto' }} />
        <ul style={{ textAlign: 'left', maxWidth: 560, margin: '0 auto', paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
          <li>Print at full size, in colour if you can, and keep the paper flat and uncreased.</li>
          <li>Use good light and avoid glare. Hold the phone 25–50 cm away so the whole marker is in view.</li>
          <li>Every AR model appears on this same marker — students only need one copy.</li>
          <li>No printer? Students can also point the camera at this marker shown on a laptop or tablet screen.</li>
        </ul>
      </div>
    </div>
  );
}
