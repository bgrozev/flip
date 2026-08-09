import {
  Navigation as NavigationIcon,
  Terrain as TerrainIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';

import { DaSeverity } from '../core/atmosphere';
import { beaufortColor } from '../core/wind';
import { useUnits } from '../hooks';

interface WindData {
  direction: number;
  speedKts: number;
  observed?: boolean;
}

interface WindSummaryProps {
  average: WindData;
  ground: WindData;
  densityAltitudeFt?: number;
  densityAltitudeSeverity?: DaSeverity;
  elevationFt?: number;
}

export default function WindSummary({
  average,
  ground,
  densityAltitudeFt,
  densityAltitudeSeverity,
  elevationFt
}: WindSummaryProps) {
  const { formatWindSpeed, windSpeedLabel, formatAltitude, altitudeLabel } = useUnits();
  const rotAverage = average.direction + 180;
  const rotGround = ground.direction + 180;

  const avgSpeed = formatWindSpeed(average.speedKts);
  const gndSpeed = formatWindSpeed(ground.speedKts);

  const daColor = densityAltitudeSeverity === 'warning'
    ? 'error.main'
    : densityAltitudeSeverity === 'caution'
      ? 'warning.main'
      : undefined;

  return (
    <Stack direction="row" spacing={3}>
      <Tooltip title={`Average wind in the pattern and manoeuvre, weighted by descent rate. In ${windSpeedLabel}.`}>
        <Typography variant="button">
          avg
          <NavigationIcon
            sx={{
              fontSize: 16,
              transform: `rotate(${rotAverage}deg)`,
              mx: 0.5,
              // Beaufort, like the map arrows and the wind table's dots: the
              // strength of the wind should read the same wherever it is shown.
              color: beaufortColor(average.speedKts)
            }}
          />
          {Math.round(average.direction)}˚@{avgSpeed.value.toFixed(1)}
        </Typography>
      </Tooltip>
      <Tooltip title={`Ground wind in ${windSpeedLabel}.`}>
        <Typography variant="button">
          gnd
          <NavigationIcon
            sx={{
              fontSize: 16,
              transform: `rotate(${rotGround}deg)`,
              mx: 0.5,
              color: beaufortColor(ground.speedKts)
            }}
          />
          {Math.round(ground.direction)}˚@{gndSpeed.value.toFixed(1)}
        </Typography>
      </Tooltip>
      {ground.observed && (
        <Tooltip sx={{ fontSize: 16, mx: 0.5 }} title="Observed conditions">
          <VisibilityIcon />
        </Tooltip>
      )}
      {densityAltitudeFt !== undefined && (
        <Tooltip
          title={
            `Density altitude: how the air performs, correcting field elevation for `
            + `temperature and humidity.`
            + (elevationFt !== undefined
              ? ` Elevation ${Math.round(formatAltitude(elevationFt).value)} ${altitudeLabel}.`
              : '')
          }
        >
          <Typography variant="button" sx={{ color: daColor, display: 'inline-flex', alignItems: 'center' }}>
            <TerrainIcon sx={{ fontSize: 16, mr: 0.5 }} />
            {Math.round(formatAltitude(densityAltitudeFt).value)} {altitudeLabel}
          </Typography>
        </Tooltip>
      )}
    </Stack>
  );
}
