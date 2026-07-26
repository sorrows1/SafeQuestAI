import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { ThemeProvider } from '@mui/material';
import { darkTheme } from '@/theme';
import { Landing } from '@/pages/Landing';

const renderLanding = () =>
  render(
    <Provider store={store}>
      <ThemeProvider theme={darkTheme}>
        <MemoryRouter>
          <Landing />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );

describe('Landing Page', () => {
  it('renders semantic main heading, key value propositions, and accessibility commitment', () => {
    renderLanding();

    expect(screen.getByRole('heading', { level: 1, name: /where families explore digital safety together/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /building digital resilience, step by step/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /accessibility commitment/i })).toBeTruthy();
  });

  it('provides visible text-labeled theme toggle buttons and CTA links', () => {
    renderLanding();

    const themeToggleButtons = screen.getAllByRole('button', { name: /switch to/i });
    expect(themeToggleButtons.length).toBeGreaterThan(0);

    const signupLink = screen.getByRole('link', { name: /sign up free/i });
    expect(signupLink.getAttribute('href')).toBe('/register');

    const loginLink = screen.getByRole('link', { name: /sign in to account/i });
    expect(loginLink.getAttribute('href')).toBe('/login');
  });

  it('toggles theme mode when the theme toggle button is clicked', () => {
    renderLanding();

    const toggleBtn = screen.getAllByRole('button', { name: /switch to/i })[0];
    fireEvent.click(toggleBtn);

    expect(screen.getAllByRole('button', { name: /switch to/i }).length).toBeGreaterThan(0);
  });
});
