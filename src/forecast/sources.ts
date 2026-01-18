export const SOURCE_MANUAL = 'manual';
export const SOURCE_WINDS_ALOFT = 'winds-aloft';
export const SOURCE_DZ = 'dropzone-specific';
export const SOURCE_OPEN_METEO = 'open-meteo';

export type ForecastSource =
  | typeof SOURCE_MANUAL
  | typeof SOURCE_WINDS_ALOFT
  | typeof SOURCE_DZ
  | typeof SOURCE_OPEN_METEO;

export function forecastSourceLabel(source: ForecastSource): string {
  if (source === SOURCE_MANUAL) {
    return 'set manually';
  } else if (source === SOURCE_DZ) {
    return 'observed conditions';
  } else if (source === SOURCE_WINDS_ALOFT) {
    return 'WindsAloft';
  } else if (source === SOURCE_OPEN_METEO) {
    return 'OpenMeteo GFS';
  }

  return 'invalid';
}
