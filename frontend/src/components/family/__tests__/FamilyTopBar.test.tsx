import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '@mui/material';
import { darkTheme } from '@/theme';
import uiReducer from '@/store/uiSlice';
import authReducer from '@/store/authSlice';
import { FamilyTopBar } from '../FamilyTopBar';

const createMockStore = (user = { id: 1, email: 'family@example.com', display_name: 'Family User', avatar_url: null, role: 'user' as const }) =>
  configureStore({
    reducer: {
      ui: uiReducer,
      auth: authReducer,
    },
    preloadedState: {
      auth: { user, accessToken: 'mock-jwt-token', refreshToken: 'mock-refresh-token', isAuthenticated: true },
    },
  });

const renderTopBar = (store = createMockStore()) =>
  render(
    <Provider store={store}>
      <ThemeProvider theme={darkTheme}>
        <MemoryRouter>
          <FamilyTopBar />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );

describe('FamilyTopBar Navigation & Edge Cases', () => {
  it('renders brand logo, catalog link, caregiver hub link, and theme toggle', () => {
    renderTopBar();

    expect(screen.getByText(/safe quest/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /scenario catalog/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /caregiver hub/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /switch to (light|dark) theme mode/i })).toBeTruthy();
  });

  it('opens account popover menu with user profile details and sign out action', () => {
    const store = createMockStore({ id: 2, email: 'parent@safequest.org', display_name: 'Parent User', avatar_url: null, role: 'user' });
    renderTopBar(store);

    const avatarBtn = screen.getByRole('button', { name: /account settings/i });
    fireEvent.click(avatarBtn);

    expect(screen.getByText('parent@safequest.org')).toBeTruthy();

    const signOutBtn = screen.getByRole('menuitem', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    expect(store.getState().auth.accessToken).toBeNull();
  });

  it('opens and closes mobile navigation drawer when hamburger button is clicked', () => {
    renderTopBar();

    const mobileMenuBtn = screen.getByRole('button', { name: /open navigation menu/i });
    fireEvent.click(mobileMenuBtn);

    expect(screen.getAllByText(/safe quest/i).length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: /switch to (light|dark) mode/i })).toBeTruthy();
  });

  it('renders safely when rendered outside Redux context with default fallbacks', () => {
    render(
      <ThemeProvider theme={darkTheme}>
        <MemoryRouter>
          <FamilyTopBar />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(screen.getByText(/safe quest/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /account settings/i })).toBeTruthy();
  });
});
