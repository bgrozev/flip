import {
    FormControl,
    FormHelperText,
    InputAdornment,
    OutlinedInput,
    Tooltip
} from '@mui/material';
import React, { useState } from 'react';

export default function NumberInput({ title, label, initialValue, step, unit, onChange, min, max }) {
    const [ value, setValue ] = useState(initialValue);
    const isValid = num => (typeof min === 'undefined' || num >= min) && (typeof max === 'undefined' || num <= max);
    const [ valid, setValid ] = useState(isValid(initialValue));

    const handleChange = event => {
        const str = event.target.value;
        const num = Number(str);

        if (str === '') {
            setValue('');
        } else if (!isNaN(num)) {
            setValue(num);
            if (isValid(num)) {
                setValid(true);
                onChange(num);
            } else {
                setValid(false);
            }
        }
    };

    return (
        <Tooltip
            title={valid ? title : `${title} ${getLimitText(min, max)}`}
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

function getLimitText(min, max) {
    if (typeof min === 'number' && typeof max === 'number') {
        return `It must be between ${min} and ${max}.`;
    } else if (typeof min === 'number') {
        return `It must be at least ${min}.`;
    } else if (typeof max === 'number') {
        return `It must be at most ${max}.`;
    }

    return 'Invalid value.';
}
