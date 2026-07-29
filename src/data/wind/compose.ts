import { ObservedWindStation } from '../../types';
import { WindProfile, composeWinds, createWindRow } from '../../core/wind';

/**
 * Compose the effective profile from an aloft profile and an observed
 * station: the station's wind becomes the ground row, tagged with the
 * station id and observation time so the UI can attribute it.
 */
export function composeWithObservedGround(
  profile: WindProfile,
  station: ObservedWindStation
): WindProfile {
  const composed = composeWinds(
    profile,
    createWindRow(0, station.wind.direction, station.wind.speedKts, {
      source: station.id,
      validTime: station.observedAt
    })
  );

  // Station temp/humidity, when present, take priority over whatever the
  // aloft source's ground-level reading was (e.g. OpenMeteo's 2m forecast).
  if (station.temperatureC === undefined && station.humidityPct === undefined) {
    return composed;
  }

  return {
    ...composed,
    meta: {
      ...composed.meta,
      groundTempC: station.temperatureC ?? composed.meta?.groundTempC,
      groundHumidityPct: station.humidityPct ?? composed.meta?.groundHumidityPct
    }
  };
}
