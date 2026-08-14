import { describe, expect, it, vi } from 'vitest';

import { ClickEntry, dispatchMapClick } from './clickDispatch';

const POS = { lat: 28, lng: -82 };
const MODS = { shift: false };

function entry(over: Partial<ClickEntry> & Pick<ClickEntry, 'handler'>): ClickEntry {
  return { priority: 0, seq: 0, observe: false, ...over };
}

describe('dispatchMapClick', () => {
  it('gives the click to the highest priority', () => {
    const low = vi.fn();
    const high = vi.fn();

    dispatchMapClick(
      [entry({ handler: low, priority: 0, seq: 0 }), entry({ handler: high, priority: 5, seq: 1 })],
      POS,
      MODS
    );

    expect(high).toHaveBeenCalledWith(POS, MODS);
    expect(low).not.toHaveBeenCalled();
  });

  it('breaks a priority tie with the later registration', () => {
    const first = vi.fn();
    const later = vi.fn();

    dispatchMapClick(
      [entry({ handler: first, seq: 1 }), entry({ handler: later, seq: 2 })],
      POS,
      MODS
    );

    expect(later).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  // An observer answers "the map was pressed"; it must not take the click from
  // the layer answering "the map was pressed HERE".
  it('notifies observers as well as the winner', () => {
    const observer = vi.fn();
    const owner = vi.fn();

    dispatchMapClick(
      [entry({ handler: observer, observe: true, priority: -10 }), entry({ handler: owner })],
      POS,
      MODS
    );

    expect(observer).toHaveBeenCalledWith(POS, MODS);
    expect(owner).toHaveBeenCalledWith(POS, MODS);
  });

  it('never lets an observer win the click', () => {
    const observer = vi.fn();
    const owner = vi.fn();

    // Priority high enough to beat everything, and registered last: it still
    // does not consume the click.
    dispatchMapClick(
      [entry({ handler: owner, priority: 0, seq: 0 }),
        entry({ handler: observer, observe: true, priority: 99, seq: 9 })],
      POS,
      MODS
    );

    expect(owner).toHaveBeenCalledOnce();
    expect(observer).toHaveBeenCalledOnce();
  });

  it('notifies observers when nothing is competing', () => {
    const observer = vi.fn();

    dispatchMapClick([entry({ handler: observer, observe: true })], POS, MODS);

    expect(observer).toHaveBeenCalledOnce();
  });

  it('does nothing with no handlers', () => {
    expect(() => dispatchMapClick([], POS, MODS)).not.toThrow();
  });
});
