// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { SOURCE_MANUAL, createWindProfile, createWindRow } from '../core/wind';

import WindsComponent from './WindsComponent';

function renderWinds({
  allowManualEdit,
  manual = false,
  bands = []
}: {
  allowManualEdit: boolean;
  manual?: boolean;
  bands?: number[];
}) {
  const rows = [
    createWindRow(0, 270, 8),
    createWindRow(1000, 275, 11),
    createWindRow(2000, 280, 15),
    createWindRow(3000, 285, 18)
  ];
  const winds = manual
    ? createWindProfile(rows)
    : { ...createWindProfile(rows), groundSource: 'forecast', aloftSource: 'forecast' };

  render(
    <AppStateProvider>
      <WindsComponent
        winds={winds}
        setWinds={vi.fn()}
        fetching={false}
        fetch={vi.fn()}
        forecastTime={null}
        onForecastTimeChange={vi.fn()}
        allowManualEdit={allowManualEdit}
        bandAltitudesFt={bands}
      />
    </AppStateProvider>
  );
}

describe('WindsComponent manual-wind gating', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers Unlock when manual editing is allowed', () => {
    renderWinds({ allowManualEdit: true });

    expect(screen.getByRole('button', { name: 'Unlock' })).toBeTruthy();
  });

  it('hides Unlock entirely without the feature', () => {
    renderWinds({ allowManualEdit: false });

    expect(screen.queryByRole('button', { name: 'Unlock' })).toBeNull();
  });

  it('keeps an already-manual profile read-only without the feature', () => {
    // A profile hand-entered in a previous nerd session must not stay
    // editable — and Invert is part of that editing UI.
    renderWinds({ allowManualEdit: false, manual: true });

    expect(screen.queryByRole('button', { name: 'Invert' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unlock' })).toBeNull();
  });

  it('shows the editing UI for a manual profile with the feature', () => {
    renderWinds({ allowManualEdit: true, manual: true });

    expect(screen.getByRole('button', { name: 'Invert' })).toBeTruthy();
  });

  it('still shows the wind data itself when locked down', () => {
    renderWinds({ allowManualEdit: false });

    expect(screen.getByText(/Altitude/)).toBeTruthy();
    expect(SOURCE_MANUAL).toBeTruthy();
  });

  it('opens as the summary and expands to every level', () => {
    // Same bands the map indicator shows: GND + the requested altitudes,
    // not the source's full level list.
    renderWinds({ allowManualEdit: false, bands: [1000, 3000] });

    expect(screen.getByText('GND')).toBeTruthy();
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /Show all 4 levels/ }));

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4);
    expect(screen.queryByText('GND')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Show summary/ }));

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('shows every level when there are no bands to summarise', () => {
    renderWinds({ allowManualEdit: false });

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });

  it('forces the full table while the profile is unlocked', () => {
    // Editing needs the real levels, not sampled bands.
    renderWinds({ allowManualEdit: true, manual: true, bands: [1000, 3000] });

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });

  it('keeps Reset with the other editing actions, behind the feature', () => {
    // Reset clears the profile, so it belongs with Unlock rather than at
    // the top of the panel where everyday users would meet it first.
    renderWinds({ allowManualEdit: false });
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();

    renderWinds({ allowManualEdit: true });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
  });

  it('no longer offers a Fetch forecast button', () => {
    // Fetching moved to the panel header's refresh icon (App).
    renderWinds({ allowManualEdit: true });

    expect(screen.queryByRole('button', { name: 'Fetch forecast' })).toBeNull();
  });
});
