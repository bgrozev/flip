import {
  Looks3 as Looks3Icon,
  LooksOne as LooksOneIcon,
  LooksTwo as LooksTwoIcon
} from '@mui/icons-material';
import {
  Box,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import React from 'react';

import { useUnits } from '../hooks';
import { PatternParams, PatternType } from '../types';
import {
  PATTERN_NONE,
  PATTERN_ONE_LEG,
  PATTERN_THREE_LEG,
  PATTERN_TWO_LEG,
  booleanToDirection,
  flipPatternSides,
  isLeftTurn,
  PatternLeg
} from '../core/pattern';
import { LIMITS } from '../core/validation';

import DirectionSwitch from './DirectionSwitch';
import { SectionHeading } from './PanelSection';
import NumberField from './NumberField';

interface PatternComponentProps {
  params: PatternParams;
  onParamsChange: (params: PatternParams) => void;
  /**
   * Whether the user may choose how many legs the pattern has. Standard
   * Pattern hides it and always flies three (see modes/): picking NONE/1/2
   * is a swooper's decision, not something a regular jumper should face.
   */
  legCountSelectable?: boolean;
  /**
   * Nerd mode. A swooper always gets the per-leg left/right switches (their
   * pattern can be asymmetric); the everyday Standard Pattern jumper gets a
   * single pattern-wide left/right control instead, unless nerd mode is on,
   * which restores the per-leg switches for them too.
   */
  nerd?: boolean;
}

export default function PatternComponent({
  params,
  onParamsChange,
  legCountSelectable = true,
  nerd = false
}: PatternComponentProps) {
  const {
    formatDescentRate,
    parseDescentRate,
    descentRateLabel,
    formatAltitude,
    parseAltitude,
    altitudeLabel
  } = useUnits();

  const handleChange = (key: keyof PatternParams, value: PatternType | number) => {
    onParamsChange({ ...params, [key]: value });
  };

  const handleLegChange = (legIndex: number, key: keyof PatternLeg, value: number) => {
    onParamsChange({
      ...params,
      legs: params.legs.map((leg, i) => (i === legIndex ? { ...leg, [key]: value } : leg))
    });
  };

  // Swoop always gets the per-leg switches (an asymmetric "Z" pattern is a
  // swooper's call); Standard Pattern gets them only under nerd mode, and
  // the single pattern-wide control otherwise.
  const showPerLegSwitches = legCountSelectable || nerd;
  const showPatternWideSwitch = !showPerLegSwitches;
  const patternIsAllLeft = isLeftTurn(params.legs[1].direction) && isLeftTurn(params.legs[2].direction);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {legCountSelectable && (
        <>
          <ToggleButtonGroup
            value={params.type}
            exclusive
            onChange={(_e, value) => value !== null && handleChange('type', value)}
            fullWidth
            color="primary"
          >
            <ToggleButton value={PATTERN_NONE}>None</ToggleButton>
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

        </>
      )}
      {showPatternWideSwitch && (params.type === PATTERN_TWO_LEG || params.type === PATTERN_THREE_LEG) && (
        <>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography sx={{ flexGrow: 1 }}>Pattern turns</Typography>
            <DirectionSwitch
              title="Left-hand or right-hand pattern: both turns switch together (shortcut: X). A mixed pattern resolves to left."
              value={patternIsAllLeft}
              onChange={() => onParamsChange(flipPatternSides(params))}
            />
          </Stack>
          <Divider />
        </>
      )}
      {params.type !== PATTERN_NONE && (
        <>
          <SectionHeading>Final leg</SectionHeading>
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

      {(params.type === PATTERN_TWO_LEG || params.type === PATTERN_THREE_LEG) && (
        <>
          <Divider />
          <SectionHeading>Base leg</SectionHeading>
          <Stack direction="row" spacing={2} alignItems="center">
            <LegAltitudeSelector
              title="Altitude for the base leg of the pattern. This determines how long the leg is."
              label="Base leg altitude"
              value={params.legs[1].altitude}
              onChange={v => handleLegChange(1, 'altitude', v)}
              formatAltitude={formatAltitude}
              parseAltitude={parseAltitude}
              altitudeLabel={altitudeLabel}
            />
            {showPerLegSwitches && (
              <DirectionSwitch
                title="Direction for the turn after this pattern leg."
                value={isLeftTurn(params.legs[1].direction)}
                onChange={() => {
                  const wasChecked = isLeftTurn(params.legs[1].direction);
                  handleLegChange(1, 'direction', booleanToDirection(!wasChecked));
                }}
              />
            )}
          </Stack>
        </>
      )}

      {params.type === PATTERN_THREE_LEG && (
        <>
          <Divider />
          <SectionHeading>Downwind leg</SectionHeading>
          <Stack direction="row" spacing={2} alignItems="center">
            <LegAltitudeSelector
              title="Altitude for the downwind leg of the pattern. This determines how long the leg is."
              label="Downwind leg altitude"
              value={params.legs[2].altitude}
              onChange={v => handleLegChange(2, 'altitude', v)}
              formatAltitude={formatAltitude}
              parseAltitude={parseAltitude}
              altitudeLabel={altitudeLabel}
            />
            {showPerLegSwitches && (
              <DirectionSwitch
                title="Direction for the turn after this pattern leg."
                value={isLeftTurn(params.legs[2].direction)}
                onChange={() => {
                  const wasChecked = isLeftTurn(params.legs[2].direction);
                  handleLegChange(2, 'direction', booleanToDirection(!wasChecked));
                }}
              />
            )}
          </Stack>
        </>
      )}

      {params.type !== PATTERN_NONE && (
        <>
          <Divider />
          <Stack direction="row" spacing={2}>
            <NumberField
              title="Vertical speed in the pattern."
              label="Descent Rate"
              value={formatDescentRate(params.descentRateMph).value}
              step={1}
              limits={{
                min: formatDescentRate(LIMITS.descentRateMph.min).value,
                max: formatDescentRate(LIMITS.descentRateMph.max).value
              }}
              unit={descentRateLabel}
              fullWidth
              onChange={value => handleChange('descentRateMph', parseDescentRate(value))}
            />
            <NumberField
              title="Glide ratio in the pattern with no wind."
              label="Glide Ratio"
              value={params.glideRatio}
              step={0.1}
              limits={LIMITS.glideRatio}
              fullWidth
              onChange={value => handleChange('glideRatio', value)}
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

  const matchingPreset = presets.find(p => p.internal === value);
  const [userSelectedCustom, setUserSelectedCustom] = React.useState(() => !matchingPreset);

  // If an external value change lands on a preset, exit custom mode
  React.useEffect(() => {
    if (matchingPreset) setUserSelectedCustom(false);
  }, [value]);

  const isCustom = userSelectedCustom || !matchingPreset;
  const mode = isCustom ? 'custom' : String(matchingPreset!.internal);

  const handleToggleChange = (_: React.MouseEvent<HTMLElement>, newMode: string | null) => {
    if (!newMode) return;
    if (newMode === 'custom') {
      setUserSelectedCustom(true);
      return;
    }
    setUserSelectedCustom(false);
    onChange(Number(newMode));
  };

  const handleCustomChange = (displayValue: number) => {
    if (!isNaN(displayValue)) {
      onChange(parseAltitude(displayValue));
    }
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
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

      {isCustom && (
        <Box sx={{ mt: 1 }}>
          <NumberField
            title={title}
            label={label}
            value={Math.round(formatAltitude(value).value)}
            step={altitudeLabel === 'ft' ? 100 : 10}
            limits={{
              min: Math.round(formatAltitude(LIMITS.patternLegAltitudeFt.min).value),
              max: Math.round(formatAltitude(LIMITS.patternLegAltitudeFt.max).value)
            }}
            unit={altitudeLabel}
            fullWidth
            onChange={handleCustomChange}
          />
        </Box>
      )}
    </Box>
  );
}
