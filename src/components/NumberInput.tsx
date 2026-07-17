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
}

export default function NumberInput({
  title,
  label,
  initialValue,
  step,
  unit,
  onChange,
  min,
  max
}: NumberInputProps) {
  const [value, setValue] = useState<number | string>(initialValue);
  const [valid, setValid] = useState(isNumberInRange(initialValue, min, max));

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const str = event.target.value;
    const num = Number(str);

    if (str === '') {
      setValue('');
    } else if (!isNaN(num)) {
      setValue(num);
      if (isNumberInRange(num, min, max)) {
        setValid(true);
        onChange(num);
      } else {
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
  // into range, shown, and propagated.
  const handleBlur = () => {
    const num = typeof value === 'number' ? value : Number(value);
    const clamped = clampNumber(num, min, max);

    if (clamped !== num || !valid) {
      setValue(clamped);
      setValid(true);
      onChange(clamped);
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
          inputProps={{ 'aria-label': label, step, min, max }}
          sx={valid ? {} : { color: 'red' }}
        />
        <FormHelperText id={`${label}-helper-text`} error={!valid}>
          {valid ? label : getRangeErrorText(min, max)}
        </FormHelperText>
      </FormControl>
    </Tooltip>
  );
}
