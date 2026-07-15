import { IWindRow, LatLng } from '../types';

// Wind source identifiers (per-profile metadata)
export const SOURCE_MANUAL = 'manual';
export const SOURCE_DZ = 'dropzone-specific';
export const SOURCE_OPEN_METEO = 'open-meteo';
export const SOURCE_SOUNDING = 'sounding';

export type ForecastSource =
  | typeof SOURCE_MANUAL
  | typeof SOURCE_DZ
  | typeof SOURCE_OPEN_METEO
  | typeof SOURCE_SOUNDING;

const DEG_TO_RAD = Math.PI / 180;

/**
 * A single wind measurement: altitude, direction (from, degrees), speed,
 * plus optional per-row provenance (which source produced it and when it
 * is valid) so the UI can badge observed vs forecast vs manual rows.
 */
export interface WindRow extends IWindRow {
  /** Air temperature at this altitude, when the source provides it. */
  tempC?: number;
  /** Row provenance, e.g. 'open-meteo', 'sounding', a station id, 'manual'. */
  source?: string;
  /** When this row is valid (forecast hour or observation/launch time). */
  validTime?: Date;
}

/** Profile-level metadata about where/how the winds were obtained. */
export interface WindProfileMeta {
  /** Forecast model id (e.g. 'best_match', 'gfs_seamless'). */
  model?: string;
  fetchedAt?: Date;
  /** Location the data was fetched for. */
  location?: LatLng;
  /** Ground elevation used to convert MSL heights to AGL. */
  elevationFt?: number;
  /** Sounding station id (e.g. 'KTBW'). */
  station?: string;
  stationName?: string;
  /** Distance from the fetch location to the station. */
  stationDistanceFt?: number;
}

/**
 * A wind profile: rows ordered by altitude plus source metadata.
 * Plain serializable data — use the pure functions below to work with it.
 */
export interface WindProfile {
  winds: WindRow[];
  center?: LatLng;
  groundSource: ForecastSource;
  aloftSource: ForecastSource;
  validTime?: Date;
  meta?: WindProfileMeta;
}

/** Human-readable label for a profile-level wind source. */
export function forecastSourceLabel(source: ForecastSource): string {
  if (source === SOURCE_MANUAL) {
    return 'set manually';
  } else if (source === SOURCE_DZ) {
    return 'observed conditions';
  } else if (source === SOURCE_OPEN_METEO) {
    return 'OpenMeteo';
  } else if (source === SOURCE_SOUNDING) {
    return 'sounding';
  }

  return 'invalid';
}

/**
 * Beaufort-scale fill color for a wind speed in knots.
 * Used for wind arrows on the map (and, later, wind table rows).
 */
export function beaufortColor(kts: number): string {
  if (kts < 1) return '#cccccc';
  if (kts < 4) return '#aaddff';
  if (kts < 7) return '#00cc88';
  if (kts < 11) return '#44cc44';
  if (kts < 17) return '#ffdd00';
  if (kts < 22) return '#ff9900';
  if (kts < 28) return '#ff4400';
  if (kts < 34) return '#cc0000';

  return '#880000';
}

/** Create a wind row, coercing string inputs (e.g. from forms) to numbers. */
export function createWindRow(
  altFt: number,
  direction: number,
  speedKts: number,
  extra?: Pick<WindRow, 'tempC' | 'source' | 'validTime'>
): WindRow {
  return {
    ...extra,
    altFt: Number(altFt),
    direction: Number(direction),
    speedKts: Number(speedKts)
  };
}

/** Copy a wind row. */
export function copyWindRow(row: WindRow): WindRow {
  return { ...row };
}

/** Create a wind profile with manual sources; defaults to a single empty row. */
export function createWindProfile(
  winds: WindRow[] = [createWindRow(0, 0, 0)],
  center?: LatLng
): WindProfile {
  return {
    winds,
    center,
    groundSource: SOURCE_MANUAL,
    aloftSource: SOURCE_MANUAL
  };
}

/** Deep-copy a wind profile. */
export function copyProfile(profile: WindProfile): WindProfile {
  return {
    ...profile,
    winds: profile.winds.map(copyWindRow)
  };
}

/** Replace (or add) the ground wind row. Returns a new profile. */
export function setGroundWind(profile: WindProfile, row: WindRow): WindProfile {
  return {
    ...profile,
    winds: profile.winds.length > 0
      ? [row, ...profile.winds.slice(1)]
      : [row]
  };
}

/**
 * Compose the effective wind profile from a forecast/manual profile and an
 * observed ground wind row: the observed row replaces the ground row and is
 * marked as dropzone-observed. Replaces the old clone-and-patch surgery.
 */
export function composeWinds(profile: WindProfile, observedGround: WindRow): WindProfile {
  return {
    ...setGroundWind(profile, observedGround),
    groundSource: SOURCE_DZ
  };
}

/**
 * Interpolate between two wind rows by blending the wind VECTOR (u/v
 * components) instead of direction/speed independently. This makes
 * direction changes take the shortest arc across north (350°→10° passes
 * through 0°, not 180°) and lets opposing winds partially cancel — the
 * interpolated speed between two opposing rows is lower than either,
 * which is physically correct.
 */
export function interpolateWindRows(
  lower: WindRow,
  higher: WindRow,
  p: number,
  altFt: number
): WindRow {
  const u1 = -lower.speedKts * Math.sin(lower.direction * DEG_TO_RAD);
  const v1 = -lower.speedKts * Math.cos(lower.direction * DEG_TO_RAD);
  const u2 = -higher.speedKts * Math.sin(higher.direction * DEG_TO_RAD);
  const v2 = -higher.speedKts * Math.cos(higher.direction * DEG_TO_RAD);
  const u = u1 + p * (u2 - u1);
  const v = v1 + p * (v2 - v1);
  const speedKts = Math.hypot(u, v);
  // At (near-)zero speed the direction is meaningless; keep the lower row's
  const direction = speedKts > 1e-9
    ? (Math.atan2(-u, -v) / DEG_TO_RAD + 360) % 360
    : lower.direction;

  return createWindRow(altFt, direction, speedKts);
}

/**
 * Get the wind at an altitude: the row at or below altFt, optionally
 * interpolated toward the next row up.
 */
export function getWindAt(profile: WindProfile, altFt: number, interpolate?: boolean): WindRow {
  const rows = profile.winds;

  if (!rows.length) {
    return createWindRow(0, 0, 0);
  }

  let higher: WindRow | undefined;
  let lower: WindRow | undefined;

  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].altFt <= altFt) {
      lower = rows[i];
      if (rows.length > i + 1) {
        higher = rows[i + 1];
      }
      break;
    }
  }

  if (interpolate && lower && higher) {
    const p = (altFt - lower.altFt) / (higher.altFt - lower.altFt);

    return interpolateWindRows(lower, higher, p, altFt);
  }

  return lower || rows[0];
}

/**
 * Sanitize a profile for wind application: drop rows whose altitude is out
 * of order (e.g. user entered altitudes 0, 1000, 500) or empty rows in the
 * middle.
 */
export function prepWind(profile: WindProfile): WindProfile {
  const rows: WindRow[] = [];
  let prevAlt = -1;

  profile.winds.forEach(row => {
    if (row.altFt > prevAlt) {
      rows.push(copyWindRow(row));
      prevAlt = row.altFt;
    }
  });

  return { ...profile, winds: rows };
}
