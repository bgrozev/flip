import { IWindRow, LatLng } from '../types';
import { ForecastSource, SOURCE_MANUAL } from '../forecast/sources';

const DEG_TO_RAD = Math.PI / 180;

export class WindRow implements IWindRow {
  altFt: number;
  direction: number;
  speedKts: number;

  constructor(altFt: number, direction: number, speedKts: number) {
    this.altFt = Number(altFt);
    this.direction = Number(direction);
    this.speedKts = Number(speedKts);

    this.copy = this.copy.bind(this);
  }

  copy(): WindRow {
    return new WindRow(this.altFt, this.direction, this.speedKts);
  }
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
  lower: IWindRow,
  higher: IWindRow,
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

  return new WindRow(altFt, direction, speedKts);
}

export interface IWinds {
  winds: WindRow[];
  center?: LatLng;
  groundSource: ForecastSource;
  aloftSource: ForecastSource;
  validTime?: Date;
  addRow(wind: WindRow): void;
  setGroundWind(windRow: WindRow): void;
  getWindAt(altFt: number, interpolate?: boolean): WindRow;
}

export class Winds implements IWinds {
  winds: WindRow[];
  center?: LatLng;
  groundSource: ForecastSource;
  aloftSource: ForecastSource;
  validTime?: Date;

  constructor(winds: WindRow[] = [new WindRow(0, 0, 0)], center?: LatLng) {
    this.winds = winds;
    this.center = center;
    this.groundSource = SOURCE_MANUAL;
    this.aloftSource = SOURCE_MANUAL;

    this.addRow = this.addRow.bind(this);
    this.getWindAt = this.getWindAt.bind(this);
    this.setGroundWind = this.setGroundWind.bind(this);
  }

  /** Create a new Winds instance with default empty wind row */
  static createDefault(): Winds {
    return new Winds([new WindRow(0, 0, 0)]);
  }

  /** Create a copy of an existing Winds instance */
  static copy(other: Winds): Winds {
    const winds = new Winds(other.winds.map(w => w.copy()), other.center);
    winds.groundSource = other.groundSource;
    winds.aloftSource = other.aloftSource;
    winds.validTime = other.validTime;
    return winds;
  }

  addRow(wind: WindRow): void {
    this.winds.push(wind);
  }

  setGroundWind(windRow: WindRow): void {
    if (this.winds.length > 0) {
      this.winds[0] = windRow;
    } else {
      this.winds.push(windRow);
    }
  }

  getWindAt(altFt: number, interpolate?: boolean): WindRow {
    if (!this.winds.length) {
      return new WindRow(0, 0, 0);
    }

    let higher: WindRow | undefined;
    let lower: WindRow | undefined;

    for (let i = this.winds.length - 1; i >= 0; i--) {
      if (this.winds[i].altFt <= altFt) {
        lower = this.winds[i];
        if (this.winds.length > i + 1) {
          higher = this.winds[i + 1];
        }
        break;
      }
    }

    if (interpolate && lower && higher) {
      const p = (altFt - lower.altFt) / (higher.altFt - lower.altFt);

      return interpolateWindRows(lower, higher, p, altFt);
    }

    return lower || this.winds[0];
  }
}
