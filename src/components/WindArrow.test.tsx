// @vitest-environment jsdom
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { beaufortColor } from '../core/wind';

import WindArrow from './WindArrow';

function renderArrow(props: React.ComponentProps<typeof WindArrow>) {
  const { container } = render(<WindArrow {...props} />);

  return container.querySelector('svg') as SVGElement;
}

describe('WindArrow', () => {
  // The arrow points where the wind is GOING; the degrees name where it is
  // FROM. Drawing it at the named angle would reverse every wind in the app.
  it('points downwind, not at the direction it is named for', () => {
    const svg = renderArrow({ direction: 90, speedKts: 10 });

    expect(getComputedStyle(svg).transform).toContain('rotate(270deg)');
  });

  it('takes its colour from the Beaufort scale', () => {
    const calm = renderArrow({ direction: 0, speedKts: 1 });
    const strong = renderArrow({ direction: 0, speedKts: 30 });

    expect(getComputedStyle(calm).color).not.toBe(getComputedStyle(strong).color);
    expect(beaufortColor(1)).not.toBe(beaufortColor(30));
  });

  // Only where the arrow is the sole direction cue. In the panel's table the
  // degrees are printed beside it, and a tooltip would repeat the screen.
  it('names its degrees only when asked to', () => {
    expect(renderArrow({ direction: 137, speedKts: 8 }).querySelector('title')).toBeNull();
    expect(
      renderArrow({ direction: 137, speedKts: 8, degreesTooltip: true }).querySelector('title')
        ?.textContent
    ).toBe('137°');
  });

  it('rounds the degrees it names', () => {
    const svg = renderArrow({ direction: 136.6, speedKts: 8, degreesTooltip: true });

    expect(svg.querySelector('title')?.textContent).toBe('137°');
  });
});
