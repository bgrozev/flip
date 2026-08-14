// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { SOURCE_OPEN_METEO, WindProfile } from '../core/wind';

import WindMiniIndicator from './WindMiniIndicator';

const WINDS: WindProfile = {
  winds: [
    { altFt: 0, direction: 150, speedKts: 4 },
    { altFt: 1000, direction: 140, speedKts: 6 },
    { altFt: 3000, direction: 140, speedKts: 8 }
  ],
  groundSource: SOURCE_OPEN_METEO,
  aloftSource: SOURCE_OPEN_METEO
};

function renderIndicator(compact: boolean) {
  render(
    <AppStateProvider>
      <WindMiniIndicator
        winds={WINDS}
        altitudesFt={[1000, 3000]}
        interpolate={false}
        onOpen={vi.fn()}
        onRefresh={vi.fn()}
        fetching={false}
        compact={compact}
      />
    </AppStateProvider>
  );
}

describe('WindMiniIndicator compact mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the by-altitude card when there is room', () => {
    renderIndicator(false);

    expect(screen.getByText('1000')).not.toBeNull();
    expect(screen.getByText('3000')).not.toBeNull();
  });

  // On a phone the map is a strip beside the open panel, and the expanded card
  // is taller than the strip it would cover.
  it('falls back to the chip when the map is a strip', () => {
    renderIndicator(true);

    expect(screen.queryByText('1000')).toBeNull();
    expect(screen.getByLabelText('Winds; open the wind panel')).not.toBeNull();
  });

  // Tapping the chip opens the Wind panel, which is the better answer on a
  // small screen than growing the card back over the map.
  it('withdraws the expand control while compact', () => {
    renderIndicator(true);

    expect(screen.queryByLabelText('Expand winds')).toBeNull();
  });

  it('offers the expand control on a collapsed full-size map', () => {
    window.localStorage.setItem('flip.ui.windIndicatorCollapsed', 'true');
    renderIndicator(false);

    expect(screen.getByLabelText('Expand winds')).not.toBeNull();
  });
});
