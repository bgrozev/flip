// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatSpot } from '../core/spotText';
import { NotificationsProvider } from '../hooks';

import SpotSummary from './SpotSummary';

const SPOT = formatSpot(
  { jumprunDeg: 248, alongMi: 3.412, prior: true, offsetMi: 0.418, offsetLeft: true },
  'mi'
);

function renderSummary(writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true
  });

  render(
    <NotificationsProvider>
      <SpotSummary spot={SPOT} />
    </NotificationsProvider>
  );

  return { writeText };
}

describe('SpotSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the whole spot on one line', () => {
    renderSummary();

    expect(screen.getByTestId('spot-summary').textContent)
      .toContain('Jumprun 248˚ · 3.41 mi prior · 0.42 mi left');
  });

  it('copies the spot when clicked, and says so', async () => {
    const { writeText } = renderSummary();

    fireEvent.click(screen.getByTestId('spot-summary'));

    expect(writeText).toHaveBeenCalledWith('Jumprun 248˚ · 3.41 mi prior · 0.42 mi left');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Copied'));
  });

  it('reports a copy that did not happen rather than pretending', async () => {
    const { writeText } = renderSummary(vi.fn().mockRejectedValue(new Error('denied')));

    fireEvent.click(screen.getByTestId('spot-summary'));

    expect(writeText).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('Could not copy the spot'));
  });
});
