import { Box, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack } from '@mui/material';
import React, { useState } from 'react';

import { useTarget } from '../hooks';
import { DROPZONES } from '../util/dropzones';

export default function DropzonesComponent() {
  const { selectLocation } = useTarget();
  const [selected, setSelected] = useState('');

  const handleSelected = (selectedName: string) => {
    setSelected(selectedName);
    const dropzone = DROPZONES.find(dz => dz.name === selectedName);

    if (dropzone) {
      selectLocation(
        { lat: dropzone.lat, lng: dropzone.lng },
        dropzone.direction
      );
    }
  };

  return (
    <Stack>
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>Select dropzone</InputLabel>
        <Select
          value={selected}
          label="Select dropzone"
          onChange={(e: SelectChangeEvent) => {
            handleSelected(e.target.value);
          }}
          renderValue={value => value || ''}
        >
          {DROPZONES.map(dz => (
            <MenuItem key={dz.name} value={dz.name}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
              >
                <span>{dz.name}</span>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
