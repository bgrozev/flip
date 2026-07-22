// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

import { MapInteractions, MapInteractionsContext } from '../MapAdapter';
import TargetEditLayer, { TargetEditTarget } from './TargetEditLayer';

// The drawing primitives dispatch to a concrete provider (google.maps);
// this test only cares about the interaction registry, so stub them and
// keep the real hooks.
vi.mock('..', async () => {
  const adapter = await vi.importActual<typeof import('../MapAdapter')>('../MapAdapter');

  return {
    ...adapter,
    MapDragHandle: () => null,
    MapPolyline: () => null
  };
});

/**
 * The layer's map primitives need a provider; only the interaction
 * registry matters here, so stub it and watch what gets registered.
 */
function renderWithInteractions(edit: TargetEditTarget) {
  const registerClickHandler = vi.fn(() => () => undefined);
  const registerCursor = vi.fn(() => () => undefined);
  const interactions: MapInteractions = { registerClickHandler, registerCursor };

  render(
    <MapInteractionsContext.Provider value={interactions}>
      <TargetEditLayer edit={edit} />
    </MapInteractionsContext.Provider>
  );

  return { registerClickHandler, registerCursor };
}

const baseEdit: TargetEditTarget = {
  target: { lat: 28.2, lng: -82.15 },
  heading: 270,
  onMove: vi.fn(),
  onHeadingChange: vi.fn()
};

describe('TargetEditLayer click-to-move', () => {
  it('registers a background-click handler by default (Edit on Map)', () => {
    const { registerClickHandler, registerCursor } = renderWithInteractions(baseEdit);

    expect(registerClickHandler).toHaveBeenCalled();
    expect(registerCursor).toHaveBeenCalledWith('crosshair');
  });

  it('moves the target when the map background is clicked', () => {
    const onMove = vi.fn();
    const { registerClickHandler } = renderWithInteractions({ ...baseEdit, onMove });
    const handler = registerClickHandler.mock.calls[0][0] as (p: unknown) => void;
    const pos = { lat: 29, lng: -82 };

    handler(pos);
    expect(onMove).toHaveBeenCalledWith(pos);
  });

  it('registers no click handler when clickToMove is false', () => {
    // Flocking keeps this layer mounted permanently, so a stray click on
    // the map must not relocate the target — dragging the handle does.
    const { registerClickHandler, registerCursor } = renderWithInteractions({
      ...baseEdit,
      clickToMove: false
    });

    expect(registerClickHandler).not.toHaveBeenCalled();
    expect(registerCursor).not.toHaveBeenCalled();
  });
});
