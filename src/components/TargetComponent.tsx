import {
  EditLocation as EditLocationIcon
} from '@mui/icons-material';
import {
  Button,
  Divider,
  FormControl,
  FormHelperText,
  InputAdornment,
  OutlinedInput,
  Stack,
  Tooltip
} from '@mui/material';
import React from 'react';

import { TargetProvider } from '../hooks';
import { Target } from '../types';

import { LocationComponent } from './';

interface TargetComponentProps {
  target: Target;
  setTarget: (target: Target) => void;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  onUpwindClick: () => void;
}

export default function TargetComponent({
  target,
  setTarget,
  editOpen,
  onEditOpenChange,
  onUpwindClick
}: TargetComponentProps) {
  const handleHeadingChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const value = (Number(ev.target.value) + 360) % 360;
    const updated = { ...target, finalHeading: value };

    setTarget(updated);
  };

  return (
    <Stack spacing={3}>
      <Button
        variant={editOpen ? 'contained' : 'outlined'}
        size="small"
        startIcon={<EditLocationIcon />}
        onClick={() => onEditOpenChange(!editOpen)}
        sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
      >
        {editOpen ? 'Done' : 'Edit on Map'}
      </Button>

      <Stack direction="row">
        <ControlledNumberInput
          title="The direction of the final approach."
          label="Final Heading"
          value={target.finalHeading}
          step={1}
          unit="°"
          onChange={handleHeadingChange}
        />
        <Tooltip title="Set final heading against the wind." arrow>
          <Button
            variant="outlined"
            onClick={onUpwindClick}
            sx={{
              textTransform: 'none',
              alignSelf: 'center',
              paddingTop: '4px',
              paddingBottom: '4px',
              minHeight: 'auto'
            }}
          >
            Upwind
          </Button>
        </Tooltip>
      </Stack>
      <Divider />
      <TargetProvider target={target} setTarget={setTarget}>
        <LocationComponent />
      </TargetProvider>
    </Stack>
  );
}

interface ControlledNumberInputProps {
  title: string;
  label: string;
  value: number;
  step: number;
  unit: string;
  onChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;
}

// This has to be a controlled input, because it can be updated via clicks on the map.
function ControlledNumberInput({
  title,
  label,
  value,
  step,
  unit,
  onChange
}: ControlledNumberInputProps) {
  return (
    <Tooltip title={title}>
      <FormControl sx={{ m: 1, width: '15ch' }} variant="outlined">
        <OutlinedInput
          endAdornment={<InputAdornment position="end">{unit}</InputAdornment>}
          aria-describedby={`${label}-helper-text`}
          value={value}
          onChange={onChange}
          type="number"
          inputProps={{ 'aria-label': label, step }}
        />
        <FormHelperText id={`${label}-helper-text`}>{label}</FormHelperText>
      </FormControl>
    </Tooltip>
  );
}
