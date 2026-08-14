// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import Wordmark, { ART } from './Wordmark';

// Scoped to its own container, so a test may hold both planners at once and
// compare them without the two renders colliding.
function renderWordmark(flocking: boolean) {
  const onToggle = vi.fn();
  const { unmount, container } = render(<Wordmark flocking={flocking} onToggle={onToggle} />);

  return { onToggle, unmount, button: container.querySelector('button') as HTMLElement };
}

/** The mark's painted cells: the background first, then the drawn ones. */
function markRects(button: HTMLElement) {
  // Inside the group, so the clip path's own rect is left out of it.
  return [...button.querySelectorAll('svg g rect')].map(rect => ({
    x: rect.getAttribute('x'),
    y: rect.getAttribute('y'),
    width: rect.getAttribute('width'),
    fill: rect.getAttribute('fill')
  }));
}

/** The letter actually on screen, as opposed to the twin holding the width. */
function visibleLetter(button: HTMLElement): string {
  const letters = [...button.querySelectorAll('span')]
    .filter(span => span.style.visibility !== '')
    .filter(span => span.style.visibility !== 'hidden');

  expect(letters).toHaveLength(1);

  return letters[0].textContent ?? '';
}

describe('the mark', () => {
  // The logo is an F and the same F turned 180 degrees in the other colour —
  // the name's joke, drawn. It is also what makes FloP a colour swap rather
  // than a redraw, so a change that breaks it has broken both at once.
  it('is unchanged under a 180-degree turn with the colours exchanged', () => {
    const size = ART.length;
    const swapped = (cell: string) => (cell === 'G' ? 'B' : 'G');

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(ART[y][x]).toBe(swapped(ART[size - 1 - y][size - 1 - x]));
      }
    }
  });

  it('is square', () => {
    ART.forEach(row => expect(row.length).toBe(ART.length));
  });

  // Swapping which cells are drawn AS WELL as the colours cancels out, and the
  // mark comes out identical in both states. It shipped that way once.
  it('exchanges its two colours without moving a cell', () => {
    const flip = markRects(renderWordmark(false).button);
    const flop = markRects(renderWordmark(true).button);
    const geometry = (rects: ReturnType<typeof markRects>) =>
      rects.map(({ x, y, width }) => `${x},${y},${width}`);

    expect(geometry(flop)).toEqual(geometry(flip));

    // Every cell that was green is now blue, and every blue one green.
    expect(flop.map(r => r.fill)).toEqual(
      flip.map(r => (r.fill === '#14e02c' ? '#0b67d9' : '#14e02c'))
    );
  });
});

describe('Wordmark', () => {
  it('is FliP outside flocking and FloP inside it', () => {
    expect(visibleLetter(renderWordmark(false).button)).toBe('i');
    expect(visibleLetter(renderWordmark(true).button)).toBe('o');
  });

  // The switch should read as one letter turning over, so F, l and P may not
  // shift: both letters are always present, and only one of them is shown.
  it('keeps the same letters in the same places in both planners', () => {
    const flip = renderWordmark(false).button.textContent;

    expect(renderWordmark(true).button.textContent).toBe(flip);
  });

  it('switches planners when clicked', () => {
    const { onToggle, button } = renderWordmark(false);

    fireEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('names the planner it switches TO, since that is what the click does', () => {
    expect(renderWordmark(false).button.getAttribute('aria-label'))
      .toBe('Switch to FloP — Flocking Planner');
    expect(renderWordmark(true).button.getAttribute('aria-label'))
      .toBe('Switch to FliP — Flight Planner');
  });
});
