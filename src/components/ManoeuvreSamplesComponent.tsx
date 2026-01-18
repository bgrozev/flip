import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React from 'react';

import { FlightPath } from '../types';
import { samples } from '../samples';
import { mirror } from '../util/util';

import DirectionSwitch from './DirectionSwitch';

interface ManoeuvreSamplesComponentProps {
  onChange?: (path: FlightPath) => void;
}

export default function ManoeuvreSamplesComponent({
  onChange
}: ManoeuvreSamplesComponentProps) {
  const [storedIndex, setSelectedIndex] = useLocalStorageState<number>(
    'flip.manoeuvre.samples.selectedIndex',
    0
  );
  const selectedIndex = storedIndex ?? 0;
  const [left, setLeft] = React.useState(true);

  function fireChange(index: number, l: boolean) {
    let path = samples[index].getPath();

    if (!l) {
      path = mirror(path);
    }
    onChange?.(path);
  }

  const handleChange = (event: SelectChangeEvent<number>) => {
    const index = event.target.value as number;

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
