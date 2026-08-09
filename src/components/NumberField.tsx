/**
 * The numeric field. One of them, for every panel.
 *
 * There were three: this one (grown in the Manoeuvre panel), an older
 * `NumberInput` whose label hung underneath as helper text and whose value
 * was uncontrolled — so callers remounted it with a key whenever anything
 * changed the value from outside — and a hand-rolled `TextField` in Courses
 * with its own focus refs and commit-on-blur. The same number looked
 * different in three panels and behaved differently in all three.
 *
 * The rules here:
 *
 * - The label floats above, the unit sits in the field, and the helper text
 *   stays free to explain a bound the user just hit.
 * - Out-of-range values are never propagated while typing (a half-typed "5"
 *   on the way to "500" must not reshape the plan) and are clamped on blur.
 * - `min`/`max` go on the input element too, so the spinner stops at the
 *   edge instead of stepping somewhere the plan cannot go.
 * - Focusing selects the current value: these fields are retyped wholesale
 *   far more often than they are edited in place.
 */
import { InputAdornment, TextField, Tooltip } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { NumericLimits, clampNumber } from '../core/validation';

import selectOnFocus from './selectOnFocus';

/**
 * How wide a numeric field gets. A three- or four-digit number in a 400 px
 * panel does not need the whole width, and a column of full-width boxes
 * reads as a form to fill in rather than a value to adjust; `full` stays
 * for the ones that share a row.
 */
export const NUMBER_FIELD_WIDTH = 220;

interface NumberFieldBase {
  label: string;
  /** Tooltip: what this number means. Every field should be able to say. */
  title?: string;
  /** Current value, already in display units. */
  value: number;
  unit?: string;
  step?: number;
  /** Shown under the field; use it to explain a bound the user just hit. */
  helperText?: string;
  /** Fill the container instead of the standard numeric width. */
  fullWidth?: boolean;
  onChange: (value: number) => void;
}

/**
 * Bounds are required — a field that cannot say what it will accept has no
 * business clamping — except on a cyclic one, where wrapping replaces them:
 * a heading has no minimum, it just comes round again.
 */
export type NumberFieldProps = NumberFieldBase & (
  | { wrap: number; limits?: undefined }
  | { wrap?: undefined; limits: NumericLimits }
);

const UNBOUNDED: NumericLimits = { min: -Infinity, max: Infinity };

export default function NumberField({
  label,
  title,
  value,
  unit,
  step = 1,
  limits = UNBOUNDED,
  wrap,
  helperText,
  fullWidth = false,
  onChange
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));

  // Re-sync when the value changes from outside (a preset load, a unit
  // switch, a drag on the map). Runs only on `value`, so a partially typed
  // entry is safe.
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const resolve = (num: number) =>
    wrap ? ((num % wrap) + wrap) % wrap : clampNumber(num, limits.min, limits.max);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;

    setText(next);

    const parsed = parseFloat(next);

    if (!Number.isFinite(parsed)) {
      return;
    }

    if (wrap) {
      onChange(resolve(parsed));
    } else if (parsed >= limits.min && parsed <= limits.max) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(text);

    if (!Number.isFinite(parsed)) {
      setText(String(value));

      return;
    }

    const resolved = resolve(parsed);

    setText(String(resolved));
    onChange(resolved);
  };

  const field = (
    <TextField
      label={label}
      size="small"
      fullWidth={fullWidth}
      value={text}
      onChange={handleChange}
      onFocus={selectOnFocus}
      onBlur={handleBlur}
      helperText={helperText}
      sx={fullWidth ? undefined : { width: NUMBER_FIELD_WIDTH, maxWidth: '100%' }}
      slotProps={{
        input: unit
          ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }
          : undefined,
        htmlInput: {
          type: 'number',
          step,
          'aria-label': label,
          ...wrap ? {} : { min: limits.min, max: limits.max }
        }
      }}
    />
  );

  return title ? <Tooltip title={title}>{field}</Tooltip> : field;
}
