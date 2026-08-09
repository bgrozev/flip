// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider, TargetProvider } from '../hooks';
import { Target } from '../types';

import PlacePicker from './PlacePicker';

const TARGET: Target = {
  target: { lat: 28.21952, lng: -82.15154 },
  finalHeading: 180
};

function renderPicker({
  upwindHeading = null as number | null,
  setTarget = vi.fn(),
  selectPlace = undefined as ((target: Target) => void) | undefined
} = {}) {
  render(
    <AppStateProvider>
      <TargetProvider target={TARGET} setTarget={setTarget} selectPlace={selectPlace}>
        <PlacePicker upwindHeading={upwindHeading} />
      </TargetProvider>
    </AppStateProvider>
  );

  return setTarget;
}

/** Row labels in a named list, in order, ignoring the group headers. */
function rowNames(listName = 'Search results'): string[] {
  return within(screen.getByRole('list', { name: listName }))
    .getAllByRole('button')
    .map(row => row.textContent ?? '')
    .filter(text => text !== '');
}

/** Open the "All dropzones" disclosure, and the named country inside it. */
function browseCountry(country: string) {
  fireEvent.click(screen.getByRole('button', { name: /All dropzones/ }));
  fireEvent.click(screen.getByText(country));
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

  // The panel used to open with all 274 dropzones under the saved ones,
  // which is not a list anyone reads.
  it('lists no dropzones until you ask, with nothing saved yet', () => {
    renderPicker();

    expect(screen.queryByText('Skydive City (ZHills)')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Your places' })).toBeNull();
    expect(screen.getByRole('button', { name: /All dropzones/ })).toBeTruthy();
  });

  it('browses the dropzones by country when asked', () => {
    renderPicker();

    browseCountry('United States');

    expect(rowNames('Dropzones by country')
      .some(name => name.includes('Skydive City (ZHills)'))).toBe(true);
    // A country you did not open stays folded
    expect(screen.queryByText('Whistler Skydiving Pemberton')).toBeNull();
  });

  // buildPlaces moves a starred dropzone into the saved group, which must not
  // take it out of the list that calls itself "all".
  it('keeps a starred dropzone in the browse list', () => {
    renderPicker();
    search('jumptown');
    fireEvent.click(screen.getByLabelText('Star Jumptown'));
    search('');

    browseCountry('United States');

    expect(rowNames('Dropzones by country').some(name => name.includes('Jumptown'))).toBe(true);
  });

  it('remembers what you picked, and offers it back', () => {
    renderPicker();
    search('zhills');
    fireEvent.click(screen.getByText('Skydive City (ZHills)'));
    search('');

    expect(rowNames('Your places').some(name => name.includes('Skydive City (ZHills)')))
      .toBe(true);
  });

  // A place that is both starred and recent is ONE row: position says which
  // half it is in, and the star is how you move it between them.
  it('does not list a saved place twice when it is also recent', () => {
    renderPicker();
    search('zhills');
    fireEvent.click(screen.getByLabelText('Star Skydive City (ZHills)'));
    fireEvent.click(screen.getByText('Skydive City (ZHills)'));
    search('');

    const rows = rowNames('Your places')
      .filter(name => name.includes('Skydive City (ZHills)'));

    expect(rows).toHaveLength(1);
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
      target: { lat: 28.21952, lng: -82.15154 },
      finalHeading: 180
    });
  });

  it('lands a headingless dropzone into wind', () => {
    const setTarget = renderPicker({ upwindHeading: 40 });

    search('whistler');
    fireEvent.click(screen.getByText('Whistler Skydiving Pemberton'));

    expect(setTarget).toHaveBeenCalledWith({
      target: { lat: 50.30251, lng: -122.73884 },
      finalHeading: 40
    });
  });

  it('keeps the current heading for a headingless dropzone when there is no wind', () => {
    const setTarget = renderPicker({ upwindHeading: null });

    search('whistler');
    fireEvent.click(screen.getByText('Whistler Skydiving Pemberton'));

    expect(setTarget).toHaveBeenCalledWith({
      target: { lat: 50.30251, lng: -122.73884 },
      finalHeading: TARGET.finalHeading
    });
  });

  it('starring a dropzone moves it into My places, and unstarring puts it back', () => {
    renderPicker();
    search('jumptown');

    fireEvent.click(screen.getByLabelText('Star Jumptown'));

    expect(screen.getByText('Your places')).toBeTruthy();
    expect(screen.queryByText('Dropzones')).toBeNull();

    fireEvent.click(screen.getByLabelText('Unstar Jumptown'));

    expect(screen.queryByText('Your places')).toBeNull();
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

    fireEvent.change(screen.getByLabelText('Search dropzones and places'), {
      target: { value: 'jumptown' }
    });
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

  // A dialog is a portal in the DOM but a CHILD in the React tree, so its
  // clicks bubble to the row it is rendered inside — and that row selects the
  // place. Renaming used to move the target as a side effect.
  it('renaming a place does not also select it', async () => {
    const selectPlace = vi.fn();
    const setTarget = renderPicker({ selectPlace });

    fireEvent.click(screen.getByRole('button', { name: 'Save current target' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Back field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitForDialogsToClose();

    fireEvent.click(screen.getByLabelText('Edit Back field'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'North field' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(selectPlace).not.toHaveBeenCalled();
    expect(setTarget).not.toHaveBeenCalled();
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

  it('applies a chosen place through selectPlace, not the per-mode setter', () => {
    // App passes the every-mode setter here: which dropzone you are at is
    // not a per-mode choice.
    const selectPlace = vi.fn();
    const setTarget = renderPicker({ selectPlace });

    search('zhills');
    fireEvent.click(screen.getByText('Skydive City (ZHills)'));

    // The place rides along so the choice gains a memory: adjustments made
    // here are recorded against ZHills and restored on the way back, and the
    // dropzone's own per-mode config seeds the first visit.
    expect(selectPlace).toHaveBeenCalledWith(
      {
        target: { lat: 28.21952, lng: -82.15154 },
        finalHeading: 180
      },
      expect.objectContaining({ id: 'dz:Skydive City (ZHills)' })
    );
    // ...including whatever per-mode config the dropzone declares
    expect(selectPlace.mock.calls[0][1].modes?.flocking?.solveCorridors)
      .toHaveLength(2);
    expect(setTarget).not.toHaveBeenCalled();
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
      target: { lat: 28.21952, lng: -82.15154 },
      finalHeading: 180
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
    search('zhills');

    expect(rowNames().some(name => name.includes('Skydive City (ZHills)'))).toBe(true);

    vi.unstubAllGlobals();
  });
});
