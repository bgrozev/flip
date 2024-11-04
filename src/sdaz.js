import { XMLParser } from 'fast-xml-parser';

import { WindRow } from './wind.js';

const ktsToMph = 1.151;
const mphToKts = 1 / ktsToMph;

export function fetchSdazGroundWind() {
    console.log('Fetching ground wind for SDAZ');

    // See http://axis.tools/tool_Cond.php
    const url = 'https://mustelinae.net/sdaz-ground-wind';

    return new Promise((resolve, reject) => {
        fetch(url)
            .then(d => d.text())
            .then(text => {
                const parser = new XMLParser();
                const xml = parser.parse(text);

                if (xml.Ground.Dir === '<b>variable</b>') {
                    console.log(`Ground wind variable, assuming no grond wind (speed ${xml.Ground.Spd_mi})`);
                    resolve(new WindRow(0, 0, 0));
                } else {
                    const speedMph = Number(xml.Ground.Spd_mi.replace('<b>', '').replace('</b> mph', ''));
                    const direction = Number(xml.Ground.Dir.replace('<b>', '').replace('</b>&deg;', ''));

                    if (!isNaN(speedMph) && !isNaN(direction)) {
                        resolve(new WindRow(0, direction, speedMph * mphToKts));
                    } else {
                        reject(new Error('Failed to parse SDAZ ground winds'));
                    }
                }
            });
    });
}

