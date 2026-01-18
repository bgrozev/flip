import { XMLParser } from 'fast-xml-parser';
import { WindRow } from '../util/wind';

const mphToKts = 1 / 1.151;

interface SdazXml {
  Ground: {
    Dir: string;
    Spd_mi: string;
  };
}

export function fetchSdazGroundWind(): Promise<WindRow> {
  console.log('Fetching ground wind for SDAZ');

  // See http://axis.tools/tool_Cond.php
  const url = 'https://mustelinae.net/sdaz-ground-wind';

  return new Promise((resolve, reject) => {
    fetch(url)
      .then(d => d.text())
      .then(text => {
        const parser = new XMLParser();
        const xml: SdazXml = parser.parse(text);

        if (xml.Ground.Dir === '<b>variable</b>') {
          console.log(
            `Ground wind variable, assuming no ground wind (speed ${xml.Ground.Spd_mi})`
          );
          resolve(new WindRow(0, 0, 0));
        } else {
          const speedMph = Number(
            xml?.Ground?.Spd_mi?.replace('<b>', '')?.replace('</b> mph', '')
          );
          const direction = Number(
            xml?.Ground?.Dir?.replace('<b>', '')?.replace('</b>&deg;', '')
          );

          if (!isNaN(speedMph) && !isNaN(direction)) {
            resolve(new WindRow(0, direction, speedMph * mphToKts));
          } else {
            reject(new Error('Failed to parse SDAZ ground winds'));
          }
        }
      });
  });
}
