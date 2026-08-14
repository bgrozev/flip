import { describe, expect, it } from 'vitest';

import { SpotDescription } from './flocking';
import { formatSpot } from './spotText';

const SPOT: SpotDescription = {
  jumprunDeg: 248,
  alongMi: 3.412,
  prior: true,
  offsetMi: 0.418,
  offsetLeft: true
};

describe('formatSpot', () => {
  it('says the whole spot on one line', () => {
    expect(formatSpot(SPOT, 'mi').line)
      .toBe('Jumprun 248˚ · 3.41 mi prior · 0.42 mi left');
  });

  it('shouts PAST, which is the case that bites', () => {
    const past = formatSpot({ ...SPOT, prior: false }, 'mi');

    expect(past.along).toBe('3.41 mi PAST');
    expect(past.line).toContain('PAST');
  });

  it('drops an offset that is only rounding noise', () => {
    const onTheLine = formatSpot({ ...SPOT, offsetMi: 0.001 }, 'mi');

    expect(onTheLine.offset).toBeNull();
    expect(onTheLine.line).toBe('Jumprun 248˚ · 3.41 mi prior');
  });

  it('converts distances to the display unit', () => {
    const nm = formatSpot(SPOT, 'nm');

    expect(nm.along).toBe('2.96 nm prior');
    expect(nm.offset).toBe('0.36 nm left');
  });

  it('never shows 360 degrees', () => {
    expect(formatSpot({ ...SPOT, jumprunDeg: 359.7 }, 'mi').jumprun)
      .toBe('Jumprun 0˚');
  });

  it('names the side of the line the exit is on', () => {
    expect(formatSpot({ ...SPOT, offsetLeft: false }, 'mi').offset)
      .toBe('0.42 mi right');
  });

  // The verdict is a fact about the jumper's own setup; the pilot is only
  // being given a place to fly to, so it sits beside the spot, not in it.
  it('reports the verdict separately, and keeps it out of the copied line', () => {
    const missed = formatSpot(SPOT, 'mi', { missMi: 0.804, tier: 'red' });

    expect(missed.verdict).toBe('MISSES by 0.80 mi');
    expect(missed.line).not.toContain('MISSES');
  });

  it('calls a yellow-ring miss close, and a green one on target', () => {
    expect(formatSpot(SPOT, 'mi', { missMi: 0.21, tier: 'yellow' }).verdict)
      .toBe('CLOSE by 0.21 mi');
    expect(formatSpot(SPOT, 'mi', { missMi: 0.02, tier: 'green' }).verdict)
      .toBe('On target (0.02 mi off)');
  });

  it('has no verdict in classic, which ends at the target by construction', () => {
    expect(formatSpot(SPOT, 'mi', { missMi: null, tier: null }).verdict).toBeNull();
  });
});
