// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { SOURCE_MANUAL, createWindProfile, createWindRow } from '../core/wind';
import { ObservedWindStation } from '../types';

import WindsComponent, { forecastLabel } from './WindsComponent';

function renderWinds({
  allowManualEdit,
  manual = false,
  bands = [],
  forecastTime = null,
  stations = []
}: {
  allowManualEdit: boolean;
  manual?: boolean;
  bands?: number[];
  forecastTime?: Date | null;
  stations?: ObservedWindStation[];
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
        forecastTime={forecastTime}
        onForecastTimeChange={vi.fn()}
        allowManualEdit={allowManualEdit}
        bandAltitudesFt={bands}
        stations={stations}
        stationsFetched={stations.length > 0}
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

    // One disclosure row, whose chevron carries the state — so the label
    // stays put instead of renaming itself on open.
    fireEvent.click(screen.getByRole('button', { name: /All 4 levels/ }));

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4);
    expect(screen.queryByText('GND')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /All 4 levels/ }));

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('shows every level when there are no bands to summarise', () => {
    renderWinds({ allowManualEdit: false });

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /All 4 levels/ })).toBeNull();
  });

  it('forces the full table while the profile is unlocked', () => {
    // Editing needs the real levels, not sampled bands.
    renderWinds({ allowManualEdit: true, manual: true, bands: [1000, 3000] });

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /All 4 levels/ })).toBeNull();
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

/** The same formatters the label uses, so these assert assembly, not locale. */
const clock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const weekday = (d: Date) => d.toLocaleDateString([], { weekday: 'short' });

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3600000);
}

describe('forecastLabel', () => {
  it('says Now rather than an offset of zero', () => {
    expect(forecastLabel(null, 0)).toBe('Now');
  });

  it('gives the offset and the clock time', () => {
    // Both, because they answer different questions: how far ahead you are
    // looking, and what to tell somebody.
    const t = hoursFromNow(3);

    expect(forecastLabel(t, 3)).toBe(`+3h · ${clock(t)}`);
  });

  // A bare clock time is ambiguous by a day once the selection rolls over,
  // and the forecast window runs a week out.
  it('names the weekday only once the selection leaves today', () => {
    const today = hoursFromNow(1);
    const later = hoursFromNow(30);

    expect(forecastLabel(today, 1)).not.toContain(weekday(today));

    // Guard the fixture: 30 hours out is only another day if it really is.
    if (later.toDateString() !== new Date().toDateString()) {
      expect(forecastLabel(later, 30)).toBe(`+30h · ${weekday(later)} ${clock(later)}`);
    }
  });
});

describe('the forecast time controls', () => {
  beforeEach(() => window.localStorage.clear());

  // Four controls for one number is what made the panel's top heavy: the
  // date and time fields are the precise path and the least used, so they
  // are folded away until asked for.
  it('keeps the exact date and time fields folded away', () => {
    renderWinds({ allowManualEdit: false });

    expect(document.querySelector('input[type=date]')).toBeNull();
    expect(document.querySelector('input[type=time]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /exact date and time/i }));

    expect(document.querySelector('input[type=date]')).toBeTruthy();
    expect(document.querySelector('input[type=time]')).toBeTruthy();
  });
});

const STATION: ObservedWindStation = {
  id: 'KZPH',
  name: 'Zephyrhills Airport',
  source: 'NWS',
  lat: 28.22,
  lng: -82.15,
  distanceFt: 3168,
  observedAt: new Date(),
  wind: { direction: 160, speedKts: 6 },
  temperatureC: 32,
  dewpointC: 22.9,
  humidityPct: 59
};

describe('ground conditions', () => {
  beforeEach(() => window.localStorage.clear());

  // Temperature, humidity and density altitude used to sit above the winds
  // aloft, which they are not about, and be reported again by the station
  // card below. One section now, after the wind.
  it('are one section, below the wind table', () => {
    renderWinds({ allowManualEdit: false, stations: [STATION] });

    const heading = screen.getByText('Ground conditions');
    const table = screen.getByRole('table');

    expect(heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_PRECEDING)
      .toBeTruthy();
  });

  // Scrub to a future hour and the observations stop applying, but the
  // forecast's temperature and density altitude still do.
  it('survive a forecast time that has no observations', () => {
    renderWinds({ allowManualEdit: false, forecastTime: new Date(Date.now() + 3600000) });

    expect(screen.getByText('Ground conditions')).toBeTruthy();
    expect(screen.queryByText('Zephyrhills Airport')).toBeNull();
  });

  it('fold the station report down to what a wind planner acts on', () => {
    renderWinds({ allowManualEdit: false, stations: [STATION] });

    expect(screen.getByText('Wind')).toBeTruthy();
    expect(screen.getByText('Gusts')).toBeTruthy();
    expect(screen.queryByText('Dewpoint')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Full report/ }));

    expect(screen.getByText('Dewpoint')).toBeTruthy();
  });
});
