import { LatLng } from '../types';
import { WindRow, Winds } from '../util/wind';
import { SOURCE_WINDS_ALOFT } from './sources';

interface WindsAloftResponse {
  altFtRaw: number[];
  directionRaw: Record<string, number>;
  speedRaw: Record<string, number>;
}

export function fetchWindsAloft(point: LatLng, hourOffset: number): Promise<Winds> {
  return window
    .fetch(
      `https://mustelinae.net/winds-aloft?lat=${point.lat}&lon=${point.lng}&hourOffset=${hourOffset}&referrer=https://mustelinae.net/flip`
    )
    .then(d => d.json())
    .then((j: WindsAloftResponse) => {
      const wa = new Winds([]);

      console.log('Fetched WindsAloft');
      wa.center = point;

      for (let i = 0; i < 10; i++) {
        const elevFt = j.altFtRaw[i];
        const row = new WindRow(
          elevFt - j.altFtRaw[0], // Assume the first one is at ground level.
          j.directionRaw[elevFt.toString()],
          j.speedRaw[elevFt.toString()]
        );

        wa.addRow(row);
      }

      wa.aloftSource = SOURCE_WINDS_ALOFT;
      wa.groundSource = SOURCE_WINDS_ALOFT;

      return wa;
    });
}
