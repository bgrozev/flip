// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RISK_ACCEPT_LABEL, RISK_INTRO, RISK_POINTS } from '../core/disclaimer';
import { HELP_TOPICS } from '../core/help';

import RiskNoticeDialog from './RiskNotice';

function renderDialog() {
  const onAccept = vi.fn();

  render(<RiskNoticeDialog open onAccept={onAccept} />);

  const button = screen.getByRole('button', { name: RISK_ACCEPT_LABEL });
  const checkbox = screen.getByRole('checkbox');

  return { onAccept, button, checkbox };
}

describe('the risk notice', () => {
  it('shows the notice', () => {
    renderDialog();

    expect(screen.getByText(RISK_INTRO)).toBeTruthy();
    RISK_POINTS.forEach(point => expect(screen.getByText(point)).toBeTruthy());
  });

  // The whole point of the gate: agreeing has to be an act, not a side
  // effect of wanting to get on with it.
  it('cannot be accepted until the box is checked', () => {
    const { onAccept, button } = renderDialog();

    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('accepts once the box is checked', () => {
    const { onAccept, button, checkbox } = renderDialog();

    fireEvent.click(checkbox);
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  // No close button, no backdrop click, no Escape — a "you must agree"
  // dialog with a way out is a suggestion.
  it('has no way out but the button', () => {
    const { onAccept } = renderDialog();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByText(RISK_INTRO)).toBeTruthy();
    expect(onAccept).not.toHaveBeenCalled();
  });
});

describe('the help topic', () => {
  // The notice is shown in two places and must not drift between them.
  it('renders the same words as the overlay', () => {
    const topic = HELP_TOPICS.find(t => t.id === 'risk');

    expect(topic?.blocks).toEqual([{ kind: 'riskNotice' }]);
  });
});
