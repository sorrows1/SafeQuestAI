import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  themeMode: 'dark' | 'light';
  sidebarOpen: boolean;
  activeSection: string;
}

const initialState: UIState = {
  themeMode: 'dark',
  sidebarOpen: true,
  activeSection: 'dashboard',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<'dark' | 'light'>) => {
      state.themeMode = action.payload;
    },
    toggleTheme: (state) => {
      state.themeMode = state.themeMode === 'dark' ? 'light' : 'dark';
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setActiveSection: (state, action: PayloadAction<string>) => {
      state.activeSection = action.payload;
    },
  },
});

export const { setThemeMode, toggleTheme, setSidebarOpen, setActiveSection } = uiSlice.actions;
export default uiSlice.reducer;
