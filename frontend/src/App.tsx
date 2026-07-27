import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { store } from '@/store';
import { useAppSelector } from '@/store';
import { darkTheme, lightTheme } from '@/theme';

import { ProtectedRoute, AdminRoute } from '@/auth/ProtectedRoute';

import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { AuthCallback } from '@/pages/auth/AuthCallback';

import { Dashboard } from '@/pages/admin/Dashboard';
import { ScenarioEditor } from '@/pages/admin/ScenarioEditor';
import { PersonaEditor } from '@/pages/admin/PersonaEditor';
import { StageEditor } from '@/pages/admin/StageEditor';
import { ObjectiveEditor } from '@/pages/admin/ObjectiveEditor';
import { ConstraintEditor } from '@/pages/admin/ConstraintEditor';
import { PromptEditor } from '@/pages/admin/PromptEditor';
import { ValidationConsole } from '@/pages/admin/ValidationConsole';
import { Settings } from '@/pages/admin/Settings';
import { Users } from '@/pages/admin/Users';
const SimulationWorkbench = lazy(() => import('@/pages/admin/SimulationWorkbench').then((module) => ({ default: module.SimulationWorkbench })));
const ReviewQueue = lazy(() => import('@/pages/admin/ReviewQueue').then((module) => ({ default: module.ReviewQueue })));
const CuratedContentReview = lazy(() => import('@/pages/admin/CuratedContentReview').then((module) => ({ default: module.CuratedContentReview })));
const AdminFallback = () => <div style={{ padding: 24 }}>Loading admin workspace…</div>;

import { FamilyScenarioLobby } from '@/pages/family/FamilyScenarioLobby';
import { CaregiverHub } from '@/pages/family/CaregiverHub';
import { InvitationAcceptView } from '@/pages/family/InvitationAcceptView';
import { Landing } from '@/pages/Landing';
import { FamilyScenarioPlayer } from '@/pages/family/FamilyScenarioPlayer';

export function legacyChatDestinationForRole(role?: string): '/admin' | '/family/scenarios' {
  return role === 'admin' ? '/admin' : '/family/scenarios';
}

function LegacyChatRedirect() {
  const role = useAppSelector((state) => state.auth.user?.role);
  return <Navigate to={legacyChatDestinationForRole(role)} replace />;
}

function AdminPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AdminFallback />}>{children}</Suspense>;
}

function ThemedApp() {
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const theme = useMemo(() => (themeMode === 'dark' ? darkTheme : lightTheme), [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={4} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} autoHideDuration={3000}>
        <BrowserRouter>
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route path="/" element={<Landing />} />
            <Route path="/chat/*" element={<LegacyChatRedirect />} />

            <Route
              path="/family/scenarios"
              element={
                <ProtectedRoute>
                  <FamilyScenarioLobby />
                </ProtectedRoute>
              }
            />
            <Route
              path="/family/scenarios/:transcriptId/sessions/:sessionId"
              element={
                <ProtectedRoute>
                  <FamilyScenarioPlayer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/family/hub"
              element={
                <ProtectedRoute>
                  <CaregiverHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/family/caregiver"
              element={
                <ProtectedRoute>
                  <CaregiverHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/family/invitations/accept"
              element={
                <ProtectedRoute>
                  <InvitationAcceptView />
                </ProtectedRoute>
              }
            />

            {/* Admin CMS */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Dashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/scenarios"
              element={
                <AdminRoute>
                  <ScenarioEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/scenarios/:id"
              element={
                <AdminRoute>
                  <ScenarioEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/personas"
              element={
                <AdminRoute>
                  <PersonaEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/stages"
              element={
                <AdminRoute>
                  <StageEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/objectives"
              element={
                <AdminRoute>
                  <ObjectiveEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/constraints"
              element={
                <AdminRoute>
                  <ConstraintEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/prompts"
              element={
                <AdminRoute>
                  <PromptEditor />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/simulator"
              element={
                <AdminRoute>
                  <AdminPage><SimulationWorkbench /></AdminPage>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/simulator/:runId"
              element={
                <AdminRoute>
                  <AdminPage><SimulationWorkbench /></AdminPage>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/validation"
              element={
                <AdminRoute>
                  <ValidationConsole />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/review-queue"
              element={
                <AdminRoute>
                  <AdminPage><ReviewQueue /></AdminPage>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/curated-transcripts/:id/review"
              element={
                <AdminRoute>
                  <AdminPage><CuratedContentReview /></AdminPage>
                </AdminRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemedApp />
    </Provider>
  );
}
