import {
  FormControl,
  FormHelperText,
  InputAdornment,
  OutlinedInput,
  Tooltip
} from '@mui/material';
import React, { useState } from 'react';

import { clampNumber, getRangeErrorText, isNumberInRange } from '../core/validation';

interface NumberInputProps {
  title: string;
  label: string;
  initialValue: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /**
   * Cyclic modulus (e.g. 360 for a heading): stepping past the top wraps
   * to 0 and below 0 wraps to the top. Overrides min/max clamping.
   */
  wrap?: number;
}

export default function NumberInput({
  title,
  label,
  initialValue,
  step,
  unit,
  onChange,
  min,
  max,
  wrap
}: NumberInputProps) {
  const [value, setValue] = useState<number | string>(initialValue);
  const [valid, setValid] = useState(isNumberInRange(initialValue, min, max));

  const wrapValue = (num: number) => ((num % wrap!) + wrap!) % wrap!;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const str = event.target.value;
    const num = Number(str);

    if (str === '') {
      setValue('');
    } else if (!isNaN(num)) {
      if (wrap) {
        const wrapped = wrapValue(num);

        setValue(wrapped);
        setValid(true);
        onChange(wrapped);
      } else if (isNumberInRange(num, min, max)) {
        setValue(num);
        setValid(true);
        onChange(num);
      } else {
        setValue(num);
        setValid(false);
      }
    }
  };

  // These fields are almost always retyped wholesale rather than edited in
  // place, so select the current value on focus: one keystroke replaces it
  // instead of appending to it.
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  // Out-of-range entries are never propagated raw; on blur they are clamped
  // into range (or wrapped, for cyclic fields), shown, and propagated.
  const handleBlur = () => {
    const num = typeof value === 'number' ? value : Number(value);
    const resolved = wrap ? wrapValue(num) : clampNumber(num, min, max);

    if (resolved !== num || !valid) {
      setValue(resolved);
      setValid(true);
      onChange(resolved);
    }
  };

  return (
    <Tooltip
      title={valid ? title : `${title} ${getRangeErrorText(min, max)}`}
      componentsProps={{
        tooltip: {
          sx: valid ? {} : { color: 'red' }
        }
      }}
      arrow
    >
      <FormControl sx={{ m: 1, width: '15ch' }} variant="outlined">
        <OutlinedInput
          endAdornment={<InputAdornment position="end">{unit}</InputAdornment>}
          aria-describedby={`${label}-helper-text`}
          value={typeof value === 'number' ? value : Number(value) || 0}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          type="number"
          error={!valid}
          inputProps={wrap
            ? { 'aria-label': label, step }
            : { 'aria-label': label, step, min, max }}
          sx={valid ? {} : { color: 'red' }}
        />
        <FormHelperText id={`${label}-helper-text`} error={!valid}>
          {valid ? label : getRangeErrorText(min, max)}
        </FormHelperText>
      </FormControl>
    </Tooltip>
  );
}
