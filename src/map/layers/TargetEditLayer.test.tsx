// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

import { MapClickModifiers, MapInteractions, MapInteractionsContext } from '../MapAdapter';
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

describe('TargetEditLayer', () => {
  it('registers a background-click handler but no crosshair cursor', () => {
    const { registerClickHandler, registerCursor } = renderWithInteractions(baseEdit);

    expect(registerClickHandler).toHaveBeenCalled();
    // The target is always draggable; there is no click-to-move mode, so no
    // crosshair is advertised.
    expect(registerCursor).not.toHaveBeenCalled();
  });

  it('moves the target only on a shift-click, not a plain click', () => {
    const onMove = vi.fn();
    const { registerClickHandler } = renderWithInteractions({ ...baseEdit, onMove });
    const handler = registerClickHandler.mock.calls[0][0] as (
      p: unknown,
      m: MapClickModifiers
    ) => void;
    const pos = { lat: 29, lng: -82 };

    handler(pos, { shift: false });
    expect(onMove).not.toHaveBeenCalled();

    handler(pos, { shift: true });
    expect(onMove).toHaveBeenCalledWith(pos);
  });
});
