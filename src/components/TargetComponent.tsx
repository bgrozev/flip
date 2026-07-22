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
  Tooltip,
  Typography
} from '@mui/material';
import React from 'react';

import { TargetProvider } from '../hooks';
import { Target } from '../types';
import { normalizeDirection } from '../core/validation';

import { LocationComponent } from './';

interface TargetComponentProps {
  target: Target;
  setTarget: (target: Target) => void;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  onUpwindClick: () => void;
  /**
   * Whether the final heading applies at all. Flocking ignores it (the
   * jumprun and canopy directions live in its own panel), so the heading
   * controls and the map-edit toggle are hidden there — in that mode the
   * target is always draggable on the map.
   */
  headingRelevant?: boolean;
}

export default function TargetComponent({
  target,
  setTarget,
  editOpen,
  onEditOpenChange,
  onUpwindClick,
  headingRelevant = true
}: TargetComponentProps) {
  const handleHeadingChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    // Normalize into [0, 360); the old `(x + 360) % 360` stayed negative for
    // values below -360, and NaN (empty input) becomes 0.
    const value = normalizeDirection(Number(ev.target.value));
    const updated = { ...target, finalHeading: value };

    setTarget(updated);
  };

  return (
    <Stack spacing={3}>
      {headingRelevant ? (
        <Button
          variant={editOpen ? 'contained' : 'outlined'}
          size="small"
          startIcon={<EditLocationIcon />}
          onClick={() => onEditOpenChange(!editOpen)}
          sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
        >
          {editOpen ? 'Done' : 'Edit on Map'}
        </Button>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'left' }}>
          Drag the target on the map to move it.
        </Typography>
      )}

      {headingRelevant && (
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
      )}
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
