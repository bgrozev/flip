import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack
} from '@mui/material';
import React, { useState } from 'react';

import { DROPZONES } from '../util/dropzones.js';

export default function DropzonesComponent({ target, setTarget }) {
    const [ selected, setSelected ] = useState('');

    const handleSelected = selectedName => {
        setSelected(selectedName);
        const dropzone = DROPZONES.find(dz => dz.name === selectedName);

        if (dropzone) {
            setTarget({
                target: {
                    lat: dropzone.lat,
                    lng: dropzone.lng
                },
                finalHeading: dropzone.direction ?? target.finalHeading
            });
        }
    };

    return (
        <Stack>
            <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Select dropzone</InputLabel>
                <Select
                    value={selected}
                    label="Select dropzone"
                    onChange={e => {
                        handleSelected(e.target.value);
                    }}
                    renderValue={value => value || ''}
                >
                    {DROPZONES.map(dz => (
                        <MenuItem key={dz.name} value={dz.name}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{dz.name}</span>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Stack>
    );
}
