// Unit types
export type AltitudeUnit = 'ft' | 'm';
export type WindSpeedUnit = 'kts' | 'mps' | 'mph';
export type DescentRateUnit = 'mph' | 'kph' | 'mps';
export type TemperatureUnit = 'c' | 'f';
export type PressureUnit = 'hpa' | 'pa' | 'mmhg' | 'inhg';

export interface UnitPreferences {
  altitude: AltitudeUnit;
  windSpeed: WindSpeedUnit;
  descentRate: DescentRateUnit;
  temperature: TemperatureUnit;
  pressure: PressureUnit;
}

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  altitude: 'ft',
  windSpeed: 'kts',
  descentRate: 'mph',
  temperature: 'c',
  pressure: 'hpa'
};

// Display labels
export const UNIT_LABELS: Record<AltitudeUnit | WindSpeedUnit | DescentRateUnit | TemperatureUnit | PressureUnit, string> = {
  ft: 'ft',
  m: 'm',
  kts: 'kts',
  mps: 'm/s',
  mph: 'mph',
  kph: 'km/h',
  c: '°C',
  f: '°F',
  hpa: 'hPa',
  pa: 'Pa',
  mmhg: 'mmHg',
  inhg: 'inHg'
};

// Unit options for UI dropdowns
export const ALTITUDE_UNIT_OPTIONS: { value: AltitudeUnit; label: string }[] = [
  { value: 'ft', label: 'Feet (ft)' },
  { value: 'm', label: 'Meters (m)' }
];

export const WIND_SPEED_UNIT_OPTIONS: { value: WindSpeedUnit; label: string }[] = [
  { value: 'kts', label: 'Knots (kts)' },
  { value: 'mps', label: 'Meters per second (m/s)' },
  { value: 'mph', label: 'Miles per hour (mph)' }
];

export const DESCENT_RATE_UNIT_OPTIONS: { value: DescentRateUnit; label: string }[] = [
  { value: 'mph', label: 'Miles per hour (mph)' },
  { value: 'kph', label: 'Kilometers per hour (km/h)' },
  { value: 'mps', label: 'Meters per second (m/s)' }
];

export const TEMPERATURE_UNIT_OPTIONS: { value: TemperatureUnit; label: string }[] = [
  { value: 'c', label: 'Celsius (°C)' },
  { value: 'f', label: 'Fahrenheit (°F)' }
];

export const PRESSURE_UNIT_OPTIONS: { value: PressureUnit; label: string }[] = [
  { value: 'hpa', label: 'Hectopascals / millibars (hPa)' },
  { value: 'inhg', label: 'Inches of mercury (inHg)' },
  { value: 'mmhg', label: 'Millimeters of mercury (mmHg)' },
  { value: 'pa', label: 'Pascals (Pa)' }
];

// Conversion constants
const FEET_PER_METER = 3.28084;
const KNOTS_TO_MPS = 0.514444;
const KNOTS_TO_MPH = 1.15078;
const MPH_TO_KPH = 1.60934;
const MPH_TO_MPS = 0.44704;
const HPA_TO_INHG = 0.02953;
const HPA_TO_MMHG = 0.750062;
const HPA_TO_PA = 100;

// Altitude conversions (internal: feet)
export function altitudeToDisplay(feet: number, unit: AltitudeUnit): number {
  switch (unit) {
    case 'ft':
      return feet;
    case 'm':
      return feet / FEET_PER_METER;
  }
}

export function altitudeFromDisplay(value: number, unit: AltitudeUnit): number {
  switch (unit) {
    case 'ft':
      return value;
    case 'm':
      return value * FEET_PER_METER;
  }
}

// Wind speed conversions (internal: knots)
export function windSpeedToDisplay(kts: number, unit: WindSpeedUnit): number {
  switch (unit) {
    case 'kts':
      return kts;
    case 'mps':
      return kts * KNOTS_TO_MPS;
    case 'mph':
      return kts * KNOTS_TO_MPH;
  }
}

export function windSpeedFromDisplay(value: number, unit: WindSpeedUnit): number {
  switch (unit) {
    case 'kts':
      return value;
    case 'mps':
      return value / KNOTS_TO_MPS;
    case 'mph':
      return value / KNOTS_TO_MPH;
  }
}

// Descent rate conversions (internal: mph)
export function descentRateToDisplay(mph: number, unit: DescentRateUnit): number {
  switch (unit) {
    case 'mph':
      return mph;
    case 'kph':
      return mph * MPH_TO_KPH;
    case 'mps':
      return mph * MPH_TO_MPS;
  }
}

export function descentRateFromDisplay(value: number, unit: DescentRateUnit): number {
  switch (unit) {
    case 'mph':
      return value;
    case 'kph':
      return value / MPH_TO_KPH;
    case 'mps':
      return value / MPH_TO_MPS;
  }
}

// Temperature conversions (internal: Celsius)
export function temperatureToDisplay(celsius: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'c':
      return celsius;
    case 'f':
      return celsius * 9 / 5 + 32;
  }
}

// Pressure conversions (internal: hPa)
export function pressureToDisplay(hpa: number, unit: PressureUnit): number {
  switch (unit) {
    case 'hpa':
      return hpa;
    case 'pa':
      return hpa * HPA_TO_PA;
    case 'mmhg':
      return hpa * HPA_TO_MMHG;
    case 'inhg':
      return hpa * HPA_TO_INHG;
  }
}

export function pressureDecimals(unit: PressureUnit): number {
  switch (unit) {
    case 'hpa': return 0;
    case 'pa': return 0;
    case 'mmhg': return 1;
    case 'inhg': return 2;
  }
}
