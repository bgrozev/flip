export const SOURCE_MANUAL = 'manual';
export const SOURCE_WINDS_ALOFT = 'winds-aloft';
export const SOURCE_DZ = 'dropzone-specific';

export class WindRow {
    constructor(altFt, direction, speedKts) {
        this.altFt = Number(altFt);
        this.direction = Number(direction);
        this.speedKts = Number(speedKts);

        this.copy = this.copy.bind(this);
    }

    copy() {
        return new WindRow(this.altFt, this.direction, this.speedKts);
    }
}

export class WindsAloft {
    constructor(winds = [ new WindRow(0, 0, 0) ], center) {
        this.winds = winds;
        this.center = center;
        this.groundSource = SOURCE_MANUAL;
        this.aloftSource = SOURCE_MANUAL;

        this.addRow = this.addRow.bind(this);
        this.getWindAt = this.getWindAt.bind(this);
        this.setGroundWind = this.setGroundWind.bind(this);
    }

    addRow(wind) {
        this.winds.push(wind);
    }

    setGroundWind(windRow) {
        if (this.winds.length > 0) {
            this.winds[0] = windRow;
        } else {
            this.winds.push(windRow);
        }
    }

    getWindAt(altFt, interpolate) {
        if (!this.winds.length) {
            return new WindRow(0, 0, 0);
        }

        let higher, lower;

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
            const direction = lower.direction + (p * (higher.direction - lower.direction));
            const speedKts = lower.speedKts + (p * (higher.speedKts - lower.speedKts));

            return new WindRow(altFt, (direction + 360) % 360, speedKts);
        }

        return lower || this.winds[0];
    }
}

export function fetchWindsAloft(point, hourOffset) {
    /* eslint-disable-next-line max-len */
    return window.fetch(`https://mustelinae.net/winds-aloft?lat=${point.lat}&lon=${point.lng}&hourOffset=${hourOffset}&referrer=https://mustelinae.net/flip`)
        .then(d => d.json())
        .then(j => {
            const wa = new WindsAloft([]);

            console.log('Fetched WindsAloft');
            wa.center = point;

            // TODO: how many do we take? Cap at altitude? Cap at sample altitude?
            for (let i = 0; i < 10; i++) {
                const elevFt = j.altFtRaw[i];
                const row = new WindRow(elevFt, j.directionRaw[elevFt.toString()], j.speedRaw[elevFt.toString()]);

                wa.addRow(row);
            }

            wa.aloftSource = SOURCE_WINDS_ALOFT;
            wa.groundSource = SOURCE_WINDS_ALOFT;

            return wa;
        });
}
