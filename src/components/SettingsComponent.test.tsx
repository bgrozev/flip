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
  'Highlight corresponding pre-wind point'
];

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
