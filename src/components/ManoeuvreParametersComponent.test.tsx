// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { DEFAULT_MANOEUVRE_PARAMS } from '../core/model';
import { ManoeuvreParams } from '../types';

import ManoeuvreParametersComponent from './ManoeuvreParametersComponent';

function renderPanel(params: Partial<ManoeuvreParams> = {}) {
  const onParamsChange = vi.fn();
  const initial = { ...DEFAULT_MANOEUVRE_PARAMS, ...params };
  const view = render(
    <AppStateProvider>
      <ManoeuvreParametersComponent params={initial} onParamsChange={onParamsChange} />
    </AppStateProvider>
  );

  const rerenderWith = (next: Partial<ManoeuvreParams>) =>
    view.rerender(
      <AppStateProvider>
        <ManoeuvreParametersComponent
          params={{ ...DEFAULT_MANOEUVRE_PARAMS, ...next }}
          onParamsChange={onParamsChange}
        />
      </AppStateProvider>
    );

  return { onParamsChange, rerenderWith };
}

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true';

const rotationField = () => screen.queryByLabelText('Rotation') as HTMLInputElement | null;

describe('ManoeuvreParametersComponent — rotation', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the preset that is selected', () => {
    renderPanel({ rotationDeg: 270 });

    expect(pressed('270°')).toBe(true);
    expect(pressed('Custom')).toBe(false);
    expect(rotationField()).toBeNull();
  });

  it('opens the custom field for a rotation that is not a preset', () => {
    renderPanel({ rotationDeg: 200 });

    expect(pressed('Custom')).toBe(true);
    expect(rotationField()).not.toBeNull();
  });

  it('opens the custom field when Custom is pressed', () => {
    renderPanel({ rotationDeg: 270 });

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));

    expect(pressed('Custom')).toBe(true);
    expect(rotationField()).not.toBeNull();
  });

  // The flag saying "the user asked for Custom" outlived the value it
  // describes: loading a setup with a 450 left the panel showing the custom
  // field with no preset lit, disagreeing with the turn it was drawing.
  it('leaves custom mode when the rotation is set to a preset from outside', () => {
    const { rerenderWith } = renderPanel({ rotationDeg: 270 });

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(pressed('Custom')).toBe(true);

    rerenderWith({ rotationDeg: 450 });

    expect(pressed('450°')).toBe(true);
    expect(pressed('Custom')).toBe(false);
    expect(rotationField()).toBeNull();
  });

  it('stays custom when an outside change is not a preset', () => {
    const { rerenderWith } = renderPanel({ rotationDeg: 270 });

    rerenderWith({ rotationDeg: 200 });

    expect(pressed('Custom')).toBe(true);
    expect(rotationField()).not.toBeNull();
  });

  it('picking a preset reports it', () => {
    const { onParamsChange } = renderPanel({ rotationDeg: 270 });

    fireEvent.click(screen.getByRole('button', { name: '450°' }));

    expect(onParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ rotationDeg: 450 })
    );
  });

  // A depth a 270 was happy with may be one a 90 cannot start from, so the
  // rotation change pulls both into the new turn's range.
  it('clamps depth and offset into the new turn’s range', () => {
    const { onParamsChange } = renderPanel({
      rotationDeg: 450,
      depthFt: 1200,
      offsetFt: 900
    });

    fireEvent.click(screen.getByRole('button', { name: '90°' }));

    const written = onParamsChange.mock.calls.at(-1)![0] as ManoeuvreParams;

    expect(written.rotationDeg).toBe(90);
    expect(written.depthFt).toBeLessThanOrEqual(1200);
    expect(written.offsetFt).toBeLessThanOrEqual(900);
  });
});

describe('ManoeuvreParametersComponent — the rest of the turn', () => {
  it('follows the turn direction from outside', () => {
    const { rerenderWith } = renderPanel({ turnDirection: 'left' });

    expect(pressed('Left')).toBe(true);
    // Shift+X mirrors the manoeuvre without the panel being touched.
    rerenderWith({ turnDirection: 'right' });
    expect(pressed('Right')).toBe(true);
    expect(pressed('Left')).toBe(false);
  });

  // The initiation handle on the map writes these two, so they have to
  // follow it — the bug the Courses panel had.
  it('follows depth and offset from outside', () => {
    const { rerenderWith } = renderPanel({ depthFt: 300, offsetFt: 150 });

    expect((screen.getByLabelText('Depth') as HTMLInputElement).value).toBe('300');
    expect((screen.getByLabelText('Offset') as HTMLInputElement).value).toBe('150');

    rerenderWith({ depthFt: 500, offsetFt: -75 });

    expect((screen.getByLabelText('Depth') as HTMLInputElement).value).toBe('500');
    expect((screen.getByLabelText('Offset') as HTMLInputElement).value).toBe('-75');
  });
});
