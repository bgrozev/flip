import {
  Box,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Switch,
  Tooltip,
  Typography
} from '@mui/material';
import { ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import React from 'react';

import { Settings } from '../types';
import {
  ALTITUDE_UNIT_OPTIONS,
  AltitudeUnit,
  DESCENT_RATE_UNIT_OPTIONS,
  DescentRateUnit,
  UnitPreferences,
  WIND_SPEED_UNIT_OPTIONS,
  WindSpeedUnit
} from '../util/units';

import NumberInput from './NumberInput';

interface CheckboxOption {
  key: keyof Settings;
  label: string;
  tooltip: string;
}

const checkboxOptions: CheckboxOption[] = [
  {
    key: 'showPreWind',
    label: 'Display pre-wind adjusted pattern',
    tooltip:
      'Plot the pattern before it is adjusted for wind. You will see two lines plotted.'
  },
  {
    key: 'showPomAltitudes',
    label: 'Show pattern point altitudes',
    tooltip: 'Display the altitude of pattern points on the map.'
  },
  {
    key: 'showPomTooltips',
    label: 'Show tooltips on pattern points',
    tooltip: 'Show detailed information when hovering over pattern points on the map.'
  },
  {
    key: 'highlightCorrespondingPoints',
    label: 'Highlight corresponding pre-wind point',
    tooltip: 'When hovering over a point, also highlight the corresponding point in the pre-wind pattern.'
  },
  {
    key: 'useDzGroundWind',
    label: 'Use observed ground wind when available',
    tooltip:
      'Use real-time ground wind observations. Only available for certain locations.'
  },
  {
    key: 'interpolateWind',
    label: 'Interpolate winds between specified altitudes',
    tooltip: 'Smooth out wind changes across altitudes by interpolating.'
  },
  {
    key: 'displayWindArrow',
    label: 'Show average wind on the map',
    tooltip: 'Shows an arrow with the average wind on top of the map.'
  },
  {
    key: 'displayWindSummary',
    label: 'Show wind summary in the title bar',
    tooltip: 'Shows the average and ground wind in the top bar of the app.'
  },
  {
    key: 'correctPatternHeading',
    label: 'Correct pattern heading for a 90/270/450/etc turn',
    tooltip:
      'Correct the direction of the pattern in case the loaded turn is not exactly 90/270/450.'
  },
  {
    key: 'showPresets',
    label: 'Show presets',
    tooltip: 'Show the preset selector in the toolbar to save and load configurations.'
  }
];

interface SettingsComponentProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

export default function SettingsComponent({
  settings,
  setSettings
}: SettingsComponentProps) {
  const handleCheckboxChange = (key: keyof Settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };

    setSettings(newSettings);
  };

  const handleNumberChange = (key: keyof Settings) => (value: number) => {
    const newSettings = { ...settings, [key]: Number(value) };

    setSettings(newSettings);
  };

  const handleUnitChange = <K extends keyof UnitPreferences>(
    unitKey: K,
    value: UnitPreferences[K]
  ) => {
    const newSettings = {
      ...settings,
      units: { ...settings.units, [unitKey]: value }
    };
    setSettings(newSettings);
  };

  return (
    <Stack direction="column" spacing={1} alignItems="flex-start">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 0.5,
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        Light/Dark theme
        <ThemeSwitcher />
      </Box>
      {checkboxOptions.map(({ key, label, tooltip }) => (
        <Box
          key={key}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 0.5,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <Tooltip title={tooltip} placement="right">
            <Typography sx={{ flexGrow: 1 }}>{label}</Typography>
          </Tooltip>
          <Switch
            checked={Boolean(settings[key])}
            onChange={() => handleCheckboxChange(key)}
          />
        </Box>
      ))}

      <Divider />
      <NumberInput
        title="Show upper winds in the table up to this altitude. "
        label="Wind altitude limit"
        initialValue={settings.limitWind}
        step={1000}
        min={1000}
        unit="ft"
        onChange={handleNumberChange('limitWind')}
      />

      <Divider sx={{ width: '100%', my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Display Units
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel id="altitude-unit-label">Altitude</InputLabel>
        <Select
          labelId="altitude-unit-label"
          value={settings.units.altitude}
          label="Altitude"
          onChange={(e: SelectChangeEvent) =>
            handleUnitChange('altitude', e.target.value as AltitudeUnit)
          }
        >
          {ALTITUDE_UNIT_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel id="wind-speed-unit-label">Wind Speed</InputLabel>
        <Select
          labelId="wind-speed-unit-label"
          value={settings.units.windSpeed}
          label="Wind Speed"
          onChange={(e: SelectChangeEvent) =>
            handleUnitChange('windSpeed', e.target.value as WindSpeedUnit)
          }
        >
          {WIND_SPEED_UNIT_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel id="descent-rate-unit-label">Descent Rate</InputLabel>
        <Select
          labelId="descent-rate-unit-label"
          value={settings.units.descentRate}
          label="Descent Rate"
          onChange={(e: SelectChangeEvent) =>
            handleUnitChange('descentRate', e.target.value as DescentRateUnit)
          }
        >
          {DESCENT_RATE_UNIT_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
