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
  SelectChangeEvent,
  Stack,
  TextField
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { useState } from 'react';

import { useTarget } from '../hooks';
import { createSimpleCodec } from '../util/storage';

interface CustomLocation {
  name: string;
  lat: number;
  lng: number;
  direction: number;
}

export default function CustomLocationsComponent() {
  const { target, selectLocation } = useTarget();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');

  const [customLocations, setCustomLocations] = useLocalStorageState<CustomLocation[]>(
    'flip.custom_locations',
    [],
    { codec: createSimpleCodec<CustomLocation[]>([]) }
  );

  const save = (ev: React.FormEvent) => {
    ev.preventDefault();

    const newDz: CustomLocation = {
      name,
      lat: target.target.lat,
      lng: target.target.lng,
      direction: target.finalHeading
    };
    const locations = customLocations ?? [];
    const updated = [...locations.filter(dz => dz.name !== name), newDz];

    setCustomLocations(updated);
  };

  const removeCustom = (nameToRemove: string) => {
    const locations = customLocations ?? [];
    const updated = locations.filter(dz => dz.name !== nameToRemove);

    setCustomLocations(updated);
    if (selected === nameToRemove) {
      setSelected('');
    }
  };

  const handleSelected = (selectedName: string) => {
    setSelected(selectedName);
    const locations = customLocations ?? [];
    const location = locations.find(dz => dz.name === selectedName);

    if (location) {
      selectLocation(
        { lat: location.lat, lng: location.lng },
        location.direction
      );
    }
  };

  return (
    <Stack>
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>Select location</InputLabel>
        <Select
          value={selected}
          label="Select dropzone"
          onChange={(e: SelectChangeEvent) => handleSelected(e.target.value)}
          renderValue={value => value || ''}
        >
          {(customLocations ?? []).map(opt => (
            <MenuItem key={opt.name} value={opt.name}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
              >
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
        <Button variant="contained" type="submit">
          Save current location
        </Button>
      </Box>
    </Stack>
  );
}
