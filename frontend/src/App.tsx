import { lazy, Suspense, useMemo } from 'react';
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
const AdminFallback = () => <div style={{ padding: 24 }}>Loading admin workspace…</div>;


import { FamilyScenarioLobby } from "@/pages/family/FamilyScenarioLobby";
import { Landing } from "@/pages/Landing";
import { FamilyScenarioPlayer } from "@/pages/family/FamilyScenarioPlayer";

function ThemedApp() {
  const themeMode = useAppSelector(s => s.ui.themeMode);
  const theme = useMemo(() => themeMode === 'dark' ? darkTheme : lightTheme, [themeMode]);

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
            <Route path="/chat/*" element={<Navigate to="/family/scenarios" replace />} />

            <Route path="/family/scenarios" element={<ProtectedRoute><FamilyScenarioLobby /></ProtectedRoute>} />
            <Route path="/family/scenarios/:transcriptId/sessions/:sessionId" element={<ProtectedRoute><FamilyScenarioPlayer /></ProtectedRoute>} />

            {/* Admin CMS */}
            <Route path="/admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/admin/scenarios" element={<AdminRoute><ScenarioEditor /></AdminRoute>} />
            <Route path="/admin/scenarios/:id" element={<AdminRoute><ScenarioEditor /></AdminRoute>} />
            <Route path="/admin/personas" element={<AdminRoute><PersonaEditor /></AdminRoute>} />
            <Route path="/admin/stages" element={<AdminRoute><StageEditor /></AdminRoute>} />
            <Route path="/admin/objectives" element={<AdminRoute><ObjectiveEditor /></AdminRoute>} />
            <Route path="/admin/constraints" element={<AdminRoute><ConstraintEditor /></AdminRoute>} />
            <Route path="/admin/prompts" element={<AdminRoute><PromptEditor /></AdminRoute>} />
            <Route path="/admin/simulator" element={<AdminRoute><Suspense fallback={<AdminFallback />}><SimulationWorkbench /></Suspense></AdminRoute>} />
            <Route path="/admin/simulator/:runId" element={<AdminRoute><Suspense fallback={<AdminFallback />}><SimulationWorkbench /></Suspense></AdminRoute>} />
            <Route path="/admin/validation" element={<AdminRoute><ValidationConsole /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><Settings /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="/admin/review-queue" element={<AdminRoute><Suspense fallback={<AdminFallback />}><ReviewQueue /></Suspense></AdminRoute>} />

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
