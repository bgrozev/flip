import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React from 'react';


import sample270 from '../samples/sample270.js';
import sample450 from '../samples/sample450.js';
import sample630 from '../samples/sample630.js';
import sample810 from '../samples/sample810.js';
import sample90 from '../samples/sample90.js';
import { mirror } from '../util/util.js';

import DirectionSwitch from './DirectionSwitch.js';

const samples = [ sample90, sample270, sample450, sample630, sample810 ];

export default function ManoeuvreSamplesComponent({ onChange }) {
    const [ selectedIndex, setSelectedIndex ] = useLocalStorageState('flip.manoeuvre.samples.selectedIndex', 0);
    const [ left, setLeft ] = React.useState(true);

    function fireChange(index, l) {
        let path = samples[index].path;

        if (!l) {
            path = mirror(path);
        }
        onChange?.(path);
    }
    const handleChange = event => {
        const index = event.target.value;

        setSelectedIndex(index);
        fireChange(index, left);
    };

    function handleSwitch() {
        setLeft(!left);
        fireChange(selectedIndex, !left);
    }

    return (
        <Stack alignItems="center" spacing={2}>
            <FormControl fullWidth>
                <InputLabel id="sample-select-label">Select Sample</InputLabel>
                <Select
                    labelId="sample-select-label"
                    value={selectedIndex}
                    label="Select Sample"
                    onChange={handleChange}
                >
                    {samples.map((sample, index) => (
                        <MenuItem key={index} value={index}>
                            {sample.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Typography> {samples[selectedIndex].description}</Typography>

            <DirectionSwitch
                title="Left or right hand turn"
                value={!left}
                onChange={handleSwitch}
            />
        </Stack>
    );
}
