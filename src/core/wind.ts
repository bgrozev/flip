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

/** A selectable forecast model. */
export interface WindModelOption {
  id: string;
  label: string;
}

/**
 * OpenMeteo forecast models verified to return wind at the pressure levels
 * FliP uses (2026-07): best_match and GFS cover all 17 levels (1000–600hPa);
 * ICON covers 9; ECMWF IFS only 5 (1000/925/850/700/600) and no 80 m wind —
 * usable but coarse.
 */
export const OPEN_METEO_MODELS: readonly WindModelOption[] = [
  { id: 'best_match', label: 'Best match' },
  { id: 'gfs_seamless', label: 'GFS' },
  { id: 'icon_seamless', label: 'ICON' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS' }
];

export const DEFAULT_WIND_MODEL = 'best_match';

/** Label for a model id (falls back to the id itself). */
export function windModelLabel(modelId: string): string {
  return OPEN_METEO_MODELS.find(m => m.id === modelId)?.label ?? modelId;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * A single wind measurement: altitude, direction (from, degrees), speed,
 * plus optional per-row provenance (which source produced it and when it
 * is valid) so the UI can badge observed vs forecast vs manual rows.
 */
export interface WindRow extends IWindRow {
  /** Air temperature at this altitude, when the source provides it. */
  tempC?: number;
  /** Relative humidity (%) at this altitude, when the source provides it. */
  humidityPct?: number;
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
  /** Ground-level temperature (°C), when the source provides it (2m forecast or observed station). */
  groundTempC?: number;
  /** Ground-level relative humidity (%), when the source provides it. */
  groundHumidityPct?: number;
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
 * Per-row provenance classes, derived from `WindRow.source`: the known
 * source constants map to themselves, anything else is assumed to be an
 * observed-station id, and a missing source means the row was entered or
 * edited by hand (manual edits create rows without provenance).
 */
export type WindRowSourceKind = 'manual' | 'open-meteo' | 'sounding' | 'station';

/** Classify a wind row's provenance from its `source` field. */
export function windRowSourceKind(source?: string): WindRowSourceKind {
  if (!source || source === SOURCE_MANUAL) {
    return 'manual';
  } else if (source === SOURCE_OPEN_METEO) {
    return 'open-meteo';
  } else if (source === SOURCE_SOUNDING) {
    return 'sounding';
  }

  return 'station';
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
  extra?: Pick<WindRow, 'tempC' | 'humidityPct' | 'source' | 'validTime'>
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
 * Ground-level temperature/humidity for display (e.g. density altitude):
 * prefers profile-level metadata (an observed station or the 2m forecast),
 * falling back to the ground row's own per-row values (soundings carry
 * temperature/humidity per level, not in profile metadata).
 */
export function groundConditions(profile: WindProfile): {
  tempC?: number;
  humidityPct?: number;
  elevationFt?: number;
} {
  const groundRow = profile.winds[0];

  return {
    tempC: profile.meta?.groundTempC ?? groundRow?.tempC,
    humidityPct: profile.meta?.groundHumidityPct ?? groundRow?.humidityPct,
    elevationFt: profile.meta?.elevationFt
  };
}

/**
 * Evenly-spaced altitude bands from a base step up to (and including)
 * `maxFt`, used by the compact winds indicator. The step is chosen from a
 * round set so the band count stays around six to eight regardless of the
 * ceiling: 3000 ft -> every 500, 12000 ft -> every 2000. Ground (0) is not
 * included — the indicator adds it from the profile's own ground row.
 */
export function windBandAltitudesFt(maxFt: number): number[] {
  if (!Number.isFinite(maxFt) || maxFt <= 0) {
    return [];
  }

  const TARGET_BANDS = 8;
  const STEPS = [500, 1000, 2000, 3000, 5000];
  const step =
    STEPS.find(s => maxFt / s <= TARGET_BANDS) ??
    Math.ceil(maxFt / TARGET_BANDS / 1000) * 1000;

  const out: number[] = [];
  for (let a = step; a < maxFt - 1; a += step) {
    out.push(a);
  }
  out.push(Math.round(maxFt));
  return out;
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
