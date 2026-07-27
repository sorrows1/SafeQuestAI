import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = "dark" | "light";
export const THEME_STORAGE_KEY = "safe-quest-theme";

export function resolveInitialThemeMode(storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined, prefersDark = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false): ThemeMode {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage can be unavailable in privacy-restricted contexts.
  }
  return prefersDark ? "dark" : "light";
}

function persistThemeMode(mode: ThemeMode) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // The visual preference remains available for this running session.
  }
}

interface UIState {
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  activeSection: string;
}

const initialState: UIState = {
  themeMode: resolveInitialThemeMode(),
  sidebarOpen: true,
  activeSection: "dashboard",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload;
      persistThemeMode(action.payload);
    },
    toggleTheme: (state) => {
      state.themeMode = state.themeMode === "dark" ? "light" : "dark";
      persistThemeMode(state.themeMode);
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setActiveSection: (state, action: PayloadAction<string>) => {
      state.activeSection = action.payload;
    },
  },
});

export const { setThemeMode, toggleTheme, setSidebarOpen, toggleSidebar, setActiveSection } = uiSlice.actions;
export default uiSlice.reducer;
