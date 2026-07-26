import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/theme';
import type { PublishedFamilyScenario } from '@/types';
import { ScenarioBrowserView } from '../ScenarioBrowserView';

const mockScenario: PublishedFamilyScenario = {
  id: 101,
  title: 'Online Gaming Squad Pressure',
  summary: 'A squad member demands your private password.',
  category: 'grooming',
  render_skin: 'chat',
  difficulty: 'Medium',
  tags: ['privacy', 'gaming'],
  learning_objectives: ['Set boundaries', 'Report pressure'],
  message_count: 8,
  checkpoint_count: 2,
  published_at: '2026-07-25T00:00:00Z',
  supported_participation_modes: ['with_parent', 'with_companion'],
};

const defaultProps = {
  items: [mockScenario],
  total: 1,
  page: 1,
  input: '',
  onInputChange: vi.fn(),
  category: [],
  onToggleCategory: vi.fn(),
  difficulty: [],
  onToggleDifficulty: vi.fn(),
  renderSkin: [],
  onToggleSkin: vi.fn(),
  sort: 'newest' as const,
  onSortChange: vi.fn(),
  onPageChange: vi.fn(),
  filtered: false,
  onClearFilters: vi.fn(),
  isLoading: false,
  isFetching: false,
  isError: false,
  queryStatus: undefined,
  onRefetch: vi.fn(),
  selected: null,
  onSelectScenario: vi.fn(),
  onStartSolo: vi.fn(),
  creating: false,
  createError: false,
};

const renderBrowser = (props = {}) =>
  render(
    <ThemeProvider theme={darkTheme}>
      <ScenarioBrowserView {...defaultProps} {...props} />
    </ThemeProvider>
  );

describe('ScenarioBrowserView Presenter & Edge Cases', () => {
  it('renders header, featured banner, and scenario cards when data is present', () => {
    renderBrowser();

    expect(screen.getByRole('heading', { level: 1, name: /explore together/i })).toBeTruthy();
    expect(screen.getByText(/featured scenario/i)).toBeTruthy();
    expect(screen.getAllByText('Online Gaming Squad Pressure').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /learn more about online gaming squad pressure/i })).toBeTruthy();
  });

  it('hides featured scenario banner when filters are active', () => {
    renderBrowser({ filtered: true, category: ['grooming'] });

    expect(screen.queryByText(/featured scenario/i)).toBeNull();
  });

  it('triggers search input change callback when user types', () => {
    const onInputChange = vi.fn();
    renderBrowser({ onInputChange });

    const searchInput = screen.getByRole('textbox', { name: /search reviewed scenarios/i });
    fireEvent.change(searchInput, { target: { value: 'gaming' } });

    expect(onInputChange).toHaveBeenCalledWith('gaming');
  });

  it('triggers category, difficulty, skin, and clear filter callbacks', () => {
    const onToggleCategory = vi.fn();
    const onToggleDifficulty = vi.fn();
    const onToggleSkin = vi.fn();
    const onClearFilters = vi.fn();

    renderBrowser({
      onToggleCategory,
      onToggleDifficulty,
      onToggleSkin,
      onClearFilters,
      filtered: true,
      category: ['grooming'],
    });

    // Category button
    fireEvent.click(screen.getByRole('button', { name: /^cyberbullying$/i }));
    expect(onToggleCategory).toHaveBeenCalledWith('cyberbullying');

    // Difficulty chip
    fireEvent.click(screen.getByText(/^Easy$/));
    expect(onToggleDifficulty).toHaveBeenCalledWith('Easy');

    // Format skin chip
    fireEvent.click(screen.getByText(/^Email$/));
    expect(onToggleSkin).toHaveBeenCalledWith('email');

    // Clear filters
    fireEvent.click(screen.getByRole('button', { name: /clear all filters/i }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('handles pagination controls and disables Previous on page 1', () => {
    const onPageChange = vi.fn();
    renderBrowser({ total: 24, page: 1, onPageChange });

    const prevBtn = screen.getByRole('button', { name: /previous/i });
    const nextBtn = screen.getByRole('button', { name: /next/i });

    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables Next button on the last page', () => {
    const onPageChange = vi.fn();
    renderBrowser({ total: 12, page: 1, onPageChange });

    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders scenario setup modal with participation mode choices and launches solo activity', () => {
    const onStartSolo = vi.fn();
    const onSelectScenario = vi.fn();

    renderBrowser({
      selected: mockScenario,
      onStartSolo,
      onSelectScenario,
    });

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/solo activity with ai companion/i)).toBeTruthy();
    expect(screen.getByText(/invite family member/i)).toBeTruthy();
    expect(screen.getByText(/join active session/i)).toBeTruthy();

    // Click participation options
    fireEvent.click(screen.getByText(/invite family member/i));
    fireEvent.click(screen.getByText(/join active session/i));

    // Click start solo activity
    fireEvent.click(screen.getByRole('button', { name: /start solo activity/i }));
    expect(onStartSolo).toHaveBeenCalled();
  });

  it('renders creation error alert inside setup modal when createError is true', () => {
    renderBrowser({
      selected: mockScenario,
      createError: true,
    });

    expect(screen.getByText(/the solo session could not be started/i)).toBeTruthy();
  });

  it('renders loading skeletons when isLoading is true', () => {
    renderBrowser({ isLoading: true, items: [], total: 0 });

    expect(screen.queryByText('Online Gaming Squad Pressure')).toBeNull();
  });

  it('renders offline FETCH_ERROR and 401 session ended error states with retry callback', () => {
    const onRefetch = vi.fn();
    const { rerender } = renderBrowser({ isError: true, queryStatus: 'FETCH_ERROR', onRefetch });

    expect(screen.getByText(/you appear to be offline/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRefetch).toHaveBeenCalled();

    rerender(
      <ThemeProvider theme={darkTheme}>
        <ScenarioBrowserView {...defaultProps} isError queryStatus={401} />
      </ThemeProvider>
    );

    expect(screen.getByText(/your session has ended/i)).toBeTruthy();
  });

  it('renders empty library state alert when total is 0', () => {
    renderBrowser({ items: [], total: 0, filtered: false });

    expect(screen.getByText(/reviewed scenarios are being prepared/i)).toBeTruthy();
  });
});
