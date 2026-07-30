// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { DEFAULT_SETTINGS } from '../core/model';
import { Settings } from '../types';

import SettingsComponent from './SettingsComponent';

function renderSettings(overrides: Partial<Settings> = {}) {
  const setSettings = vi.fn();

  render(
    <AppStateProvider>
      <SettingsComponent settings={{ ...DEFAULT_SETTINGS, ...overrides }} setSettings={setSettings} />
    </AppStateProvider>
  );

  return setSettings;
}

const NERD_ONLY_LABELS = [
  'Show tooltips on pattern points',
  'Highlight corresponding pre-wind point',
  'Use observed ground wind',
  'Interpolate winds',
  'Correct heading for rectangular turn',
  'Straighten legs'
];

/** Nerd-only dropdowns, which sit outside the checkbox tables. */
const NERD_ONLY_SELECTS = ['Map provider', 'Winds aloft source', 'Forecast model'];

describe('SettingsComponent nerd gating', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hides the nerd-only rows when nerd mode is off', () => {
    renderSettings({ nerd: false });

    for (const label of NERD_ONLY_LABELS) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('shows them when nerd mode is on', () => {
    renderSettings({ nerd: true });

    for (const label of NERD_ONLY_LABELS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('hides the nerd-only dropdowns when nerd mode is off', () => {
    renderSettings({ nerd: false });

    for (const label of NERD_ONLY_SELECTS) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
  });

  it('shows the dropdowns when nerd mode is on', () => {
    renderSettings({ nerd: true, windAloftSource: 'forecast' });

    for (const label of NERD_ONLY_SELECTS) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('drops a section whose every row is nerd-only', () => {
    // Pattern is entirely nerd-gated; with nerd off it must not leave a
    // bare header and divider behind.
    renderSettings({ nerd: false });
    expect(screen.queryByText('Pattern')).toBeNull();

    renderSettings({ nerd: true });
    expect(screen.getByText('Pattern')).toBeTruthy();
  });

  it('keeps the everyday rows in both states', () => {
    renderSettings({ nerd: false });

    expect(screen.getByText('Show pre-wind pattern')).toBeTruthy();
    expect(screen.getByText('Show drift angle arrows')).toBeTruthy();
    expect(screen.getByText('Show pattern point altitudes')).toBeTruthy();
  });

  it('offers the nerd toggle itself even when off', () => {
    // Otherwise the mode is unreachable: this row is the only way in.
    const setSettings = renderSettings({ nerd: false });

    fireEvent.click(screen.getByLabelText('Nerd mode'));

    expect(setSettings).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, nerd: true });
  });
});
