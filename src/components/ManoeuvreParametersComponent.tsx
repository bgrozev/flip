import { Stack } from '@mui/material';
import React from 'react';

import { DEFAULT_MANOEUVRE_PARAMS } from '../core/model';
import { useUnits } from '../hooks';
import { ManoeuvreParams } from '../types';
import { LIMITS } from '../core/validation';

import DirectionSwitch from './DirectionSwitch';
import NumberInput from './NumberInput';

// Canonical definition lives in core/model; re-exported for existing users
export { DEFAULT_MANOEUVRE_PARAMS };

interface ManoeuvreParametersComponentProps {
  params: ManoeuvreParams;
  onParamsChange: (params: ManoeuvreParams) => void;
}

export default function ManoeuvreParametersComponent({
  params,
  onParamsChange
}: ManoeuvreParametersComponentProps) {
  const { formatAltitude, parseAltitude, altitudeLabel } = useUnits();

  const handleChange = (key: keyof ManoeuvreParams) => (value: number | boolean) => {
    onParamsChange({ ...params, [key]: value } as ManoeuvreParams);
  };

  const handleSwitch = () => {
    onParamsChange({ ...params, left: !params.left });
  };

  return (
    <Stack direction="column" spacing={2}>
      <NumberInput
        title="Distance in the depth direction. Negative values offset to the opposite side."
        label="Back"
        initialValue={formatAltitude(params.offsetXFt).value}
        step={altitudeLabel === 'ft' ? 50 : 15}
        min={Math.round(formatAltitude(LIMITS.manoeuvreOffsetXFt.min).value)}
        max={Math.round(formatAltitude(LIMITS.manoeuvreOffsetXFt.max).value)}
        unit={altitudeLabel}
        onChange={v => handleChange('offsetXFt')(parseAltitude(v))}
      />
      <NumberInput
        title="Distance in the offset direction."
        label="Offset"
        initialValue={formatAltitude(params.offsetYFt).value}
        step={altitudeLabel === 'ft' ? 50 : 15}
        min={Math.round(formatAltitude(LIMITS.manoeuvreOffsetYFt.min).value)}
        max={Math.round(formatAltitude(LIMITS.manoeuvreOffsetYFt.max).value)}
        unit={altitudeLabel}
        onChange={v => handleChange('offsetYFt')(parseAltitude(v))}
      />
      <NumberInput
        title="The altitude the manoeuvre starts at."
        label="Altitude"
        initialValue={formatAltitude(params.altitudeFt).value}
        step={altitudeLabel === 'ft' ? 50 : 15}
        min={Math.round(formatAltitude(LIMITS.manoeuvreAltitudeFt.min).value)}
        max={Math.round(formatAltitude(LIMITS.manoeuvreAltitudeFt.max).value)}
        unit={altitudeLabel}
        onChange={v => handleChange('altitudeFt')(parseAltitude(v))}
      />
      <NumberInput
        title="The duration from the start of manoeuvre to flying level."
        label="Duration"
        initialValue={params.duration}
        step={0.5}
        min={LIMITS.manoeuvreDurationS.min}
        max={LIMITS.manoeuvreDurationS.max}
        unit="s"
        onChange={handleChange('duration')}
      />
      <DirectionSwitch
        title={
          'The position of the target relative to the start of the turn. For example, for a right hand ' +
          '270 the target is on the LEFT side.'
        }
        value={!params.left}
        onChange={handleSwitch}
      />
    </Stack>
  );
}
