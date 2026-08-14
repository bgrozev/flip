// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import NumberField from './NumberField';

const LIMITS = { min: 100, max: 900 };

function renderField(props: Partial<React.ComponentProps<typeof NumberField>> = {}) {
  const onChange = vi.fn();

  render(
    <NumberField
      label="Depth"
      value={300}
      limits={LIMITS}
      onChange={onChange}
      {...props as React.ComponentProps<typeof NumberField>}
    />
  );

  return { onChange, input: screen.getByLabelText('Depth') as HTMLInputElement };
}

describe('NumberField', () => {
  it('does not propagate a value on its way past the bottom of the range', () => {
    const { onChange, input } = renderField();

    // "5" on the way to "500" is below the minimum and must not reshape
    // anything; the field still shows what was typed.
    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('5');

    fireEvent.change(input, { target: { value: '500' } });
    expect(onChange).toHaveBeenCalledWith(500);
  });

  it('clamps to the range on blur, and shows what it settled on', () => {
    const { onChange, input } = renderField();

    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(900);
    expect(input.value).toBe('900');
  });

  it('restores the value when the field is left empty', () => {
    const { input } = renderField();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input.value).toBe('300');
  });

  it('carries the bounds on the input, so the spinner stops at the edge', () => {
    const { input } = renderField();

    expect(input.min).toBe('100');
    expect(input.max).toBe('900');
  });

  it('wraps a cyclic field instead of clamping it', () => {
    const { onChange, input } = renderField({ value: 350, wrap: 360, limits: undefined });

    fireEvent.change(input, { target: { value: '370' } });
    expect(onChange).toHaveBeenLastCalledWith(10);

    fireEvent.change(input, { target: { value: '-10' } });
    expect(onChange).toHaveBeenLastCalledWith(350);

    // A heading has no bottom or top to stop the spinner at
    expect(input.min).toBe('');
    expect(input.max).toBe('');
  });

  // These are retyped wholesale far more often than edited in place, so the
  // next keystroke should replace the value rather than append to it.
  // (Asserted through `select` rather than the selection offsets: a
  // `type=number` input does not expose them.)
  it('selects its value on focus', () => {
    const select = vi.spyOn(HTMLInputElement.prototype, 'select');
    const { input } = renderField();

    fireEvent.focus(input);

    expect(select).toHaveBeenCalledTimes(1);
    expect(select.mock.instances[0]).toBe(input);

    select.mockRestore();
  });

  it('follows the value when it changes from outside', () => {
    const { rerender } = render(
      <NumberField label="Depth" value={300} limits={LIMITS} onChange={vi.fn()} />
    );

    expect((screen.getByLabelText('Depth') as HTMLInputElement).value).toBe('300');

    // A map drag, a preset load, a unit switch: the field is controlled, so
    // it re-syncs rather than needing a remount key the way the old input did
    rerender(<NumberField label="Depth" value={420} limits={LIMITS} onChange={vi.fn()} />);

    expect((screen.getByLabelText('Depth') as HTMLInputElement).value).toBe('420');
  });
});
