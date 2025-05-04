import DeleteIcon from '@mui/icons-material/Delete';
import {
    Box,
    Button,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { useState } from 'react';

import { CODEC_JSON } from '../util/util.js';

export default function CustomLocationsComponent({ target, setTarget }) {
    const [ name, setName ] = useState('');
    const [ selected, setSelected ] = useState('');

    const [ customLocations, setCustomLocations ] = useLocalStorageState(
        'flip.custom_locations',
        [],
        { codec: CODEC_JSON }
    );

    const save = ev => {
        ev.preventDefault();

        const newDz = { name, lat: target.target.lat, lng: target.target.lng, direction: target.finalHeading };
        const updated = [ ...customLocations.filter(dz => dz.name !== name), newDz ];

        setCustomLocations(updated);
    };

    const removeCustom = nameToRemove => {
        const updated = customLocations.filter(dz => dz.name !== nameToRemove);

        setCustomLocations(updated);
        if (selected === nameToRemove) {
            setSelected('');
        }
    };

    const handleSelected = selectedName => {
        setSelected(selectedName);
        const location = customLocations.find(dz => dz.name === selectedName);

        if (location) {
            setTarget({
                target: {
                    lat: location.lat,
                    lng: location.lng
                },
                finalHeading: location.direction ?? target.finalHeading
            });
        }
    };

    return (
        <Stack>
            <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Select location</InputLabel>
                <Select
                    value={selected}
                    label="Select dropzone"
                    onChange={e => handleSelected(e.target.value)}
                    renderValue={value => value || ''}
                >
                    {customLocations.map(opt => (
                        <MenuItem key={opt.name} value={opt.name}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span>{opt.name}</span>
                                <IconButton
                                    size="small"
                                    onClick={e => {
                                        e.stopPropagation();
                                        removeCustom(opt.name);
                                    }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Divider />
            <Box mt={4} component="form" onSubmit={save}>
                <TextField
                    label="Name"
                    value={name}
                    onChange={ev => setName(ev.target.value)}
                    required
                    fullWidth
                    sx={{ mb: 2 }}
                />
                <Button variant="contained" type="submit">Save current location</Button>
            </Box>
        </Stack>
    );
}
