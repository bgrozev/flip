import { Stack } from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React from 'react';

import { FlightPath, ManoeuvreParams } from '../types';
import { createManoeuvrePath } from '../util/manoeuvre';
import { CODEC_JSON } from '../util/util';

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
  const [storedParams, setParams] = useLocalStorageState<ManoeuvreParams>(
    'flip.manoeuvre.params',
    defaultParams(),
    { codec: CODEC_JSON }
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
        initialValue={params.offsetXFt}
        step={50}
        min={50}
        unit="ft"
        onChange={handleChange('offsetXFt')}
      />
      <NumberInput
        title="Distance in the offset direction."
        label="Offset"
        initialValue={params.offsetYFt}
        step={50}
        min={50}
        unit="ft"
        onChange={handleChange('offsetYFt')}
      />
      <NumberInput
        title="The altitude the manoeuvre starts at."
        label="Altitude"
        initialValue={params.altitudeFt}
        step={50}
        min={300}
        unit="ft"
        onChange={handleChange('altitudeFt')}
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
