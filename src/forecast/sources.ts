import {
  ForecastSource,
  SOURCE_DZ,
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO
} from '../core/wind';

// The source identifiers live in core/wind (per-profile metadata);
// re-exported here for the forecast layer's convenience.
export { SOURCE_MANUAL, SOURCE_DZ, SOURCE_OPEN_METEO };
export type { ForecastSource };

export function forecastSourceLabel(source: ForecastSource): string {
  if (source === SOURCE_MANUAL) {
    return 'set manually';
  } else if (source === SOURCE_DZ) {
    return 'observed conditions';
  } else if (source === SOURCE_OPEN_METEO) {
    return 'OpenMeteo GFS';
  }

  return 'invalid';
}
