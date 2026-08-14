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

/**
 * A reading is one token. Left to wrap, "140˚@6.6" broke under its own "AVG"
 * and "2552 FT" split across two lines, which is what turned the phone's
 * toolbar into two rows.
 */
const NO_WRAP = { whiteSpace: 'nowrap', flexShrink: 0 } as const;

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
    // Tight on a phone, where this shares one toolbar row with the mode switch
    // and the presets menu; roomy from sm up, where there is space to spare.
    <Stack direction="row" spacing={{ xs: 1, sm: 3 }} alignItems="center" sx={{ minWidth: 0 }}>
      <Tooltip title={`Average wind in the pattern and manoeuvre, weighted by descent rate. In ${windSpeedLabel}.`}>
        <Typography variant="button" sx={NO_WRAP}>
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
        <Typography variant="button" sx={NO_WRAP}>
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
        // The `sx` used to sit on the Tooltip, which is not the element that
        // renders — so this drew at the icon's default 24px and, on a phone,
        // was the widest thing in the bar after the readings themselves.
        <Tooltip title="Observed conditions">
          <VisibilityIcon sx={{ fontSize: 16, flexShrink: 0 }} />
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
          <Typography
            variant="button"
            sx={{
              ...NO_WRAP,
              color: daColor,
              alignItems: 'center',
              // The last thing to go on a phone, and the one that costs
              // nothing: the map's winds indicator carries temperature and
              // density altitude in its own header, and the Wind panel has the
              // whole conditions row. The two wind readings are only here.
              display: { xs: 'none', sm: 'inline-flex' }
            }}
          >
            <TerrainIcon sx={{ fontSize: 16, mr: 0.5 }} />
            {Math.round(formatAltitude(densityAltitudeFt).value)} {altitudeLabel}
          </Typography>
        </Tooltip>
      )}
    </Stack>
  );
}
