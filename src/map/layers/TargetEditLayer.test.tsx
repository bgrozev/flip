// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';

import {
  MapClickModifiers,
  MapDragHandleProps,
  MapInteractions,
  MapInteractionsContext
} from '../MapAdapter';
import TargetEditLayer, { TargetEditTarget } from './TargetEditLayer';

/** Props of every drag handle rendered, in render order. */
const handles: MapDragHandleProps[] = [];

// The drawing primitives dispatch to a concrete provider (google.maps), so
// stub them — but record the drag handles' props, since the handles are the
// layer's actual interface and the only way to exercise them here.
vi.mock('..', async () => {
  const adapter = await vi.importActual<typeof import('../MapAdapter')>('../MapAdapter');

  return {
    ...adapter,
    MapDragHandle: (props: MapDragHandleProps) => {
      handles.push(props);

      return null;
    },
    MapPolyline: () => null
  };
});

/** The always-present target handle, and the revealed rotate handle. */
const targetHandle = () => handles.filter(handle => handle.cursor === 'move').at(-1)!;
const rotateHandle = () => handles.filter(handle => handle.cursor === 'pointer').at(-1);

function renderWithInteractions(edit: TargetEditTarget) {
  const registerClickHandler = vi.fn(() => () => undefined);
  const registerCursor = vi.fn(() => () => undefined);
  const interactions: MapInteractions = {
    registerClickHandler,
    registerCursor,
    setHandleDragging: vi.fn()
  };

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
  beforeEach(() => {
    handles.length = 0;
  });

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

  // The heading field and its "Upwind" button left with the Target panel, and
  // a phone has no `u` key — so the gesture lives on the handle that already
  // means "landing direction".
  it('snaps the heading into wind when the rotate handle is clicked', () => {
    const onUpwind = vi.fn();

    renderWithInteractions({ ...baseEdit, onUpwind });

    // The rotate handle only exists once the target is hovered
    expect(rotateHandle()).toBeUndefined();
    act(() => targetHandle().onMouseOver!());

    rotateHandle()!.onClick!();

    expect(onUpwind).toHaveBeenCalledOnce();
  });

  it('does not turn a rotate DRAG into a snap', () => {
    const onUpwind = vi.fn();
    const onHeadingChange = vi.fn();

    renderWithInteractions({ ...baseEdit, onUpwind, onHeadingChange });
    act(() => targetHandle().onMouseOver!());

    const rotate = rotateHandle()!;

    act(() => rotate.onDrag!({ lat: 28.3, lng: -82.15 }));
    act(() => rotate.onDragEnd({ lat: 28.3, lng: -82.15 }));

    expect(onHeadingChange).toHaveBeenCalled();
    expect(onUpwind).not.toHaveBeenCalled();
  });

  // No wind to face: the click must not be advertised as doing something.
  it('leaves the click inert when there is no wind', () => {
    renderWithInteractions({ ...baseEdit, onUpwind: undefined });
    act(() => targetHandle().onMouseOver!());

    expect(() => rotateHandle()!.onClick!()).not.toThrow();
  });
});
