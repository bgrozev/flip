// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { DEFAULT_FLOCKING_PARAMS } from '../core/model';
import { FlockingParams, SolveCorridorParams } from '../core/flocking';

import FlockingComponent from './FlockingComponent';

const corridor = (name: string, directionDeg: number): SolveCorridorParams => ({
  name,
  enabled: true,
  directionDeg,
  offsetMinMi: -1,
  offsetMaxMi: 1,
  alongMinMi: -5,
  alongMaxMi: 3,
  canopyToleranceDeg: 15
});

const THREE = [corridor('North', 0), corridor('East', 90), corridor('South', 180)];

function renderPanel(corridors: SolveCorridorParams[] = THREE) {
  const onParamsChange = vi.fn();
  let params: FlockingParams = {
    ...DEFAULT_FLOCKING_PARAMS,
    mode: 'solve',
    solveCorridors: corridors
  };

  const view = render(
    <AppStateProvider>
      <FlockingComponent
        params={params}
        onParamsChange={onParamsChange}
        jumprunDeg={0}
        canopyDeg={0}
        vectors={null}
        spot={null}
        missMi={null}
        tier={null}
        canopyDeviationDeg={0}
        canopyDeviationWarning={false}
        solve={null}
        corridorSolutions={corridors.map(() => null)}
        distanceUnit="mi"
        target={{ lat: 28.21952, lng: -82.15154 }}
      />
    </AppStateProvider>
  );

  /** Apply what the panel asked for, the way App would. */
  const applyLastChange = () => {
    params = onParamsChange.mock.calls.at(-1)![0] as FlockingParams;
    view.rerender(
      <AppStateProvider>
        <FlockingComponent
          params={params}
          onParamsChange={onParamsChange}
          jumprunDeg={0}
          canopyDeg={0}
          vectors={null}
          spot={null}
          missMi={null}
          tier={null}
          canopyDeviationDeg={0}
          canopyDeviationWarning={false}
          solve={null}
          corridorSolutions={params.solveCorridors.map(() => null)}
          distanceUnit="mi"
          target={{ lat: 28.21952, lng: -82.15154 }}
        />
      </AppStateProvider>
    );
  };

  return { onParamsChange, applyLastChange };
}

/** Corridor names, in the order the panel lists them. */
const corridorNames = () =>
  (screen.getAllByLabelText(/^Corridor \d name$/) as HTMLInputElement[]).map(i => i.value);

/** Which rows are collapsed, by position — the chevron says which it is. */
const collapsedRows = () =>
  corridorNames()
    .map((_name, i) => Boolean(screen.queryByLabelText(`Expand corridor ${i + 1}`)))
    .map((isCollapsed, i) => (isCollapsed ? i : -1))
    .filter(i => i >= 0);

describe('FlockingComponent — corridors', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('lists the corridors it is given', () => {
    renderPanel();

    expect(corridorNames()).toEqual(['North', 'East', 'South']);
    expect(collapsedRows()).toEqual([]);
  });

  it('collapses a corridor without touching the others', () => {
    renderPanel();

    fireEvent.click(screen.getByLabelText('Collapse corridor 2'));

    expect(collapsedRows()).toEqual([1]);
  });

  // The collapse flags are held by POSITION, so removing a corridor above a
  // collapsed one has to shift them down — otherwise the fold jumps to a
  // different corridor than the one the user folded.
  it('keeps a collapse on its own corridor when an earlier one is removed', () => {
    const { applyLastChange } = renderPanel();

    fireEvent.click(screen.getByLabelText('Collapse corridor 3'));
    expect(collapsedRows()).toEqual([2]);

    fireEvent.click(screen.getByLabelText('Remove corridor 1'));
    applyLastChange();

    expect(corridorNames()).toEqual(['East', 'South']);
    // South was folded and is still the folded one, now in position 2.
    expect(collapsedRows()).toEqual([1]);
  });

  it('drops the flag of the corridor that was removed', () => {
    const { applyLastChange } = renderPanel();

    fireEvent.click(screen.getByLabelText('Collapse corridor 1'));
    fireEvent.click(screen.getByLabelText('Remove corridor 1'));
    applyLastChange();

    expect(corridorNames()).toEqual(['East', 'South']);
    expect(collapsedRows()).toEqual([]);
  });

  it('says so when every corridor is switched off', () => {
    renderPanel([{ ...corridor('North', 0), enabled: false }]);

    expect(screen.getByText(/Every corridor is switched off/)).toBeTruthy();
  });

  it('says so when there are none at all', () => {
    renderPanel([]);

    expect(screen.getByText(/No corridors/)).toBeTruthy();
  });
});
