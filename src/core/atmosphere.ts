/**
 * Density altitude (DA): pressure altitude corrected for non-standard
 * temperature and humidity — the altitude at which the local air density
 * would be found in the standard atmosphere. FliP has no direct
 * station-pressure reading, so pressure is estimated from elevation via the
 * ISA standard atmosphere (equivalent to assuming a standard 29.92 inHg
 * altimeter setting); real-world pressure deviations of a few hPa shift the
 * result by well under 100 ft, which is fine for this use.
 *
 * Method: compute actual air density from the estimated station pressure
 * plus virtual temperature (which folds humidity in — moist air is less
 * dense than dry air at the same pressure/temperature, because water vapor
 * molecules are lighter than the N2/O2 they displace), then invert the ISA
 * density-vs-altitude relation to find the altitude with that density.
 */

const T0_K = 288.15; // ISA sea-level temperature
const P0_PA = 101325; // ISA sea-level pressure
const LAPSE_RATE = 0.0065; // K/m, ISA troposphere
const GAS_CONST = 8.31432; // J/(mol*K)
const MOLAR_MASS_AIR = 0.028964; // kg/mol, dry air
const GRAVITY = 9.80665; // m/s^2
const RD = 287.058; // J/(kg*K), specific gas constant, dry air
const FEET_PER_METER = 3.28084;

// Exponents of the ISA pressure/altitude relation, derived from the
// constants above (evaluate to ~5.2559 and ~0.235 respectively).
const PRESSURE_EXPONENT = (GRAVITY * MOLAR_MASS_AIR) / (GAS_CONST * LAPSE_RATE);
const ALTITUDE_EXPONENT =
  (LAPSE_RATE * GAS_CONST) / (GRAVITY * MOLAR_MASS_AIR - LAPSE_RATE * GAS_CONST);

// 1 - Rd/Rv (ratio of dry-air to water-vapor specific gas constants), used
// by the virtual-temperature formula.
const VIRTUAL_TEMP_FACTOR = 0.378;

/** ISA standard-atmosphere pressure (Pa) at a given elevation (ft). */
export function standardPressurePa(elevationFt: number): number {
  const elevationM = elevationFt / FEET_PER_METER;

  return P0_PA * Math.pow(1 - (LAPSE_RATE * elevationM) / T0_K, PRESSURE_EXPONENT);
}

/** Saturation vapor pressure (Pa) at a given temperature (°C), Buck (1996). */
export function saturationVaporPressurePa(tempC: number): number {
  const hPa = 6.1121 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));

  return hPa * 100;
}

/**
 * Relative humidity (%) from temperature and dewpoint (both °C), derived
 * from the ratio of actual to saturation vapor pressure.
 */
export function relativeHumidityPct(tempC: number, dewpointC: number): number {
  const pct = (saturationVaporPressurePa(dewpointC) / saturationVaporPressurePa(tempC)) * 100;

  return Math.min(100, Math.max(0, pct));
}

/**
 * Density altitude (ft) from field elevation, temperature and relative
 * humidity. Station pressure is estimated from elevation (see module doc).
 */
export function densityAltitudeFt(elevationFt: number, tempC: number, humidityPct: number): number {
  const pressurePa = standardPressurePa(elevationFt);
  const vaporPressurePa = (humidityPct / 100) * saturationVaporPressurePa(tempC);
  const tempK = tempC + 273.15;
  const virtualTempK = tempK / (1 - (vaporPressurePa / pressurePa) * VIRTUAL_TEMP_FACTOR);
  const airDensity = pressurePa / (RD * virtualTempK);

  const ratio = (GAS_CONST * T0_K * airDensity) / (MOLAR_MASS_AIR * P0_PA);
  const heightM = (T0_K / LAPSE_RATE) * (1 - Math.pow(ratio, ALTITUDE_EXPONENT));

  return heightM * FEET_PER_METER;
}

/** Density altitude, or undefined when temperature/humidity aren't known. */
export function tryDensityAltitudeFt(
  elevationFt: number | undefined,
  tempC: number | undefined,
  humidityPct: number | undefined
): number | undefined {
  if (
    typeof elevationFt !== 'number' || typeof tempC !== 'number' || typeof humidityPct !== 'number' ||
    !Number.isFinite(elevationFt) || !Number.isFinite(tempC) || !Number.isFinite(humidityPct)
  ) {
    return undefined;
  }

  return densityAltitudeFt(elevationFt, tempC, humidityPct);
}

/**
 * Thresholds for flagging density altitude meaningfully above field
 * elevation (degraded canopy/aircraft performance). Suggested defaults;
 * adjust freely.
 */
export const DA_CAUTION_FT = 1000;
export const DA_WARNING_FT = 3000;

export type DaSeverity = 'normal' | 'caution' | 'warning';

/** Classify how far DA sits above field elevation. */
export function daSeverity(densityAltFt: number | undefined, elevationFt: number | undefined): DaSeverity {
  if (typeof densityAltFt !== 'number' || typeof elevationFt !== 'number') {
    return 'normal';
  }

  const delta = densityAltFt - elevationFt;

  if (delta >= DA_WARNING_FT) return 'warning';
  if (delta >= DA_CAUTION_FT) return 'caution';

  return 'normal';
}

/**
 * Thresholds for flagging air temperature (°C, owner's values):
 *  - at/below 5°C (41°F): cold — gear and personal-cold concerns.
 *  - at/above 28°C (82°F): hot.
 *  - at/above 35°C (95°F): very hot.
 */
export const TEMP_COLD_C = 5;
export const TEMP_HOT_C = 28;
export const TEMP_VERY_HOT_C = 35;

export type TempSeverity = 'cold' | 'normal' | 'hot' | 'veryHot';

/** Classify an air temperature (°C) into a display severity. */
export function temperatureSeverity(tempC: number | undefined): TempSeverity {
  if (typeof tempC !== 'number') {
    return 'normal';
  }

  if (tempC <= TEMP_COLD_C) return 'cold';
  if (tempC >= TEMP_VERY_HOT_C) return 'veryHot';
  if (tempC >= TEMP_HOT_C) return 'hot';

  return 'normal';
}
