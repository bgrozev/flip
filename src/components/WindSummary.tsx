import {
  Navigation as NavigationIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';

interface WindData {
  direction: number;
  speedKts: number;
  observed?: boolean;
}

interface WindSummaryProps {
  average: WindData;
  ground: WindData;
}

export default function WindSummary({ average, ground }: WindSummaryProps) {
  const rotAverage = average.direction + 180;
  const rotGround = ground.direction + 180;

  return (
    <Stack direction="row" spacing={3}>
      <Tooltip title="Average wind in the pattern and manoeuvre, weighted by descent rate. In knots.">
        <Typography variant="button">
          avg
          <NavigationIcon
            sx={{ fontSize: 16, transform: `rotate(${rotAverage}deg)`, mx: 0.5 }}
          />
          {Math.round(average.direction)}˚@{average.speedKts.toFixed(1)}
        </Typography>
      </Tooltip>
      <Tooltip title="Ground wind in knots.">
        <Typography variant="button">
          gnd
          <NavigationIcon
            sx={{ fontSize: 16, transform: `rotate(${rotGround}deg)`, mx: 0.5 }}
          />
          {Math.round(ground.direction)}˚@{ground.speedKts.toFixed(1)}
        </Typography>
      </Tooltip>
      {ground.observed && (
        <Tooltip sx={{ fontSize: 16, mx: 0.5 }} title="Observed conditions">
          <VisibilityIcon />
        </Tooltip>
      )}
    </Stack>
  );
}
