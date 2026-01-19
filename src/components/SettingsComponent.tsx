import {
  Box,
  Divider,
  Stack,
  Switch,
  Tooltip,
  Typography
} from '@mui/material';
import { ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import React from 'react';

import { Settings } from '../types';

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
    </Stack>
  );
}
