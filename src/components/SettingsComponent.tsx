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

import { MapProvider, Settings } from '../types';
import { OPEN_METEO_MODELS } from '../core/wind';
import {
  ALTITUDE_UNIT_OPTIONS,
  AltitudeUnit,
  DESCENT_RATE_UNIT_OPTIONS,
  DISTANCE_UNIT_OPTIONS,
  DescentRateUnit,
  DistanceUnit,
  PRESSURE_UNIT_OPTIONS,
  PressureUnit,
  TEMPERATURE_UNIT_OPTIONS,
  TemperatureUnit,
  UnitPreferences,
  WIND_SPEED_UNIT_OPTIONS,
  WindSpeedUnit
} from '../core/units';


interface CheckboxOption {
  key: keyof Settings;
  label: string;
  tooltip: string;
  /** Only offered under nerd mode; forced to its everyday value otherwise. */
  nerd?: boolean;
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
        tooltip: 'Show detailed information when hovering over pattern points on the map.',
        nerd: true
      },
      {
        key: 'highlightCorrespondingPoints',
        label: 'Highlight corresponding pre-wind point',
        tooltip:
          'When hovering over a point, also highlight the corresponding point in the pre-wind pattern.',
        nerd: true
      },
      {
        key: 'showCrabArrow',
        label: 'Show drift angle arrows',
        tooltip: 'Show a heading arrow on pattern points where the drift angle (heading vs. ground track) exceeds 10°.'
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
      },
      {
        key: 'displayMapWinds',
        label: 'Show winds on the map',
        tooltip: 'A compact winds-by-altitude indicator in the map corner, visible in every mode. Collapses to a ground-wind chip.'
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

  const handleUnitChange = <K extends keyof UnitPreferences>(
    unitKey: K,
    value: UnitPreferences[K]
  ) => {
    setSettings({ ...settings, units: { ...settings.units, [unitKey]: value } });
  };

  // Nerd rows are dropped entirely, not disabled: the point of the mode is
  // a shorter panel. Their effect is suppressed separately (applyNerdGate).
  const visible = (options: CheckboxOption[]) =>
    options.filter(o => !o.nerd || settings.nerd);

  return (
    <Stack direction="column" spacing={0.5} alignItems="flex-start" sx={{ width: '100%', textAlign: 'left' }}>
      {/* First, because toggling it makes rows appear BELOW — at the bottom
          of the panel the change would happen off-screen. */}
      <SectionHeader>Nerd mode</SectionHeader>
      <SettingRow
        label="Nerd mode"
        tooltip="Unlocks manual wind entry, exports and extra map detail, and adds more options to this panel."
      >
        <Switch
          checked={settings.nerd}
          onChange={() => handleCheckboxChange('nerd')}
          slotProps={{ input: { 'aria-label': 'Nerd mode' } }}
        />
      </SettingRow>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'left', pb: 0.5 }}>
        Extra tools most jumpers never need: manual wind entry, exports and
        extra map detail.
      </Typography>

      <Divider sx={{ width: '100%', mt: 1 }} />
      <SectionHeader>Appearance</SectionHeader>
      <SettingRow label="Light / Dark theme">
        <ThemeSwitcher />
      </SettingRow>
      {visible(settingsGroups[0].options).map(({ key, label, tooltip }) => (
        <SettingRow key={key} label={label} tooltip={tooltip}>
          <Switch checked={Boolean(settings[key])} onChange={() => handleCheckboxChange(key)} />
        </SettingRow>
      ))}

      {settingsGroups.slice(1).map(group => (
        <React.Fragment key={group.title}>
          <Divider sx={{ width: '100%', mt: 1 }} />
          <SectionHeader>{group.title}</SectionHeader>
          {visible(group.options).map(({ key, label, tooltip }) => (
            <SettingRow key={key} label={label} tooltip={tooltip}>
              <Switch
                checked={Boolean(settings[key])}
                onChange={() => handleCheckboxChange(key)}
              />
            </SettingRow>
          ))}
          {group.title === 'Map' && (
            <Box sx={{ pt: 0.5, width: '100%' }}>
              <FormControl fullWidth size="small">
                <InputLabel id="map-provider-label">Map provider</InputLabel>
                <Select
                  labelId="map-provider-label"
                  value={settings.mapProvider}
                  label="Map provider"
                  onChange={(e: SelectChangeEvent) =>
                    setSettings({ ...settings, mapProvider: e.target.value as MapProvider })
                  }
                >
                  <MenuItem value="google">Google Maps</MenuItem>
                  <MenuItem value="maplibre">MapLibre (satellite)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
          {group.title === 'Wind' && (
            <Box sx={{ pt: 0.5, width: '100%' }}>
              <FormControl fullWidth size="small">
                <InputLabel id="wind-aloft-label">Winds aloft source</InputLabel>
                <Select
                  labelId="wind-aloft-label"
                  value={settings.windAloftSource}
                  label="Winds aloft source"
                  onChange={(e: SelectChangeEvent) =>
                    setSettings({ ...settings, windAloftSource: e.target.value as 'forecast' | 'sounding' })
                  }
                >
                  <MenuItem value="forecast">Model forecast (OpenMeteo)</MenuItem>
                  <MenuItem value="sounding">Radiosonde sounding</MenuItem>
                </Select>
              </FormControl>
              {settings.windAloftSource === 'forecast' && (
                <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
                  <InputLabel id="wind-model-label">Forecast model</InputLabel>
                  <Select
                    labelId="wind-model-label"
                    value={settings.windModel}
                    label="Forecast model"
                    onChange={(e: SelectChangeEvent) =>
                      setSettings({ ...settings, windModel: e.target.value })
                    }
                  >
                    {OPEN_METEO_MODELS.map(m => (
                      <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
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

      <FormControl fullWidth size="small">
        <InputLabel id="temperature-unit-label">Temperature</InputLabel>
        <Select
          labelId="temperature-unit-label"
          value={settings.units.temperature ?? 'c'}
          label="Temperature"
          onChange={(e: SelectChangeEvent) =>
            handleUnitChange('temperature', e.target.value as TemperatureUnit)
          }
        >
          {TEMPERATURE_UNIT_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel id="pressure-unit-label">Pressure</InputLabel>
        <Select
          labelId="pressure-unit-label"
          value={settings.units.pressure ?? 'hpa'}
          label="Pressure"
          onChange={(e: SelectChangeEvent) =>
            handleUnitChange('pressure', e.target.value as PressureUnit)
          }
        >
          {PRESSURE_UNIT_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel id="distance-unit-label">Distance</InputLabel>
        <Select
          labelId="distance-unit-label"
          value={settings.units.distance ?? 'mi'}
          label="Distance"
          onChange={(e: SelectChangeEvent) =>
            handleUnitChange('distance', e.target.value as DistanceUnit)
          }
        >
          {DISTANCE_UNIT_OPTIONS.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
