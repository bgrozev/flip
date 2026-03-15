import { useCallback, useMemo } from 'react';

import {
  altitudeFromDisplay,
  altitudeToDisplay,
  descentRateFromDisplay,
  descentRateToDisplay,
  pressureDecimals,
  pressureToDisplay,
  temperatureToDisplay,
  UnitPreferences,
  UNIT_LABELS,
  windSpeedFromDisplay,
  windSpeedToDisplay
} from '../util/units';

import { useAppState } from './useAppState';

export interface FormattedValue {
  value: number;
  label: string;
}

export interface UseUnitsReturn {
  units: UnitPreferences;
  formatAltitude: (feet: number, decimals?: number) => FormattedValue;
  formatWindSpeed: (kts: number, decimals?: number) => FormattedValue;
  formatDescentRate: (mph: number, decimals?: number) => FormattedValue;
  formatTemperature: (celsius: number) => FormattedValue;
  formatPressure: (hpa: number) => FormattedValue;
  parseAltitude: (displayValue: number) => number;  // returns feet
  parseWindSpeed: (displayValue: number) => number; // returns knots
  parseDescentRate: (displayValue: number) => number; // returns mph
  altitudeLabel: string;
  windSpeedLabel: string;
  descentRateLabel: string;
  temperatureLabel: string;
  pressureLabel: string;
}

export function useUnits(): UseUnitsReturn {
  const { settings } = useAppState();
  const units = settings.units;

  const altitudeLabel = useMemo(() => UNIT_LABELS[units.altitude], [units.altitude]);
  const windSpeedLabel = useMemo(() => UNIT_LABELS[units.windSpeed], [units.windSpeed]);
  const descentRateLabel = useMemo(() => UNIT_LABELS[units.descentRate], [units.descentRate]);
  const temperatureLabel = useMemo(() => UNIT_LABELS[units.temperature ?? 'c'], [units.temperature]);
  const pressureLabel = useMemo(() => UNIT_LABELS[units.pressure ?? 'hpa'], [units.pressure]);

  const formatAltitude = useCallback(
    (feet: number, decimals = 0): FormattedValue => {
      const value = altitudeToDisplay(feet, units.altitude);
      return { value: Number(value.toFixed(decimals)), label: altitudeLabel };
    },
    [units.altitude, altitudeLabel]
  );

  const formatWindSpeed = useCallback(
    (kts: number, decimals = 1): FormattedValue => {
      const value = windSpeedToDisplay(kts, units.windSpeed);
      return { value: Number(value.toFixed(decimals)), label: windSpeedLabel };
    },
    [units.windSpeed, windSpeedLabel]
  );

  const formatDescentRate = useCallback(
    (mph: number, decimals = 1): FormattedValue => {
      const value = descentRateToDisplay(mph, units.descentRate);
      return { value: Number(value.toFixed(decimals)), label: descentRateLabel };
    },
    [units.descentRate, descentRateLabel]
  );

  const formatTemperature = useCallback(
    (celsius: number): FormattedValue => {
      const unit = units.temperature ?? 'c';
      const value = temperatureToDisplay(celsius, unit);
      return { value: Number(value.toFixed(1)), label: UNIT_LABELS[unit] };
    },
    [units.temperature]
  );

  const formatPressure = useCallback(
    (hpa: number): FormattedValue => {
      const unit = units.pressure ?? 'hpa';
      const value = pressureToDisplay(hpa, unit);
      const decimals = pressureDecimals(unit);
      return { value: Number(value.toFixed(decimals)), label: UNIT_LABELS[unit] };
    },
    [units.pressure]
  );

  const parseAltitude = useCallback(
    (displayValue: number): number => altitudeFromDisplay(displayValue, units.altitude),
    [units.altitude]
  );

  const parseWindSpeed = useCallback(
    (displayValue: number): number => windSpeedFromDisplay(displayValue, units.windSpeed),
    [units.windSpeed]
  );

  const parseDescentRate = useCallback(
    (displayValue: number): number => descentRateFromDisplay(displayValue, units.descentRate),
    [units.descentRate]
  );

  return {
    units,
    formatAltitude,
    formatWindSpeed,
    formatDescentRate,
    formatTemperature,
    formatPressure,
    parseAltitude,
    parseWindSpeed,
    parseDescentRate,
    altitudeLabel,
    windSpeedLabel,
    descentRateLabel,
    temperatureLabel,
    pressureLabel
  };
}
