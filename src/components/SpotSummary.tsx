/**
 * The spot in the top bar — flocking's answer, where the wind summary sits
 * in every other mode.
 *
 * A flocker's whole session ends in one sentence that has to be read out to
 * a pilot, so in flocking that sentence outranks the wind: the map's winds
 * indicator already carries GND and the altitude bands, which is what the
 * bar was repeating. Clicking it copies.
 */
import { ContentCopy as CopyIcon } from '@mui/icons-material';
import { Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';

import { SpotText } from '../core/spotText';
import { useCopySpot } from '../hooks';

export interface SpotSummaryProps {
  spot: SpotText;
}

export default function SpotSummary({ spot }: SpotSummaryProps) {
  const { copy } = useCopySpot();

  return (
    <Tooltip title="Click to copy the spot">
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={() => copy(spot.line)}
        data-testid="spot-summary"
        sx={{ cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            // Not `button` (which the wind summary uses): that variant
            // upper-cases, and "prior" vs "PAST" is carried by the case.
            textTransform: 'none',
            // The line is long for a top bar and the leading half — the
            // jumprun and the distance — is the half that must survive a
            // narrow phone, so it truncates from the end.
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 'bold',
            fontSize: { xs: '0.95rem', sm: '1rem' }
          }}
        >
          {spot.line}
        </Typography>
        <CopyIcon sx={{ fontSize: 16, flexShrink: 0, opacity: 0.7 }} />
      </Stack>
    </Tooltip>
  );
}
