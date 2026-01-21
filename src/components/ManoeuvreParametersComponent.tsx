import { Stack } from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React from 'react';

import { useUnits } from '../hooks';
import { FlightPath, ManoeuvreParams } from '../types';
import { createManoeuvrePath } from '../util/manoeuvre';
import { createSafeCodec } from '../util/storage';

import DirectionSwitch from './DirectionSwitch';
import NumberInput from './NumberInput';

const DEFAULT_PARAMS: ManoeuvreParams = {
  offsetXFt: 300,
  offsetYFt: 150,
  altitudeFt: 900,
  duration: 8,
  left: true
};
const DEFAULT_PATH = createManoeuvrePath(DEFAULT_PARAMS);

function defaultParams(): ManoeuvreParams {
  return { ...DEFAULT_PARAMS };
}
export function defaultPath(): FlightPath {
  return [...DEFAULT_PATH];
}

interface ManoeuvreParametersComponentProps {
  onChange: (path: FlightPath) => void;
}

export default function ManoeuvreParametersComponent({
  onChange
}: ManoeuvreParametersComponentProps) {
  const { formatAltitude, parseAltitude, altitudeLabel } = useUnits();

  const [storedParams, setParams] = useLocalStorageState<ManoeuvreParams>(
    'flip.manoeuvre.params',
    DEFAULT_PARAMS,
    { codec: createSafeCodec(DEFAULT_PARAMS) }
  );
  const params = storedParams ?? DEFAULT_PARAMS;

  const handleChange =
    (key: keyof ManoeuvreParams) => (value: number | boolean) => {
      const newParams = {
        ...params,
        [key]: value
      } as ManoeuvreParams;

      setParams(newParams);
      onChange(createManoeuvrePath(newParams));
    };

  const handleSwitch = () => {
    const newParams = {
      ...params,
      left: !params.left
    };

    setParams(newParams);
    onChange(createManoeuvrePath(newParams));
  };

  return (
    <Stack direction="column" spacing={2}>
      <NumberInput
        title="Distance in the depth direction."
        label="Back"
        initialValue={formatAltitude(params.offsetXFt).value}
        step={altitudeLabel === 'ft' ? 50 : 15}
        min={altitudeLabel === 'ft' ? 50 : 15}
        unit={altitudeLabel}
        onChange={v => handleChange('offsetXFt')(parseAltitude(v))}
      />
      <NumberInput
        title="Distance in the offset direction."
        label="Offset"
        initialValue={formatAltitude(params.offsetYFt).value}
        step={altitudeLabel === 'ft' ? 50 : 15}
        min={altitudeLabel === 'ft' ? 50 : 15}
        unit={altitudeLabel}
        onChange={v => handleChange('offsetYFt')(parseAltitude(v))}
      />
      <NumberInput
        title="The altitude the manoeuvre starts at."
        label="Altitude"
        initialValue={formatAltitude(params.altitudeFt).value}
        step={altitudeLabel === 'ft' ? 50 : 15}
        min={altitudeLabel === 'ft' ? 300 : 90}
        unit={altitudeLabel}
        onChange={v => handleChange('altitudeFt')(parseAltitude(v))}
      />
      <NumberInput
        title="The duration from the start of manoeuvre to flying level."
        label="Duration"
        initialValue={params.duration}
        step={0.5}
        min={1}
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
