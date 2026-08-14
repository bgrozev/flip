// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { UseSetupsResult } from '../hooks/useSetups';
import { DEFAULT_MANOEUVRE_CONFIG, DEFAULT_PATTERN_PARAMS, DEFAULT_TARGET } from '../core/model';
import { Setup } from '../types';

import SetupManagerDialog from './SetupManagerDialog';

const bound: Setup = {
  id: 's1',
  name: 'ZHills ZoneAcc',
  canopy: 'SAW 75',
  modeId: 'swoop',
  patternParams: DEFAULT_PATTERN_PARAMS,
  manoeuvre: DEFAULT_MANOEUVRE_CONFIG,
  site: {
    placeId: 'dz:Skydive City (ZHills)',
    target: DEFAULT_TARGET,
    selectedCourseId: null
  },
  createdAt: 1
};

const portable: Setup = {
  id: 's2',
  name: 'Comp canopy',
  modeId: 'swoop',
  patternParams: DEFAULT_PATTERN_PARAMS,
  manoeuvre: DEFAULT_MANOEUVRE_CONFIG,
  site: null,
  createdAt: 2
};

function renderDialog(setups: Setup[] = [bound, portable]) {
  const api = {
    setups,
    renameSetup: vi.fn(),
    updateSetup: vi.fn(),
    setSetupSite: vi.fn(),
    deleteSetup: vi.fn()
  } as unknown as UseSetupsResult;

  render(
    <SetupManagerDialog
      open
      setups={api}
      placeName="Skydive Arizona"
      chipsFor={setup => [setup.name === bound.name ? 'ZHills' : 'Anywhere', '90 L']}
      onClose={vi.fn()}
    />
  );

  return api;
}

const names = () =>
  (screen.getAllByLabelText('Name') as HTMLInputElement[]).map(i => i.value);

describe('SetupManagerDialog', () => {
  it('lists every setup with its description', () => {
    renderDialog();

    expect(names()).toEqual(['ZHills ZoneAcc', 'Comp canopy']);
    expect(screen.getByText('ZHills · 90 L')).toBeTruthy();
    expect(screen.getByText('Anywhere · 90 L')).toBeTruthy();
  });

  it('renames on blur, and refuses to blank a name', () => {
    const api = renderDialog();
    const field = screen.getAllByLabelText('Name')[0];

    fireEvent.change(field, { target: { value: 'ZHills ZA' } });
    fireEvent.blur(field);
    expect(api.renameSetup).toHaveBeenCalledWith('s1', 'ZHills ZA');

    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.blur(field);
    // Still one call, and the field has gone back to the stored name.
    expect(api.renameSetup).toHaveBeenCalledTimes(1);
    expect((field as HTMLInputElement).value).toBe('ZHills ZoneAcc');
  });

  it('edits the canopy label', () => {
    const api = renderDialog();
    const field = screen.getAllByLabelText('Canopy')[0];

    fireEvent.change(field, { target: { value: 'VK 79' } });
    fireEvent.blur(field);

    expect(api.updateSetup).toHaveBeenCalledWith('s1', { canopy: 'VK 79' });
  });

  // The icon is the state as well as the control: a pin for one that
  // remembers a target, a globe for one that travels.
  it('cuts a bound setup loose and binds a portable one here', () => {
    const api = renderDialog();
    const [boundToggle, portableToggle] = screen.getAllByRole('button', {
      name: /click to/
    });

    fireEvent.click(boundToggle);
    expect(api.setSetupSite).toHaveBeenCalledWith('s1', false);

    fireEvent.click(portableToggle);
    expect(api.setSetupSite).toHaveBeenCalledWith('s2', true);
  });

  it('names the dropzone a portable setup would be bound to', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: /bind it to Skydive Arizona/ })).toBeTruthy();
  });

  // Deleting is the one irreversible action here, so it asks first.
  it('confirms before deleting', () => {
    const api = renderDialog();

    fireEvent.click(screen.getAllByRole('button', { name: /Delete this setup/ })[0]);
    expect(api.deleteSetup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteSetup).toHaveBeenCalledWith('s1');
  });

  it('can be dismissed without deleting', () => {
    const api = renderDialog();

    fireEvent.click(screen.getAllByRole('button', { name: /Delete this setup/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.deleteSetup).not.toHaveBeenCalled();
  });

  it('says so when there is nothing saved', () => {
    renderDialog([]);

    expect(screen.getByText('No saved setups.')).toBeTruthy();
  });
});
