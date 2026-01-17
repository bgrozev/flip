import {
    FormControl,
    FormHelperText,
    InputAdornment,
    OutlinedInput,
    Tooltip
} from '@mui/material';
import React, { useState } from 'react';

import { getRangeErrorText, isNumberInRange } from '../util/validation.js';

export default function NumberInput({ title, label, initialValue, step, unit, onChange, min, max }) {
    const [ value, setValue ] = useState(initialValue);
    const [ valid, setValid ] = useState(isNumberInRange(initialValue, min, max));

    const handleChange = event => {
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
                    type='number'
                    inputProps={{ 'aria-label': label, step, min, max }}
                    sx={valid ? {} : { color: 'red' }}
                />
                <FormHelperText id={`${label}-helper-text`}>{label}</FormHelperText>
            </FormControl>
        </Tooltip>
    );
}
