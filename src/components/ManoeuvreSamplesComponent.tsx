import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography
} from '@mui/material';
import React from 'react';

import { samples } from '../samples';

import DirectionSwitch from './DirectionSwitch';

interface ManoeuvreSamplesComponentProps {
  sampleIndex: number;
  sampleLeft: boolean;
  onChange: (index: number, left: boolean) => void;
}

export default function ManoeuvreSamplesComponent({
  sampleIndex,
  sampleLeft,
  onChange
}: ManoeuvreSamplesComponentProps) {
  const handleSampleChange = (event: SelectChangeEvent<number>) => {
    onChange(event.target.value as number, sampleLeft);
  };

  const handleSwitch = () => {
    onChange(sampleIndex, !sampleLeft);
  };

  return (
    <Stack alignItems="center" spacing={2}>
      <FormControl fullWidth>
        <InputLabel id="sample-select-label">Select Sample</InputLabel>
        <Select
          labelId="sample-select-label"
          value={sampleIndex}
          label="Select Sample"
          onChange={handleSampleChange}
        >
          {samples.map((sample, index) => (
            <MenuItem key={index} value={index}>
              {sample.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography>{samples[sampleIndex].description}</Typography>

      <DirectionSwitch
        title="Left or right hand turn"
        value={!sampleLeft}
        onChange={handleSwitch}
      />
    </Stack>
  );
}
