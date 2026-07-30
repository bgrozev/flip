// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { SOURCE_MANUAL, createWindProfile, createWindRow } from '../core/wind';

import WindsComponent from './WindsComponent';

function renderWinds({
  allowManualEdit,
  manual = false
}: {
  allowManualEdit: boolean;
  manual?: boolean;
}) {
  const rows = [createWindRow(0, 270, 8), createWindRow(3000, 280, 15)];
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
});
