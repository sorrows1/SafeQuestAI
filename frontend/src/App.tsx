import { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { store } from '@/store';
import { useAppSelector } from '@/store';
import { darkTheme, lightTheme } from '@/theme';
import { Dashboard } from '@/pages/Dashboard';
import { ScenarioEditor } from '@/pages/ScenarioEditor';
import { PersonaEditor } from '@/pages/PersonaEditor';
import { StageEditor } from '@/pages/StageEditor';
import { ObjectiveEditor } from '@/pages/ObjectiveEditor';
import { ConstraintEditor } from '@/pages/ConstraintEditor';
import { PromptEditor } from '@/pages/PromptEditor';
import { Simulator } from '@/pages/Simulator';
import { ValidationConsole } from '@/pages/ValidationConsole';
import { Settings } from '@/pages/Settings';

function ThemedApp() {
  const themeMode = useAppSelector(s => s.ui.themeMode);
  const theme = useMemo(() => themeMode === 'dark' ? darkTheme : lightTheme, [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={4} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        autoHideDuration={3000}>
        <BrowserRouter>
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/scenarios"   element={<ScenarioEditor />} />
            <Route path="/scenarios/:id" element={<ScenarioEditor />} />
            <Route path="/personas"    element={<PersonaEditor />} />
            <Route path="/stages"      element={<StageEditor />} />
            <Route path="/objectives"  element={<ObjectiveEditor />} />
            <Route path="/constraints" element={<ConstraintEditor />} />
            <Route path="/prompts"     element={<PromptEditor />} />
            <Route path="/simulator"   element={<Simulator />} />
            <Route path="/validation"  element={<ValidationConsole />} />
            <Route path="/settings"    element={<Settings />} />
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
