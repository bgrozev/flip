// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider, TargetProvider } from '../hooks';
import { Target } from '../types';

import PlacePicker from './PlacePicker';

const TARGET: Target = {
  target: { lat: 28.21887, lng: -82.15122 },
  finalHeading: 270
};

function renderPicker({
  upwindHeading = null as number | null,
  setTarget = vi.fn()
} = {}) {
  render(
    <AppStateProvider>
      <TargetProvider target={TARGET} setTarget={setTarget}>
        <PlacePicker upwindHeading={upwindHeading} />
      </TargetProvider>
    </AppStateProvider>
  );

  return setTarget;
}

/** Row labels in the list, in order, ignoring the group headers. */
function rowNames(): string[] {
  return within(screen.getByRole('list', { name: 'Places' }))
    .getAllByRole('button')
    .map(row => row.textContent ?? '')
    .filter(text => text !== '');
}

/**
 * MUI dialogs stay mounted through their closing transition, so a second
 * dialog opened straight after would collide with the first one's fields.
 */
async function waitForDialogsToClose() {
  await vi.waitFor(() => expect(screen.queryAllByLabelText('Name')).toHaveLength(0));
}

function search(text: string) {
  fireEvent.change(screen.getByLabelText('Search dropzones and places'), {
    target: { value: text }
  });
}

describe('PlacePicker', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('lists the dropzones with no saved places yet', () => {
    renderPicker();

    expect(screen.getByText('Dropzones')).toBeTruthy();
    expect(screen.queryByText('My places')).toBeNull();
    expect(rowNames().some(name => name.includes('Skydive City (ZHills)'))).toBe(true);
  });

  it('filters the list as you type, across the whole name', () => {
    renderPicker();
    search('zhills');

    const names = rowNames();

    expect(names.some(name => name.includes('Skydive City (ZHills)'))).toBe(true);
    expect(names.some(name => name.includes('Jumptown'))).toBe(false);
  });

  it('selects a dropzone with its landing heading', () => {
    const setTarget = renderPicker();

    search('zhills');
    fireEvent.click(screen.getByText('Skydive City (ZHills)'));

    expect(setTarget).toHaveBeenCalledWith({
      target: { lat: 28.21887, lng: -82.15122 },
      finalHeading: 270
    });
  });

  it('lands a headingless dropzone into wind', () => {
    const setTarget = renderPicker({ upwindHeading: 40 });

    search('jumptown');
    fireEvent.click(screen.getByText('Jumptown'));

    expect(setTarget).toHaveBeenCalledWith({
      target: { lat: 42.568, lng: -72.283 },
      finalHeading: 40
    });
  });

  it('keeps the current heading for a headingless dropzone when there is no wind', () => {
    const setTarget = renderPicker({ upwindHeading: null });

    search('jumptown');
    fireEvent.click(screen.getByText('Jumptown'));

    expect(setTarget).toHaveBeenCalledWith({
      target: { lat: 42.568, lng: -72.283 },
      finalHeading: TARGET.finalHeading
    });
  });

  it('starring a dropzone moves it into My places, and unstarring puts it back', () => {
    renderPicker();
    search('jumptown');

    fireEvent.click(screen.getByLabelText('Star Jumptown'));

    expect(screen.getByText('My places')).toBeTruthy();
    expect(screen.queryByText('Dropzones')).toBeNull();

    fireEvent.click(screen.getByLabelText('Unstar Jumptown'));

    expect(screen.queryByText('My places')).toBeNull();
    expect(screen.getByText('Dropzones')).toBeTruthy();
  });

  it('a star survives a remount (it is persisted)', () => {
    const { unmount } = render(
      <AppStateProvider>
        <TargetProvider target={TARGET} setTarget={vi.fn()}>
          <PlacePicker upwindHeading={null} />
        </TargetProvider>
      </AppStateProvider>
    );

    fireEvent.click(screen.getByLabelText('Star Jumptown'));
    unmount();

    renderPicker();

    expect(screen.getByLabelText('Unstar Jumptown')).toBeTruthy();
  });

  it('saves the current target as a custom place, then renames and deletes it', async () => {
    renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Save current target' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Back field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Back field')).toBeTruthy();
    await waitForDialogsToClose();

    fireEvent.click(screen.getByLabelText('Edit Back field'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'North field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(screen.queryByText('Back field')).toBeNull();
    expect(screen.getByText('North field')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Edit North field'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(screen.queryByText('North field')).toBeNull();
  });

  it('selects a custom place at its own coordinates and heading', () => {
    const setTarget = vi.fn();

    renderPicker({ setTarget });

    fireEvent.click(screen.getByRole('button', { name: 'Save current target' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Back field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    fireEvent.click(screen.getByText('Back field'));

    expect(setTarget).toHaveBeenCalledWith({
      target: TARGET.target,
      finalHeading: TARGET.finalHeading
    });
  });

  it('says so when nothing matches', async () => {
    renderPicker();
    search('nowhere at all');

    // Shown once the geocoder has also come back empty, not before.
    expect(await screen.findByText('Nothing found.')).toBeTruthy();
  });

  it('offers Nearest dropzone without asking for permission up front', () => {
    const getCurrentPosition = vi.fn();

    vi.stubGlobal('navigator', {
      ...window.navigator,
      geolocation: { getCurrentPosition }
    });

    renderPicker();

    expect(screen.getByRole('button', { name: /Nearest dropzone/ })).toBeTruthy();
    expect(getCurrentPosition).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('picks the nearest dropzone once location is granted', async () => {
    vi.stubGlobal('navigator', {
      ...window.navigator,
      geolocation: {
        getCurrentPosition: (onSuccess: PositionCallback) => {
          onSuccess({
            coords: { latitude: 28.3, longitude: -82.2 }
          } as GeolocationPosition);
        }
      }
    });

    const setTarget = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /Nearest dropzone/ }));
    await vi.waitFor(() => expect(setTarget).toHaveBeenCalled());

    expect(setTarget).toHaveBeenCalledWith({
      target: { lat: 28.21887, lng: -82.15122 },
      finalHeading: 270
    });

    vi.unstubAllGlobals();
  });

  it('stays usable when location permission is denied', async () => {
    vi.stubGlobal('navigator', {
      ...window.navigator,
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, onError: PositionErrorCallback) => {
          onError({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
        }
      }
    });

    const setTarget = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /Nearest dropzone/ }));

    await screen.findByText(/Location permission denied/);
    expect(setTarget).not.toHaveBeenCalled();
    // The list still works
    search('zhills');
    expect(rowNames().some(name => name.includes('Skydive City (ZHills)'))).toBe(true);

    vi.unstubAllGlobals();
  });

  it('works when the browser has no geolocation at all', () => {
    vi.stubGlobal('navigator', { ...window.navigator, geolocation: undefined });

    renderPicker();

    expect(rowNames().some(name => name.includes('Skydive City (ZHills)'))).toBe(true);

    vi.unstubAllGlobals();
  });
});
