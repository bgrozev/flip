import { WindRow } from './wind.js';

const url = 'wss://api.skydivecsc.com/graphql';
const protocol = 'graphql-ws';

export function fetchCscGroundWind() {
    // See https://wx.skydivecsc.com/

    console.log('Fetching ground wind for CSC');

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url, protocol);

        ws.onopen = () => {
            ws.send(JSON.stringify({ 'type': 'connection_init', 'payload': {} }));
            ws.send(JSON.stringify({
                'type': 'start',
                'id': 'wind',
                'payload': {
                    /* eslint-disable-next-line max-len */
                    'query': '\nsubscription {\n  wind: windReported {\n    receivedAt\n    speed\n    gustSpeed\n    direction\n    variableDirection\n  }\n}\n',
                    'variables': null
                }
            }));
        };

        ws.onmessage = ev => {
            try {
                const json = JSON.parse(ev.data);

                if (json && json.id === 'wind') {
                    console.log(`Fetched ${JSON.stringify(json)}`);
                    ws.close();
                    resolve(new WindRow(
                        0,

                        // The data has gusts. Should we take them into account somehow?
                        json.payload.data.wind.direction,
                        json.payload.data.wind.speed
                    ));
                }
            } catch (e) {
                reject(`Failed to fetch ground wind for CSC: ${e}`);
            }
        };

        ws.onerror = ev => {
            console.log(`WebSocket error ${ev.data}`);
            reject(new Error(`connect_error: ${JSON.stringify(ev)}`));
        };
    });
}

