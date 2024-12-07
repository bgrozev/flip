import { SOURCE_MANUAL } from './forecast/forecast.js';

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

export class Winds {
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
