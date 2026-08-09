import {
  Button,
  Divider,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import React from 'react';

import { TargetProvider } from '../hooks';
import { Target } from '../types';
import { normalizeDirection } from '../core/validation';

import { PlacePicker } from './';
import NumberField from './NumberField';
import { SectionHeading } from './PanelSection';

interface TargetComponentProps {
  target: Target;
  setTarget: (target: Target) => void;
  /** Applies a place chosen in the picker — every mode, not just this one. */
  selectPlace: (target: Target) => void;
  /**
   * Heading that lands into wind — the current wind direction, or null when
   * there is no usable wind. Drives the Upwind button, and is the fallback
   * heading for places with no known landing direction.
   */
  upwindHeading: number | null;
  /**
   * Whether the final heading applies at all. Flocking ignores it (the
   * jumprun and canopy directions live in its own panel), so the heading
   * controls are hidden there.
   */
  headingRelevant?: boolean;
}

export default function TargetComponent({
  target,
  setTarget,
  selectPlace,
  upwindHeading,
  headingRelevant = true
}: TargetComponentProps) {
  const handleHeadingChange = (value: number) => {
    // `NumberField` wraps at 360 already; normalizing again costs nothing and
    // keeps the guarantee local to the thing that stores the heading.
    setTarget({ ...target, finalHeading: normalizeDirection(value) });
  };

  return (
    <Stack spacing={3}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Drag the target on the map to move it
        {headingRelevant ? '; hover it to rotate the final heading' : ''}.
        Shift-click the map to jump it there.
      </Typography>

      {headingRelevant && (
        <Stack direction="row">
          <NumberField
            title="The direction of the final approach."
            label="Final heading"
            value={Math.round(target.finalHeading)}
            step={1}
            wrap={360}
            unit="°"
            onChange={handleHeadingChange}
          />
          <Tooltip title="Set final heading against the wind." arrow>
            <span>
              <Button
                variant="outlined"
                disabled={upwindHeading === null}
                onClick={() => setTarget({ ...target, finalHeading: upwindHeading ?? 0 })}
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
            </span>
          </Tooltip>
        </Stack>
      )}
      <Divider />
      <TargetProvider target={target} setTarget={setTarget} selectPlace={selectPlace}>
        <SectionHeading>Location</SectionHeading>
        <PlacePicker upwindHeading={upwindHeading} />
      </TargetProvider>
    </Stack>
  );
}
