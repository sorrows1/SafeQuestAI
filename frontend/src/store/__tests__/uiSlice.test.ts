import { describe, expect, it, beforeEach, vi } from 'vitest';
import uiReducer, {
  resolveInitialThemeMode,
  setThemeMode,
  toggleTheme,
  setSidebarOpen,
  setActiveSection,
  THEME_STORAGE_KEY,
} from '../uiSlice';

describe('uiSlice & Theme Controller Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves initial theme from localStorage when valid', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(resolveInitialThemeMode()).toBe('light');

    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(resolveInitialThemeMode()).toBe('dark');
  });

  it('ignores invalid strings in localStorage and falls back to system preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid_mode');
    expect(resolveInitialThemeMode(localStorage, true)).toBe('dark');
    expect(resolveInitialThemeMode(localStorage, false)).toBe('light');

    localStorage.setItem(THEME_STORAGE_KEY, '');
    expect(resolveInitialThemeMode(localStorage, true)).toBe('dark');
  });

  it('handles storage security exceptions in privacy-restricted contexts gracefully', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('Access denied');
      },
      setItem: () => {
        throw new Error('Access denied');
      },
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    // Should catch SecurityError and use prefersDark without throwing
    expect(resolveInitialThemeMode(throwingStorage as unknown as Storage, true)).toBe('dark');
    expect(resolveInitialThemeMode(throwingStorage as unknown as Storage, false)).toBe('light');
  });

  it('toggles theme and persists to storage', () => {
    const initialState = { themeMode: 'dark' as const, sidebarOpen: true, activeSection: 'dashboard' };
    const nextState = uiReducer(initialState, toggleTheme());

    expect(nextState.themeMode).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    const thirdState = uiReducer(nextState, toggleTheme());
    expect(thirdState.themeMode).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('sets explicit theme mode', () => {
    const initialState = { themeMode: 'dark' as const, sidebarOpen: true, activeSection: 'dashboard' };
    const nextState = uiReducer(initialState, setThemeMode('light'));

    expect(nextState.themeMode).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('handles setSidebarOpen and setActiveSection reducers', () => {
    const initialState = { themeMode: 'dark' as const, sidebarOpen: true, activeSection: 'dashboard' };
    
    const s1 = uiReducer(initialState, setSidebarOpen(false));
    expect(s1.sidebarOpen).toBe(false);

    const s2 = uiReducer(s1, setActiveSection('settings'));
    expect(s2.activeSection).toBe('settings');
  });
});
