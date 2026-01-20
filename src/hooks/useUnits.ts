import { useCallback, useMemo } from 'react';

import {
  altitudeFromDisplay,
  altitudeToDisplay,
  descentRateFromDisplay,
  descentRateToDisplay,
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
  parseAltitude: (displayValue: number) => number;  // returns feet
  parseWindSpeed: (displayValue: number) => number; // returns knots
  parseDescentRate: (displayValue: number) => number; // returns mph
  altitudeLabel: string;
  windSpeedLabel: string;
  descentRateLabel: string;
}

export function useUnits(): UseUnitsReturn {
  const { settings } = useAppState();
  const units = settings.units;

  const altitudeLabel = useMemo(() => UNIT_LABELS[units.altitude], [units.altitude]);
  const windSpeedLabel = useMemo(() => UNIT_LABELS[units.windSpeed], [units.windSpeed]);
  const descentRateLabel = useMemo(() => UNIT_LABELS[units.descentRate], [units.descentRate]);

  const formatAltitude = useCallback(
    (feet: number, decimals = 0): FormattedValue => {
      const value = altitudeToDisplay(feet, units.altitude);
      return {
        value: Number(value.toFixed(decimals)),
        label: altitudeLabel
      };
    },
    [units.altitude, altitudeLabel]
  );

  const formatWindSpeed = useCallback(
    (kts: number, decimals = 1): FormattedValue => {
      const value = windSpeedToDisplay(kts, units.windSpeed);
      return {
        value: Number(value.toFixed(decimals)),
        label: windSpeedLabel
      };
    },
    [units.windSpeed, windSpeedLabel]
  );

  const formatDescentRate = useCallback(
    (mph: number, decimals = 1): FormattedValue => {
      const value = descentRateToDisplay(mph, units.descentRate);
      return {
        value: Number(value.toFixed(decimals)),
        label: descentRateLabel
      };
    },
    [units.descentRate, descentRateLabel]
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
    parseAltitude,
    parseWindSpeed,
    parseDescentRate,
    altitudeLabel,
    windSpeedLabel,
    descentRateLabel
  };
}
