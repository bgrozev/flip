// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

import { LatLng } from '../../types';
import { MapDragHandleProps, MapViewContext } from '../MapAdapter';
import ManoeuvreEditLayer, { ManoeuvreEditTarget } from './ManoeuvreEditLayer';

const handleProps: MapDragHandleProps[] = [];

// The handle dispatches to a concrete provider (google.maps); capture its
// props instead, which is all this test is about.
vi.mock('..', async () => {
  const adapter = await vi.importActual<typeof import('../MapAdapter')>('../MapAdapter');

  return {
    ...adapter,
    MapDragHandle: (props: MapDragHandleProps) => {
      handleProps.push(props);

      return null;
    }
  };
});

const TARGET: LatLng = { lat: 28.21887, lng: -82.15122 };
// ~400 ft west of the target: the still-air initiation point.
const STILL_AIR: LatLng = { lat: 28.21887, lng: -82.15246 };
// The same point on the drawn path — the wind has carried it ~200 ft south.
const DRIFTED: LatLng = { lat: 28.21832, lng: -82.15246 };

function renderLayer(edit: Partial<ManoeuvreEditTarget> = {}) {
  handleProps.length = 0;
  const onMove = vi.fn();

  render(
    <MapViewContext.Provider value={{ zoom: 18 }}>
      <ManoeuvreEditLayer
        edit={{ target: TARGET, initiation: STILL_AIR, onMove, ...edit }}
      />
    </MapViewContext.Provider>
  );

  return { onMove, handle: handleProps[handleProps.length - 1] };
}

describe('ManoeuvreEditLayer', () => {
  it('sits on the still-air path, which is what the numbers describe', () => {
    const { handle } = renderLayer();

    expect(handle.position).toEqual(STILL_AIR);
    expect(handle.position).not.toEqual(DRIFTED);
  });

  it('reports where it was dropped, with nothing taken back out', () => {
    const { onMove, handle } = renderLayer();
    const dropped = { lat: 28.219, lng: -82.153 };

    handle.onDragEnd?.(dropped);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(dropped);
  });

  it('withdraws when it would sit on top of the target handle', () => {
    // A few feet from the target: at this zoom the two handles overlap, and
    // whichever is on top silently eats the drag.
    const { handle } = renderLayer({ initiation: { lat: 28.21888, lng: -82.15123 } });

    expect(handle).toBeUndefined();
  });
});
