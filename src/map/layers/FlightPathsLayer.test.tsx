// @vitest-environment jsdom
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../../hooks/useAppState';
import { FlightPath } from '../../types';

import FlightPathsLayer from './FlightPathsLayer';

// The drawing primitives dispatch to a concrete provider (google.maps).
// This test only cares about which circles are made hoverable, so record
// the props they are handed and render nothing.
const circles: Record<string, unknown>[] = [];

vi.mock('..', async () => {
  const adapter = await vi.importActual<typeof import('../MapAdapter')>('../MapAdapter');

  return {
    ...adapter,
    MapCircle: (props: Record<string, unknown>) => {
      circles.push(props);

      return null;
    },
    MapPolyline: () => null,
    MapOverlay: () => null
  };
});

function point(lat: number, alt: number, pom: boolean) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [-82.15, lat] },
    properties: { alt, time: alt / 10, pom, phase: 'pattern' }
  };
}

// Two pattern points (POMs) and one intermediate point between them.
const path = [point(28.20, 900, true), point(28.21, 600, false), point(28.22, 300, true)] as
  unknown as FlightPath;

function renderLayer(enableTooltips: boolean, showPomTooltips = false) {
  circles.length = 0;

  render(
    <AppStateProvider>
      <FlightPathsLayer
        pathA={path}
        pathB={path}
        showPreWind={false}
        showPoms
        showPomAltitudes={false}
        showPomTooltips={showPomTooltips}
        highlightCorrespondingPoints={false}
        showCrabArrow={false}
        enableTooltips={enableTooltips}
      />
    </AppStateProvider>
  );

  return circles.filter(c => c.onMouseOver !== undefined);
}

describe('FlightPathsLayer point hover', () => {
  it('makes nothing hoverable without the tooltip feature', () => {
    // Pattern points used to be hoverable regardless of the setting, which
    // is what put tooltips in front of everyday users.
    expect(renderLayer(false)).toHaveLength(0);
    expect(renderLayer(false, true)).toHaveLength(0);
  });

  it('makes the pattern points hoverable with the feature on', () => {
    // Two POMs per path, both paths drawn.
    expect(renderLayer(true).length).toBeGreaterThan(0);
  });

  it('extends hover to the non-POM points when the setting is on', () => {
    const poms = renderLayer(true).length;
    const all = renderLayer(true, true).length;

    expect(all).toBeGreaterThan(poms);
  });
});
