import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './state/AuthContext';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import SubjectsPage from './pages/subjects/SubjectsPage';
import SubjectPage from './pages/subjects/SubjectPage';
import SubjectFormPage from './pages/subjects/SubjectFormPage';
import ModuleWorkspace from './pages/subjects/ModuleWorkspace';
import ModuleFormPage from './pages/subjects/ModuleFormPage';
import LessonFormPage from './pages/subjects/LessonFormPage';
import QuizFormPage from './pages/subjects/QuizFormPage';
import ArLibrary from './pages/ArLibrary';
import Classes from './pages/Classes';
import Instructors from './pages/Instructors';
import Students from './pages/Students';
import Administrators from './pages/Administrators';
import ArModelPage from './pages/ArModelPage';
import ArMarkerPage from './pages/ArMarkerPage';
import ArCardPage from './pages/ArCardPage';
import Assessments from './pages/Assessments';

// "Catalog" was renamed to "Subjects"; keep old /catalog links working.
function CatalogRedirect() {
  const { subjectId } = useParams();
  return <Navigate to={subjectId ? `/subjects/${subjectId}` : '/subjects'} replace />;
}

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
      <Route path="/subjects" element={<RequireAuth><SubjectsPage /></RequireAuth>} />
      <Route path="/subjects/new" element={<Navigate to="/subjects?new=1" replace />} />
      <Route path="/subjects/:subjectId" element={<RequireAuth><SubjectPage /></RequireAuth>} />
      <Route path="/subjects/:subjectId/edit" element={<RequireAuth><SubjectFormPage /></RequireAuth>} />
      {/* The module editor and its lesson/quiz editors share ModuleWorkspace (outline + editor pane), which stays mounted
          across these routes. Distinct keys so going from "new" to "edit" (after Create) remounts the module form. */}
      <Route element={<RequireAuth><ModuleWorkspace /></RequireAuth>}>
        <Route path="/subjects/:subjectId/modules/new" element={<ModuleFormPage key="new" />} />
        <Route path="/subjects/:subjectId/modules/:moduleId/edit" element={<ModuleFormPage key="edit" />} />
        <Route path="/subjects/:subjectId/chapters/:chapterId/lessons/new" element={<LessonFormPage />} />
        <Route path="/subjects/:subjectId/lessons/:itemId/edit" element={<LessonFormPage />} />
        <Route path="/subjects/:subjectId/chapters/:chapterId/quizzes/new" element={<QuizFormPage />} />
        <Route path="/subjects/:subjectId/quizzes/:itemId/edit" element={<QuizFormPage />} />
      </Route>
      <Route path="/catalog" element={<CatalogRedirect />} />
      <Route path="/catalog/:subjectId/*" element={<CatalogRedirect />} />
      <Route path="/ar-library" element={<RequireAuth><ArLibrary /></RequireAuth>} />
      <Route path="/classes" element={<RequireAuth><Classes /></RequireAuth>} />
      <Route path="/instructors" element={<RequireAuth><Instructors /></RequireAuth>} />
      <Route path="/students" element={<RequireAuth><Students /></RequireAuth>} />
      <Route path="/administrators" element={<RequireAuth><Administrators /></RequireAuth>} />
      <Route path="/ar-library/marker" element={<RequireAuth><ArMarkerPage /></RequireAuth>} />
      <Route path="/ar-library/new" element={<Navigate to="/ar-library?new=1" replace />} />
      <Route path="/ar-library/:id" element={<RequireAuth><ArModelPage /></RequireAuth>} />
      <Route path="/ar-library/:id/card" element={<RequireAuth><ArCardPage /></RequireAuth>} />
      <Route path="/assessments" element={<RequireAuth><Assessments /></RequireAuth>} />
      {/* Reports was merged into the Dashboard. */}
      <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
