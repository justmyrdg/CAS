import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './state/AuthContext';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import MyClasses from './pages/MyClasses';
import ClassDetail from './pages/ClassDetail';
import ClassEditPage from './pages/ClassEditPage';
import ContentItemPage from './pages/ContentItemPage';
import AssessmentFormPage from './pages/assessments/AssessmentFormPage';
import AssessmentResultsPage from './pages/assessments/AssessmentResultsPage';
import AttemptPage from './pages/assessments/AttemptPage';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';

function SessionLoading() {
  return <div style={{ padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>;
}

// Signed-in pages. Waits for the saved session to be restored on page load, and
// holds anyone still on a temporary password on the Change Password page.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const { pathname } = useLocation();
  if (initializing) return <SessionLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

// The login page, skipped when already signed in.
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return <SessionLoading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/classes" element={<RequireAuth><MyClasses /></RequireAuth>} />
      <Route path="/classes/:id/:tab?" element={<RequireAuth><ClassDetail /></RequireAuth>} />
      <Route path="/classes/:id/edit" element={<RequireAuth><ClassEditPage /></RequireAuth>} />
      <Route path="/classes/:id/content/:itemId" element={<RequireAuth><ContentItemPage /></RequireAuth>} />
      <Route path="/classes/:id/assessments/new" element={<RequireAuth><AssessmentFormPage key="new" /></RequireAuth>} />
      <Route path="/classes/:id/assessments/:assessmentId/edit" element={<RequireAuth><AssessmentFormPage key="edit" /></RequireAuth>} />
      <Route path="/classes/:id/assessments/:assessmentId" element={<RequireAuth><AssessmentResultsPage /></RequireAuth>} />
      <Route path="/classes/:id/assessments/:assessmentId/attempts/:attemptId" element={<RequireAuth><AttemptPage /></RequireAuth>} />
      <Route path="/create-class" element={<Navigate to="/classes?new=1" replace />} />
      {/* Enrollment, performance and at-risk are per-class tabs now; keep old links working. */}
      <Route path="/enrollment" element={<Navigate to="/classes" replace />} />
      <Route path="/performance" element={<Navigate to="/classes" replace />} />
      <Route path="/at-risk" element={<Navigate to="/classes" replace />} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
