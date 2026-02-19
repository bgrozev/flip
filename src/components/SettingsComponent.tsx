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

interface SettingsGroup {
  title: string;
  options: CheckboxOption[];
}

const settingsGroups: SettingsGroup[] = [
  {
    title: 'Appearance',
    options: [
      {
        key: 'showPresets',
        label: 'Show presets',
        tooltip: 'Show the preset selector in the toolbar to save and load configurations.'
      }
    ]
  },
  {
    title: 'Map',
    options: [
      {
        key: 'showPreWind',
        label: 'Show pre-wind pattern',
        tooltip: 'Plot the pattern before it is adjusted for wind. You will see two lines plotted.'
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
        tooltip:
          'When hovering over a point, also highlight the corresponding point in the pre-wind pattern.'
      },
      {
        key: 'displayWindArrow',
        label: 'Show average wind on the map',
        tooltip: 'Shows an arrow with the average wind on top of the map.'
      }
    ]
  },
  {
    title: 'Wind',
    options: [
      {
        key: 'useDzGroundWind',
        label: 'Use observed ground wind',
        tooltip: 'Use real-time ground wind observations. Only available for certain locations.'
      },
      {
        key: 'interpolateWind',
        label: 'Interpolate winds',
        tooltip: 'Smooth out wind changes across altitudes by interpolating.'
      },
      {
        key: 'displayWindSummary',
        label: 'Show wind summary in title bar',
        tooltip: 'Shows the average and ground wind in the top bar of the app.'
      }
    ]
  },
  {
    title: 'Pattern',
    options: [
      {
        key: 'correctPatternHeading',
        label: 'Correct heading for rectangular turn',
        tooltip:
          'Correct the direction of the pattern in case the loaded turn is not exactly 90/270/450.'
      },
      {
        key: 'straightenLegs',
        label: 'Straighten legs',
        tooltip:
          'Redistribute intermediate points on each leg so they lie on a straight line between the leg endpoints. Removes visual curves caused by wind shear without changing the wind drift calculation.'
      }
    ]
  }
];

interface SettingsComponentProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        textAlign: 'left',
        color: 'text.secondary',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        pt: 0.5
      }}
    >
      {children}
    </Typography>
  );
}

function SettingRow({
  label,
  tooltip,
  children
}: {
  label?: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 0.25,
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {label !== undefined && (
        <Tooltip title={tooltip ?? ''} placement="right">
          <Typography sx={{ flexGrow: 1, textAlign: 'left' }}>{label}</Typography>
        </Tooltip>
      )}
      {children}
    </Box>
  );
}

export default function SettingsComponent({
  settings,
  setSettings
}: SettingsComponentProps) {
  const handleCheckboxChange = (key: keyof Settings) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleNumberChange = (key: keyof Settings) => (value: number) => {
    setSettings({ ...settings, [key]: Number(value) });
  };

  const handleUnitChange = <K extends keyof UnitPreferences>(
    unitKey: K,
    value: UnitPreferences[K]
  ) => {
    setSettings({ ...settings, units: { ...settings.units, [unitKey]: value } });
  };

  return (
    <Stack direction="column" spacing={0.5} alignItems="flex-start" sx={{ width: '100%', textAlign: 'left' }}>
      <SectionHeader>Appearance</SectionHeader>
      <SettingRow label="Light / Dark theme">
        <ThemeSwitcher />
      </SettingRow>
      {settingsGroups[0].options.map(({ key, label, tooltip }) => (
        <SettingRow key={key} label={label} tooltip={tooltip}>
          <Switch checked={Boolean(settings[key])} onChange={() => handleCheckboxChange(key)} />
        </SettingRow>
      ))}

      {settingsGroups.slice(1).map(group => (
        <React.Fragment key={group.title}>
          <Divider sx={{ width: '100%', mt: 1 }} />
          <SectionHeader>{group.title}</SectionHeader>
          {group.options.map(({ key, label, tooltip }) => (
            <SettingRow key={key} label={label} tooltip={tooltip}>
              <Switch
                checked={Boolean(settings[key])}
                onChange={() => handleCheckboxChange(key)}
              />
            </SettingRow>
          ))}
          {group.title === 'Wind' && (
            <Box sx={{ pt: 0.5, width: '100%' }}>
              <NumberInput
                title="Show upper winds in the table up to this altitude."
                label="Wind altitude limit"
                initialValue={settings.limitWind}
                step={1000}
                min={1000}
                unit="ft"
                onChange={handleNumberChange('limitWind')}
              />
            </Box>
          )}
        </React.Fragment>
      ))}

      <Divider sx={{ width: '100%', mt: 1 }} />
      <SectionHeader>Units</SectionHeader>

      <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
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

      <FormControl fullWidth size="small">
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
