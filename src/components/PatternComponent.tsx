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

import { useUnits } from '../hooks';
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
import { createSafeCodec } from '../util/storage';

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
  const {
    formatDescentRate,
    parseDescentRate,
    descentRateLabel,
    formatAltitude,
    parseAltitude,
    altitudeLabel
  } = useUnits();

  const [storedParams, setParams] = useLocalStorageState<PatternParams>(
    'flip.pattern.params',
    defaultParams,
    { codec: createSafeCodec(defaultParams) }
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
              initialValue={formatDescentRate(params.descentRateMph).value}
              step={1}
              min={1}
              unit={descentRateLabel}
              onChange={value => handleChange('descentRateMph', parseDescentRate(value))}
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
              value={params.legs[0].altitude}
              onChange={v => handleLegChange(0, 'altitude', v)}
              formatAltitude={formatAltitude}
              parseAltitude={parseAltitude}
              altitudeLabel={altitudeLabel}
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
              label="Base leg altitude"
              value={params.legs[1].altitude}
              onChange={v => handleLegChange(1, 'altitude', v)}
              formatAltitude={formatAltitude}
              parseAltitude={parseAltitude}
              altitudeLabel={altitudeLabel}
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
              value={params.legs[2].altitude}
              onChange={v => handleLegChange(2, 'altitude', v)}
              formatAltitude={formatAltitude}
              parseAltitude={parseAltitude}
              altitudeLabel={altitudeLabel}
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
  value: number;
  onChange: (value: number) => void;
  label: string;
  title: string;
  formatAltitude: (feet: number, decimals?: number) => { value: number; label: string };
  parseAltitude: (displayValue: number) => number;
  altitudeLabel: string;
}

// Preset options: display value -> internal feet value
const PRESETS_FT = [
  { display: 300, internal: 300 },
  { display: 400, internal: 400 },
  { display: 500, internal: 500 }
];
const PRESETS_M = [
  { display: 100, internal: 328 },  // 100m ≈ 328 ft
  { display: 150, internal: 492 },  // 150m ≈ 492 ft
  { display: 200, internal: 656 }   // 200m ≈ 656 ft
];

function LegAltitudeSelector({
  value,
  onChange,
  label,
  title,
  formatAltitude,
  parseAltitude,
  altitudeLabel
}: LegAltitudeSelectorProps) {
  const presets = altitudeLabel === 'ft' ? PRESETS_FT : PRESETS_M;

  // Determine mode based on whether current value matches a preset
  const matchingPreset = presets.find(p => p.internal === value);
  const mode = matchingPreset ? String(matchingPreset.internal) : 'custom';

  const handleToggleChange = (_: React.MouseEvent<HTMLElement>, newMode: string | null) => {
    if (!newMode || newMode === 'custom') {
      return;
    }
    // newMode is the internal feet value as string
    onChange(Number(newMode));
  };

  const handleCustomChange = (displayValue: number) => {
    if (!isNaN(displayValue)) {
      // Convert from display units to internal feet
      onChange(parseAltitude(displayValue));
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
          {presets.map(preset => (
            <ToggleButton key={preset.internal} value={String(preset.internal)}>
              {preset.display}
            </ToggleButton>
          ))}
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>

      {mode === 'custom' && (
        <NumberInput
          title={title}
          label={label}
          initialValue={Math.round(formatAltitude(value).value)}
          step={altitudeLabel === 'ft' ? 100 : 10}
          min={altitudeLabel === 'ft' ? 100 : 30}
          unit={altitudeLabel}
          onChange={handleCustomChange}
        />
      )}

      <FormHelperText>Altitude ({altitudeLabel})</FormHelperText>
    </FormControl>
  );
}
