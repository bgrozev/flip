import { SOURCE_WINDS_ALOFT, WindRow, Winds } from '../wind.js';

export function fetchWindsAloft(point, hourOffset) {
    /* eslint-disable-next-line max-len */
    return window.fetch(`https://mustelinae.net/winds-aloft?lat=${point.lat}&lon=${point.lng}&hourOffset=${hourOffset}&referrer=https://mustelinae.net/flip`)
        .then(d => d.json())
        .then(j => {
            const wa = new Winds([]);

            console.log('Fetched WindsAloft');
            wa.center = point;

            // TODO: how many do we take? Cap at altitude? Cap at sample altitude?
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
