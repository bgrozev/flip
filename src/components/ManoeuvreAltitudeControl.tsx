import { Button, Divider, Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';

import { useUnits } from '../hooks';
import { FlightPath, ManoeuvreConfig } from '../types';
import { mirror } from '../core/geometry';
import { samples } from '../samples';

import NumberField from './NumberField';

function getOriginalPath(config: ManoeuvreConfig): FlightPath {
  if (config.type === 'track') return config.trackData ?? [];
  if (config.type === 'samples') {
    if (typeof config.sampleIndex !== 'number') return [];
    let path = samples[config.sampleIndex]?.getPath() ?? [];
    if (config.sampleLeft === false) path = mirror(path);
    return path;
  }
  return [];
}

interface ManoeuvreAltitudeControlProps {
  config: ManoeuvreConfig;
  onChange: (offset: number) => void;
}

export default function ManoeuvreAltitudeControl({
  config,
  onChange
}: ManoeuvreAltitudeControlProps) {
  const { formatAltitude, parseAltitude, altitudeLabel } = useUnits();

  const originalPath = getOriginalPath(config);
  const originalInitAlt = originalPath.length > 0
    ? originalPath[originalPath.length - 1].properties.alt
    : 0;
  const offset = config.initiationAltitudeOffset ?? 0;
  const currentInitAlt = originalInitAlt + offset;

  // All hooks must be called before any early return
  const [inputVal, setInputVal] = React.useState<string>(
    () => String(Math.round(formatAltitude(currentInitAlt).value))
  );

  // Sync the displayed value when offset or units change externally
  React.useEffect(() => {
    const expected = String(Math.round(formatAltitude(originalInitAlt + offset).value));
    setInputVal(expected);
  }, [offset, originalInitAlt, altitudeLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing to show until a path is loaded
  if (originalPath.length === 0) return null;

  const maxDelta = originalInitAlt * 0.15;
  const minFt = originalInitAlt - maxDelta;
  const maxFt = originalInitAlt + maxDelta;
  const { value: displayMin } = formatAltitude(minFt);
  const { value: displayMax } = formatAltitude(maxFt);

  const handleChange = (value: number) => {
    setInputVal(String(value));

    const newFt = parseAltitude(value);

    if (newFt >= minFt && newFt <= maxFt) {
      onChange(Math.round(newFt - originalInitAlt));
    }
  };

  const handleReset = () => onChange(0); // effect will sync inputVal

  const displayOffsetAbs = Math.round(formatAltitude(Math.abs(offset)).value);
  const offsetText = offset !== 0
    ? `${offset > 0 ? '+' : '-'}${displayOffsetAbs} ${altitudeLabel}`
    : null;

  return (
    <>
      <Divider />
      <Stack spacing={1}>
        <NumberField
          label="Initiation altitude"
          title="Where the recorded turn starts. Moving it scales the track; the shape is the one that was flown."
          value={Number(inputVal)}
          unit={altitudeLabel}
          step={altitudeLabel === 'ft' ? 10 : 3}
          limits={{ min: Math.round(displayMin), max: Math.round(displayMax) }}
          onChange={handleChange}
        />

        {/* Only when there is something to undo — the same rule the other
            reset actions follow. */}
        {offsetText && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="body2"
              sx={{ color: offset > 0 ? 'success.main' : 'error.main', fontWeight: 500 }}
            >
              {offsetText}
            </Typography>
            <Tooltip title="Put the initiation back at the recorded altitude.">
              <Button size="small" onClick={handleReset} sx={{ p: 0, minWidth: 0 }}>
                Reset
              </Button>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </>
  );
}
