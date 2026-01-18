import {
  Block as BlockIcon,
  Looks3 as Looks3Icon,
  LooksOne as LooksOneIcon,
  LooksTwo as LooksTwoIcon
} from '@mui/icons-material';
import {
  Box,
  Divider,
  FormControl,
  FormHelperText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React from 'react';

import { FlightPath, PatternType } from '../types';
import {
  PATTERN_NONE,
  PATTERN_ONE_LEG,
  PATTERN_THREE_LEG,
  PATTERN_TWO_LEG,
  booleanToDirection,
  isLeftTurn,
  makePatternByType,
  PatternLeg
} from '../util/pattern';
import { CODEC_JSON } from '../util/util';

import DirectionSwitch from './DirectionSwitch';
import NumberInput from './NumberInput';

interface PatternParams {
  type: PatternType;
  descentRateMph: number;
  glideRatio: number;
  legs: PatternLeg[];
}

const defaultParams: PatternParams = {
  type: PATTERN_THREE_LEG,
  descentRateMph: 12,
  glideRatio: 2.6,
  legs: [
    { altitude: 300, direction: 0 },
    { altitude: 300, direction: 270 },
    { altitude: 300, direction: 270 }
  ]
};

export const defaultPattern: FlightPath = makePatternByType(defaultParams);

interface PatternComponentProps {
  onChange: (pattern: FlightPath) => void;
}

export default function PatternComponent({ onChange }: PatternComponentProps) {
  const [storedParams, setParams] = useLocalStorageState<PatternParams>(
    'flip.pattern.params',
    defaultParams,
    { codec: CODEC_JSON }
  );
  const params = storedParams ?? defaultParams;

  const handleChange = (key: keyof PatternParams, value: PatternType | number) => {
    const newParams: PatternParams = {
      ...params,
      [key]: value
    };

    setParams(newParams);
    onChange(makePatternByType(newParams));
  };

  const handleLegChange = (
    legIndex: number,
    key: keyof PatternLeg,
    value: number
  ) => {
    const newParams: PatternParams = {
      ...params,
      legs: params.legs.map((leg, i) =>
        i === legIndex ? { ...leg, [key]: value } : leg
      )
    };

    setParams(newParams);
    onChange(makePatternByType(newParams));
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <ToggleButtonGroup
        value={params.type}
        exclusive
        onChange={(_e, value) => value !== null && handleChange('type', value)}
        fullWidth
        color="primary"
      >
        <ToggleButton value={PATTERN_NONE}>
          <Tooltip title="No pattern">
            <BlockIcon />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value={PATTERN_ONE_LEG}>
          <Tooltip title="Single leg">
            <LooksOneIcon />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value={PATTERN_TWO_LEG}>
          <Tooltip title="Two-leg pattern">
            <LooksTwoIcon />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value={PATTERN_THREE_LEG}>
          <Tooltip title="Three-leg pattern">
            <Looks3Icon />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem />
      {params.type !== PATTERN_NONE && (
        <>
          <Stack direction="row" spacing={2}>
            <NumberInput
              title="Vertical speed in the pattern."
              label="Descent Rate"
              initialValue={params.descentRateMph}
              step={1}
              min={1}
              unit="mph"
              onChange={value => handleChange('descentRateMph', value)}
            />
            <NumberInput
              title="Glide ratio in the pattern with no wind."
              label="Glide Ratio"
              initialValue={params.glideRatio}
              step={0.1}
              min={0.1}
              unit=""
              onChange={value => handleChange('glideRatio', value)}
            />
          </Stack>

          <Divider />
          <Typography variant="caption">Final leg</Typography>
          <Stack direction="row" spacing={2}>
            <LegAltitudeSelector
              title="Altitude for the final leg of the pattern."
              label="Final leg altitude"
              localStorageKey="flip.pattern.altitude_selector_0"
              value={params.legs[0].altitude}
              onChange={v => handleLegChange(0, 'altitude', v)}
            />
          </Stack>
        </>
      )}

      <Divider orientation="vertical" flexItem />
      {(params.type === PATTERN_TWO_LEG || params.type === PATTERN_THREE_LEG) && (
        <>
          <Divider />
          <Typography variant="caption">Base leg</Typography>
          <Stack direction="row" spacing={2}>
            <LegAltitudeSelector
              title="Altitude for the base leg of the pattern. This determines how long the leg is."
              label="Final leg altitude"
              localStorageKey="flip.pattern.altitude_selector_1"
              value={params.legs[1].altitude}
              onChange={v => handleLegChange(1, 'altitude', v)}
            />
            <DirectionSwitch
              title="Direction for the turn after this pattern leg."
              value={isLeftTurn(params.legs[1].direction)}
              onChange={() => {
                const wasChecked = isLeftTurn(params.legs[1].direction);

                handleLegChange(1, 'direction', booleanToDirection(!wasChecked));
              }}
            />
          </Stack>
        </>
      )}

      <Divider orientation="vertical" flexItem />
      {params.type === PATTERN_THREE_LEG && (
        <>
          <Divider />
          <Typography variant="caption">Downwind leg</Typography>
          <Stack direction="row" spacing={2}>
            <LegAltitudeSelector
              title="Altitude for the downwind leg of the pattern. This determines how long the leg is."
              label="Downwind leg altitude"
              localStorageKey="flip.pattern.altitude_selector_2"
              value={params.legs[2].altitude}
              onChange={v => handleLegChange(2, 'altitude', v)}
            />
            <DirectionSwitch
              title="Direction for the turn after this pattern leg."
              value={isLeftTurn(params.legs[2].direction)}
              onChange={() => {
                const wasChecked = isLeftTurn(params.legs[2].direction);

                handleLegChange(2, 'direction', booleanToDirection(!wasChecked));
              }}
            />
          </Stack>
        </>
      )}
    </Box>
  );
}

interface LegAltitudeSelectorProps {
  localStorageKey: string;
  value: number;
  onChange: (value: number) => void;
  label: string;
  title: string;
}

function LegAltitudeSelector({
  localStorageKey,
  value,
  onChange,
  label,
  title
}: LegAltitudeSelectorProps) {
  const presetOptions = [300, 400, 500];
  const isPreset = presetOptions.includes(value);
  const [mode, setMode] = useLocalStorageState<string>(
    localStorageKey,
    isPreset ? String(value) : 'custom'
  );

  const handleToggleChange = (_: React.MouseEvent<HTMLElement>, newMode: string | null) => {
    if (!newMode) {
      return;
    }

    setMode(newMode);

    if (newMode !== 'custom') {
      onChange(Number(newMode));
    }
  };

  const handleCustomChange = (v: number) => {
    if (!isNaN(v)) {
      onChange(v);
    }
  };

  return (
    <FormControl sx={{ m: 1, width: '20ch' }} variant="outlined">
      <Tooltip title={title}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleToggleChange}
          fullWidth
          size="small"
        >
          {presetOptions.map(opt => (
            <ToggleButton key={opt} value={String(opt)}>
              {opt}
            </ToggleButton>
          ))}
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>

      {mode === 'custom' && (
        <NumberInput
          title={title}
          label={label}
          initialValue={value}
          step={100}
          min={100}
          unit="ft"
          onChange={handleCustomChange}
        />
      )}

      <FormHelperText>Altitude</FormHelperText>
    </FormControl>
  );
}
