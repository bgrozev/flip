import * as turf from '@turf/turf';
import { Dropzone } from '../types';

/**
 * Known dropzones.
 *
 * Two provenances, deliberately mixed in one alphabetical list:
 *
 * - Entries with a `direction` are FliP's own, hand-checked against
 *   satellite imagery: the coordinates are the landing area and the
 *   direction is the usual/primary landing heading.
 * - Entries without a `direction` were ported from the Flocking Wind
 *   Calculator (which took them from
 *   https://markschulze.net/winds/dropzones.geojson). Their coordinates are
 *   3-decimal (~100 m) and no landing heading is known, so selecting one
 *   moves the target but leaves the final heading alone.
 *
 * When a DZ gets verified coordinates + a heading, promote it by adding the
 * direction and tightening the coordinates.
 */
export const DROPZONES: Dropzone[] = [
  {
    name: 'Århus Faldskærm Club',
    lat: 56.313,
    lng: 10.615,
    country: 'Denmark'
  },
  {
    name: 'Chicagoland Skydiving Center',
    lat: 41.89338,
    lng: -89.07201,
    town: 'Rochelle',
    region: 'Illinois',
    country: 'United States',
    direction: 250
  },
  {
    name: 'Cleveland Skydiving Center',
    lat: 41.352,
    lng: -81.099,
    town: 'Garrettsville',
    region: 'Ohio',
    country: 'United States'
  },
  {
    name: 'Dropzone Denmark',
    lat: 56.184,
    lng: 9.031,
    country: 'Denmark'
  },
  {
    name: 'HLF Denmark',
    lat: 56.396,
    lng: 8.442,
    country: 'Denmark'
  },
  {
    name: 'Jump Georgia Skydiving',
    lat: 32.65,
    lng: -81.598,
    region: 'Georgia',
    country: 'United States'
  },
  {
    name: 'Jumptown',
    lat: 42.568,
    lng: -72.283,
    town: 'Orange',
    region: 'Massachusetts',
    country: 'United States'
  },
  {
    name: 'Kansas State Skydive',
    lat: 38.904,
    lng: -97.236,
    region: 'Kansas',
    country: 'United States'
  },
  {
    name: 'Kolding Faldskærmsklub',
    lat: 55.437,
    lng: 9.327,
    country: 'Denmark'
  },
  {
    name: 'Mile-Hi Skydiving Center',
    lat: 40.164,
    lng: -105.163,
    town: 'Longmont',
    region: 'Colorado',
    country: 'United States',
    website: 'https://www.milehiskydiving.com/'
  },
  {
    name: 'Netheravon',
    lat: 51.245,
    lng: -1.764,
    town: 'Netheravon',
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Parachute Montreal',
    lat: 45.28492,
    lng: -73.0105,
    region: 'Quebec',
    country: 'Canada',
    direction: 278
  },
  {
    name: 'Seven Hills Skydivers',
    lat: 43.258,
    lng: -89.065,
    region: 'Wisconsin',
    country: 'United States'
  },
  {
    name: 'Sky Down Skydiving',
    lat: 43.642,
    lng: -116.636,
    region: 'Idaho',
    country: 'United States'
  },
  {
    name: 'Skydive Alabama',
    lat: 34.267,
    lng: -86.863,
    region: 'Alabama',
    country: 'United States'
  },
  {
    name: 'Skydive Arizona',
    website: 'https://skydiveaz.com/',
    lat: 32.80799,
    lng: -111.58167,
    town: 'Eloy',
    region: 'Arizona',
    country: 'United States',
    direction: 216
  },
  {
    name: 'Skydive Atlanta',
    lat: 32.953,
    lng: -84.262,
    town: 'Thomaston',
    region: 'Georgia',
    country: 'United States'
  },
  {
    name: 'Skydive Bulgaria (Ihtiman)',
    lat: 42.42256,
    lng: 23.76556,
    town: 'Ihtiman',
    country: 'Bulgaria',
    direction: 315
  },
  {
    name: 'Skydive Carolina',
    lat: 34.791,
    lng: -81.19,
    town: 'Chester',
    region: 'South Carolina',
    country: 'United States'
  },
  {
    name: 'Skydive Chelan',
    lat: 47.866,
    lng: -119.943,
    town: 'Chelan',
    region: 'Washington',
    country: 'United States'
  },
  {
    name: 'Skydive Chicago',
    lat: 41.4,
    lng: -88.794,
    town: 'Ottawa',
    region: 'Illinois',
    country: 'United States'
  },
  {
    name: 'Skydive City (ZHills)',
    lat: 28.21887,
    lng: -82.15122,
    town: 'Zephyrhills',
    region: 'Florida',
    country: 'United States',
    direction: 270,
    website: 'https://www.skydivecity.com/',
    // No nearbyStations supplement needed: KZPH (Zephyrhills Municipal AWOS)
    // is returned by NWS gridpoint discovery for this location — verified
    // against gridpoints/TBW/82,110/stations, where it is the nearest of 51.
    modes: {
      // Jumprun runs north or south here. These are the same two corridors
      // that have been the app-wide default since the solver landed (they
      // were described in core/model as "the ZHills-flavored default");
      // stating them on the dropzone is what makes them ZHills' own.
      flocking: {
        solveCorridors: [
          {
            name: 'North', enabled: true, directionDeg: 0,
            offsetMinMi: -1, offsetMaxMi: 1,
            alongMinMi: -5, alongMaxMi: 3, canopyToleranceDeg: 15
          },
          {
            name: 'South', enabled: true, directionDeg: 180,
            offsetMinMi: -1, offsetMaxMi: 1,
            alongMinMi: -5, alongMaxMi: 3, canopyToleranceDeg: 15
          }
        ]
      }
    }
  },
  {
    name: 'Skydive Colorado Springs',
    lat: 38.427,
    lng: -105.105,
    region: 'Colorado',
    country: 'United States'
  },
  {
    name: 'Skydive Davis',
    lat: 38.579,
    lng: -121.857,
    town: 'Davis',
    region: 'California',
    country: 'United States'
  },
  {
    name: 'Skydive DeLand',
    lat: 29.06402,
    lng: -81.27847,
    town: 'DeLand',
    region: 'Florida',
    country: 'United States',
    direction: 125
  },
  {
    name: 'Skydive Dubai',
    lat: 25.090263,
    lng: 55.13561,
    town: 'Dubai',
    country: 'United Arab Emirates',
    direction: 82
  },
  {
    name: 'Skydive Elsinore',
    lat: 33.63177,
    lng: -117.29978,
    town: 'Lake Elsinore',
    region: 'California',
    country: 'United States',
    direction: 308
  },
  {
    name: 'Skydive Empuriabrava',
    lat: 42.259,
    lng: 3.109,
    town: 'Empuriabrava',
    region: 'Catalonia',
    country: 'Spain'
  },
  {
    name: 'Skydive Georgia',
    lat: 34.018,
    lng: -85.148,
    town: 'Cedartown',
    region: 'Georgia',
    country: 'United States'
  },
  {
    name: 'Skydive Grand Haven',
    lat: 43.035,
    lng: -86.2,
    town: 'Grand Haven',
    region: 'Michigan',
    country: 'United States'
  },
  {
    name: 'Skydive Kapowsin',
    lat: 47.242,
    lng: -123.142,
    town: 'Shelton',
    region: 'Washington',
    country: 'United States'
  },
  {
    name: 'Skydive Langar',
    lat: 52.89,
    lng: -0.909,
    town: 'Langar',
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Marana',
    lat: 32.408,
    lng: -111.224,
    town: 'Marana',
    region: 'Arizona',
    country: 'United States'
  },
  {
    name: 'Skydive Moab',
    lat: 38.759,
    lng: -109.745,
    town: 'Moab',
    region: 'Utah',
    country: 'United States'
  },
  {
    name: 'Skydive Paraclete XP',
    lat: 35.01717,
    lng: -79.19393,
    town: 'Raeford',
    region: 'North Carolina',
    country: 'United States',
    direction: 33
  },
  {
    name: 'Skydive Phoenix',
    lat: 33.053,
    lng: -112.175,
    region: 'Arizona',
    country: 'United States'
  },
  {
    name: 'Skydive Pink Klatovy',
    lat: 49.420251,
    lng: 13.325027,
    town: 'Klatovy',
    country: 'Czech Republic',
    direction: 292
  },
  {
    name: 'Skydive Pretoria',
    lat: -25.663081,
    lng: 28.220605,
    region: 'Gauteng',
    country: 'South Africa',
    direction: 80
  },
  {
    name: 'Skydive Sibson',
    lat: 52.561,
    lng: -0.397,
    town: 'Sibson',
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Snohomish',
    lat: 47.907,
    lng: -122.101,
    town: 'Snohomish',
    region: 'Washington',
    country: 'United States'
  },
  {
    name: 'Skydive Spaceland Atlanta',
    lat: 33.977,
    lng: -85.166,
    town: 'Rome',
    region: 'Georgia',
    country: 'United States'
  },
  {
    name: 'Skydive Spaceland Dallas',
    lat: 33.449,
    lng: -96.378,
    town: 'Whitewright',
    region: 'Texas',
    country: 'United States'
  },
  {
    name: 'Skydive Spaceland Houston',
    lat: 29.357628,
    lng: -95.461775,
    town: 'Rosharon',
    region: 'Texas',
    country: 'United States',
    direction: 151
  },
  {
    name: 'Skydive Spaceland San Marcos',
    lat: 29.76994,
    lng: -97.77173,
    town: 'San Marcos',
    region: 'Texas',
    country: 'United States',
    direction: 210
  },
  {
    name: 'Skydive Spain',
    lat: 37.296,
    lng: -6.162,
    region: 'Andalusia',
    country: 'Spain'
  },
  {
    name: 'Skydive Suffolk',
    lat: 36.679,
    lng: -76.61,
    town: 'Suffolk',
    region: 'Virginia',
    country: 'United States'
  },
  {
    name: 'Skydive Tennessee',
    lat: 35.381,
    lng: -86.24,
    town: 'Tullahoma',
    region: 'Tennessee',
    country: 'United States'
  },
  {
    name: 'Skydive Teuge',
    lat: 52.246,
    lng: 6.047,
    town: 'Teuge',
    country: 'Netherlands'
  },
  {
    name: 'Skydive The Ranch',
    lat: 41.674,
    lng: -74.151,
    town: 'Gardiner',
    region: 'New York',
    country: 'United States'
  },
  {
    name: 'Skydive Utah',
    lat: 40.619,
    lng: -112.407,
    region: 'Utah',
    country: 'United States'
  },
  {
    name: 'Skydive Voss',
    lat: 60.64,
    lng: 6.482,
    town: 'Voss',
    country: 'Norway'
  },
  {
    name: 'Skydive West Plains',
    lat: 47.16,
    lng: -118.292,
    region: 'Washington',
    country: 'United States'
  },
  {
    name: 'Start Skydiving',
    lat: 39.53,
    lng: -84.398,
    town: 'Middletown',
    region: 'Ohio',
    country: 'United States'
  },
  {
    name: 'Texas Skydiving',
    lat: 30.417,
    lng: -96.968,
    town: 'Lexington',
    region: 'Texas',
    country: 'United States'
  },
  {
    name: 'Triangle Skydiving Center',
    lat: 36.026,
    lng: -78.329,
    region: 'North Carolina',
    country: 'United States'
  },
  {
    name: 'Viva Skydive',
    lat: 34.646,
    lng: -106.836,
    town: 'Belen',
    region: 'New Mexico',
    country: 'United States'
  },
  {
    name: 'West Jump Denmark',
    lat: 56.551,
    lng: 9.168,
    country: 'Denmark'
  },
  {
    name: 'West Tennessee Skydiving',
    lat: 35.22037,
    lng: -89.18982,
    region: 'Tennessee',
    country: 'United States',
    direction: 182,
    nearbyStations: ['KM08'] // Bolivar/Whitehurst Field AWOS — not in NWS gridpoints
  },
  {
    name: 'Wisconsin Skydiving Center',
    lat: 42.962,
    lng: -88.818,
    town: 'East Troy',
    region: 'Wisconsin',
    country: 'United States'
  }
];

export function findClosestDropzone(center: [number, number]): Dropzone {
  let minDistance = Number.MAX_VALUE;
  let minDz = DROPZONES[0];

  DROPZONES.forEach(dz => {
    const distance = turf.distance(center, [dz.lng, dz.lat], { units: 'feet' });

    if (distance < minDistance) {
      minDistance = distance;
      minDz = dz;
    }
  });

  return minDz;
}
