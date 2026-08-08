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
    name: 'Abu Dhabi Skydive',
    lat: 24.72509,
    lng: 54.82728,
    direction: 221,
    region: 'Al Smeih Area',
    country: 'United Arab Emirates',
    website: 'https://www.abudhabiskydive.com/'
  },
  {
    name: 'Aero Fallschirmsport Kassel Calden',
    lat: 51.41757,
    lng: 9.38507,
    direction: 276,
    country: 'Germany'
  },
  {
    name: 'Aerohio Skydiving Center',
    lat: 40.8963,
    lng: -82.25818,
    direction: 1,
    region: 'Ohio',
    country: 'United States',
    website: 'https://www.aerohio.com/'
  },
  {
    name: 'Aeroklub Elblaski',
    lat: 54.14388,
    lng: 19.42622,
    direction: 108,
    town: 'Elbląg',
    country: 'Poland'
  },
  {
    name: 'Aeroklub Warszawski Skydive Warszawa',
    lat: 52.57377,
    lng: 20.86617,
    direction: 331,
    town: 'Chrcynno',
    country: 'Poland'
  },
  {
    name: 'Air Libre Parachutisme Dieppe',
    lat: 49.88479,
    lng: 1.08445,
    direction: 126,
    country: 'France'
  },
  {
    name: 'Air Play Parachutisme',
    lat: 43.60885,
    lng: 6.69718,
    country: 'France',
    website: 'https://airplayparachutisme.fr/'
  },
  {
    name: 'Aix-en-Provence Parachutisme',
    lat: 43.5094,
    lng: 5.36606,
    direction: 146,
    country: 'France'
  },
  {
    name: 'Amiens Parachutisme',
    lat: 49.87053,
    lng: 2.38952,
    direction: 296,
    country: 'France'
  },
  {
    name: 'Århus Faldskærm Club',
    lat: 56.313,
    lng: 10.615,
    country: 'Denmark'
  },
  {
    name: 'AVA Flying Center',
    lat: 43.49804,
    lng: 23.30481,
    direction: 138,
    town: 'Erden',
    country: 'Bulgaria'
  },
  {
    name: 'Avignon Pujaut',
    lat: 43.99673,
    lng: 4.75119,
    direction: 351,
    country: 'France'
  },
  {
    name: 'Bay Area Skydiving',
    lat: 37.83443,
    lng: -121.63366,
    direction: 319,
    region: 'California',
    country: 'United States',
    website: 'https://www.bayareaskydiving.com/'
  },
  {
    name: 'Beccles Skydivers',
    lat: 52.4347,
    lng: 1.61865,
    direction: 269,
    town: 'Beccles',
    country: 'United Kingdom'
  },
  {
    name: 'Black Knights Skydiving Centre',
    lat: 53.96257,
    lng: -2.83357,
    direction: 225,
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Cahors Parachutisme',
    lat: 44.34909,
    lng: 1.47928,
    direction: 311,
    country: 'France'
  },
  {
    name: 'Capital City Skydiving Campbell River',
    lat: 49.9524,
    lng: -125.27596,
    direction: 313,
    country: 'Canada'
  },
  {
    name: 'Centre ecole parachutisme Laval',
    lat: 48.03037,
    lng: -0.7443,
    direction: 323,
    country: 'France'
  },
  {
    name: 'Centre Europeen de Chute Libre Lapalisse',
    lat: 46.25093,
    lng: 3.58607,
    direction: 234,
    country: 'France'
  },
  {
    name: 'Centro Paracaidismo Pirineos Jaca',
    lat: 42.56803,
    lng: -0.72664,
    direction: 270,
    country: 'Spain'
  },
  {
    name: 'CEPS Ariege Pamiers',
    lat: 43.09145,
    lng: 1.69905,
    direction: 90,
    country: 'France'
  },
  {
    name: 'Chattanooga Skydiving Company',
    lat: 35.06022,
    lng: -85.58517,
    direction: 221,
    region: 'Tennessee',
    country: 'United States',
    website: 'https://www.chattanoogaskydivingcompany.com/'
  },
  {
    name: 'Chicagoland Skydiving Center',
    lat: 41.89395,
    lng: -89.07263,
    town: 'Rochelle',
    region: 'Illinois',
    country: 'United States',
    direction: 250,
  },
  {
    name: 'Chute Libre Dordogne',
    lat: 45.19643,
    lng: 0.81647,
    direction: 295,
    country: 'France'
  },
  {
    name: 'Cleveland Skydiving Center',
    lat: 41.35048,
    lng: -81.09904,
    direction: 259,
    town: 'Garrettsville',
    region: 'Ohio',
    country: 'United States',
    modes: {
      swoop: {
        lat: 41.35109,
        lng: -81.10023,
        direction: 79
      },
    },
  },
  {
    name: 'Connecticut Parachutists, Inc.',
    lat: 41.9222,
    lng: -72.45825,
    direction: 0,
    region: 'Connecticut',
    country: 'United States',
    website: 'https://www.skydivect.com/'
  },
  {
    name: 'Cornish Parachute Club',
    lat: 50.32788,
    lng: -5.18008,
    direction: 266,
    country: 'United Kingdom'
  },
  {
    name: 'Dropzone Ceska Lipa',
    lat: 50.70922,
    lng: 14.56603,
    direction: 315,
    country: 'Czech Republic'
  },
  {
    name: 'Dropzone Denmark',
    lat: 56.18408,
    lng: 9.03664,
    direction: 271,
    country: 'Denmark'
  },
  {
    name: 'Dropzone Most',
    lat: 50.5261,
    lng: 13.68031,
    direction: 21,
    country: 'Czech Republic'
  },
  {
    name: 'Dropzone Prostejov',
    lat: 49.44748,
    lng: 17.12908,
    direction: 304,
    country: 'Czech Republic',
    website: 'https://www.dropzoneprostejov.com/'
  },
  {
    name: 'École de Parachutisme de Lyon Corbas',
    lat: 45.656,
    lng: 4.91495,
    direction: 179,
    region: 'Auvergne-Rhône-Alpes',
    country: 'France',
    website: 'https://parachutisme-lyon.fr/'
  },
  {
    name: 'Ecole de Parachutisme du Valinco',
    lat: 41.65954,
    lng: 8.89557,
    direction: 276,
    country: 'France'
  },
  {
    name: 'Ecole de Parachutisme Nord Franche-Comte',
    lat: 47.70294,
    lng: 6.54728,
    direction: 221,
    country: 'France'
  },
  {
    name: 'EFPLB Lille Bondues',
    lat: 50.68612,
    lng: 3.07813,
    direction: 255,
    country: 'France'
  },
  {
    name: 'EPCOL Orleans',
    lat: 47.90242,
    lng: 2.16771,
    direction: 57,
    country: 'France',
    modes: {
      swoop: {
        lat: 47.9036,
        lng: 2.16958,
        direction: 72
      },
    },
  },
  {
    name: 'EPSBA Arcachon',
    lat: 44.59664,
    lng: -1.11642,
    direction: 76,
    country: 'France'
  },
  {
    name: 'Euroa Skydive – The Parachute School',
    lat: -36.74491,
    lng: 145.51481,
    direction: 203,
    region: 'Victoria',
    country: 'Australia',
  },
  {
    name: 'Fallschirmsport Damme',
    lat: 52.48813,
    lng: 8.18671,
    direction: 104,
    region: 'Niedersachsen',
    country: 'Germany'
  },
  {
    name: 'Fallskärmsklubben Aros',
    lat: 59.57964,
    lng: 16.49721,
    direction: 45,
    town: 'Västerås',
    country: 'Sweden',
    website: 'https://www.fkaros.se/'
  },
  {
    name: 'Fano Sky Team S.S.D.',
    lat: 43.82382,
    lng: 13.02883,
    direction: 231,
    country: 'Italy',
    website: 'https://www.skydivefano.com/'
  },
  {
    name: 'Firebird Skydiving Bitburg',
    lat: 49.94957,
    lng: 6.5717,
    direction: 59,
    country: 'Germany'
  },
  {
    name: 'Føniks Fallskjermklubb',
    lat: 62.74882,
    lng: 7.2636,
    country: 'Norway',
    website: 'https://www.skydivemolde.com/'
  },
  {
    name: 'FSC Suedpfalz E.V.',
    lat: 49.03252,
    lng: 7.99096,
    direction: 80,
    country: 'Germany',
    website: 'https://www.fsc-suedpfalz.de/'
  },
  {
    name: 'Fun Parachutisme Albi',
    lat: 43.91444,
    lng: 2.1187,
    direction: 91,
    country: 'France'
  },
  {
    name: 'GoJump Las Vegas LLC',
    lat: 35.77113,
    lng: -115.33232,
    direction: 37,
    region: 'Nevada',
    country: 'United States',
  },
  {
    name: 'GoJump New York',
    lat: 40.81533,
    lng: -72.86523,
    direction: 316,
    region: 'New York',
    country: 'United States',
    website: 'https://gojump-newyork.com/'
  },
  {
    name: 'GoJump Oceanside',
    lat: 33.21921,
    lng: -117.34826,
    direction: 80,
    region: 'California',
    country: 'United States',
    website: 'https://www.gojump-oceanside.com/'
  },
  {
    name: 'Gotlands Fallskärmsklubb',
    lat: 57.64871,
    lng: 18.3291,
    direction: 240,
    country: 'Sweden',
    website: 'https://gotland.com/companies/gotlands-fallskarmsklubb/'
  },
  {
    name: 'Gravity Skydive',
    lat: 14.01366,
    lng: -90.77161,
    direction: 151,
    country: 'Guatemala',
    website: 'https://www.gravity.com.gt/'
  },
  {
    name: 'HLF Denmark',
    lat: 56.39541,
    lng: 8.44144,
    direction: 255,
    country: 'Denmark'
  },
  {
    name: 'Hosin Ceske Budejovice Skysurf',
    lat: 49.03838,
    lng: 14.48939,
    direction: 63,
    country: 'Czech Republic'
  },
  {
    name: 'iSkydive America – Miami',
    lat: 25.49842,
    lng: -80.54537,
    direction: 358,
    region: 'Florida',
    country: 'United States',
    website: 'https://www.iskydive.com/miami'
  },
  {
    name: 'iSkydive America – Washington, D.C.',
    lat: 38.59329,
    lng: -77.71288,
    region: 'Virginia',
    country: 'United States',
    website: 'https://iskydive.com/dc/'
  },
  {
    name: 'Johannesburg Skydiving Club',
    lat: -26.36769,
    lng: 27.3483,
    direction: 115,
    region: 'Gauteng',
    country: 'South Africa',
    modes: {
      swoop: {
        lat: -26.36626,
        lng: 27.35172,
        direction: 210
      },
    },
  },
  {
    name: 'Jump Club Krems',
    lat: 48.44647,
    lng: 15.63166,
    direction: 287,
    country: 'Austria',
    website: 'https://www.fallschirmspringen-krems.at/'
  },
  {
    name: 'Jump Florida Skydiving',
    lat: 27.89605,
    lng: -81.61935,
    region: 'Florida',
    country: 'United States',
    website: 'https://www.jumpfloridaskydiving.com/'
  },
  {
    name: 'Jump Georgia Skydiving',
    lat: 32.64906,
    lng: -81.59571,
    direction: 279,
    region: 'Georgia',
    country: 'United States'
  },
  {
    name: 'Jump TN',
    lat: 36.19653,
    lng: -82.8095,
    direction: 230,
    region: 'Tennessee',
    country: 'United States',
    website: 'https://www.jumptn.com/'
  },
  {
    name: 'Jumptown',
    lat: 42.56717,
    lng: -72.28669,
    direction: 225,
    town: 'Orange',
    region: 'Massachusetts',
    country: 'United States',
    modes: {
      swoop: {
        lat: 42.56829,
        lng: -72.28526,
        direction: 225
      },
    },
  },
  {
    name: 'Kolding Faldskærmsklub',
    lat: 55.43651,
    lng: 9.32623,
    direction: 79,
    country: 'Denmark'
  },
  {
    name: 'Krutitcy',
    lat: 54.27657,
    lng: 40.82074,
    direction: 66,
    country: 'Russian Federation',
  },
  {
    name: 'Kunovice OK Boogie',
    lat: 49.035,
    lng: 17.44115,
    direction: 26,
    country: 'Czech Republic'
  },
  {
    name: 'Kuwait Skydive',
    lat: 28.60385,
    lng: 48.31022,
    direction: 179,
    country: 'Kuwait',
    website: 'https://kuwaitskydiveco.com/'
  },
  {
    name: 'La Rochelle Parachutisme',
    lat: 46.1777,
    lng: -1.18973,
    direction: 270,
    country: 'France'
  },
  {
    name: 'Lens Parachutisme',
    lat: 50.4674,
    lng: 2.82236,
    direction: 214,
    country: 'France'
  },
  {
    name: 'Maubeuge Parachutisme',
    lat: 50.31185,
    lng: 4.03453,
    direction: 50,
    country: 'France'
  },
  {
    name: 'Midwest Freefall Sport Parachute Club, Inc.',
    lat: 42.75876,
    lng: -82.94165,
    direction: 176,
    region: 'Michigan',
    country: 'United States',
    website: 'https://www.midwestfreefall.com/'
  },
  {
    name: 'Mile-Hi Skydiving Center',
    lat: 40.16289,
    lng: -105.16394,
    direction: 305,
    town: 'Longmont',
    region: 'Colorado',
    country: 'United States',
    website: 'https://www.milehiskydiving.com/',
    modes: {
      swoop: {
        lat: 40.16205,
        lng: -105.16584,
        direction: 125
      },
    },
  },
  {
    name: 'Music City Skydiving',
    lat: 36.11386,
    lng: -87.74093,
    direction: 30,
    region: 'Tennessee',
    country: 'United States',
    website: 'https://www.musiccityskydiving.com/'
  },
  {
    name: 'Nancy Azelot Parachutisme',
    lat: 48.59365,
    lng: 6.24117,
    country: 'France'
  },
  {
    name: 'Netheravon',
    lat: 51.24287,
    lng: -1.76179,
    direction: 242,
    town: 'Netheravon',
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Nimes Courbessac Parachutisme',
    lat: 43.85348,
    lng: 4.41335,
    direction: 357,
    country: 'France'
  },
  {
    name: 'NorCal Skydiving',
    lat: 38.77289,
    lng: -122.99163,
    direction: 332,
    region: 'California',
    country: 'United States'
  },
  {
    name: 'Ogden Skydiving Center',
    lat: 41.19567,
    lng: -112.01294,
    region: 'Utah',
    country: 'United States',
    website: 'https://www.skydiveogden.com/'
  },
  {
    name: 'Okanagan Skydive',
    lat: 50.24651,
    lng: -119.33169,
    direction: 70,
    country: 'Canada'
  },
  {
    name: 'Olimpic Skydive Wroclaw',
    lat: 50.9565,
    lng: 16.76905,
    direction: 357,
    country: 'Poland'
  },
  {
    name: 'Pacific Northwest Skydiving Center',
    lat: 45.22036,
    lng: -122.59129,
    direction: 156,
    region: 'Oregon',
    country: 'United States',
    website: 'https://www.pnwskydiving.com/'
  },
  {
    name: 'Para 71 Chalon-sur-Saone',
    lat: 46.82742,
    lng: 4.82584,
    direction: 146,
    country: 'France'
  },
  {
    name: 'Paracentro Roma',
    lat: 41.88422,
    lng: 12.71637,
    direction: 270,
    region: 'Lazio',
    country: 'Italy'
  },
  {
    name: 'Paracentrum Texel',
    lat: 53.11824,
    lng: 4.82894,
    direction: 38,
    country: 'Netherlands',
    website: 'https://www.paracentrumtexel.nl/'
  },
  {
    name: 'Parachute Montreal',
    lat: 45.28507,
    lng: -73.01252,
    region: 'Quebec',
    country: 'Canada',
    direction: 278,
    modes: {
      swoop: {
        lat: 45.2849,
        lng: -73.01042,
        direction: 278
      },
    },
  },
  {
    name: 'Parachute Montreal Rive-Nord',
    lat: 45.9143,
    lng: -73.67156,
    direction: 185,
    region: 'Quebec',
    country: 'Canada',
    website: 'https://www.parachutemontreal.ca/'
  },
  {
    name: 'Parachute Ottawa',
    lat: 45.46075,
    lng: -75.63846,
    direction: 257,
    country: 'Canada'
  },
  {
    name: 'Parachute School of Toronto',
    lat: 44.26719,
    lng: -79.33987,
    direction: 180,
    region: 'Ontario',
    country: 'Canada',
    website: 'https://www.parachuteschool.com/'
  },
  {
    name: 'Parachute Victoriaville',
    lat: 46.11541,
    lng: -71.92456,
    direction: 227,
    region: 'Quebec',
    country: 'Canada',
    website: 'https://www.paravic.com/'
  },
  {
    name: 'Parachutisme 38 Grenoble',
    lat: 45.21744,
    lng: 5.84881,
    direction: 223,
    country: 'France'
  },
  {
    name: 'Parachutisme 42 Saint Galmier',
    lat: 45.60708,
    lng: 4.30364,
    direction: 345,
    country: 'France'
  },
  {
    name: 'Parachutisme Adrenaline Trois-Rivieres',
    lat: 46.36485,
    lng: -72.67076,
    direction: 34,
    region: 'Quebec',
    country: 'Canada',
  },
  {
    name: 'Parachutisme Besancon',
    lat: 47.20436,
    lng: 6.07709,
    direction: 56,
    country: 'France'
  },
  {
    name: 'Paraclub Agenais',
    lat: 44.17202,
    lng: 0.59563,
    direction: 288,
    country: 'France'
  },
  {
    name: 'Paris Parachutisme Fretoy le Chateau',
    lat: 49.66944,
    lng: 2.96644,
    direction: 354,
    country: 'France'
  },
  {
    name: 'Pau Parachutisme Passion',
    lat: 43.38215,
    lng: -0.42025,
    direction: 125,
    country: 'France'
  },
  {
    name: 'Pepperell Skydiving Center',
    lat: 42.69567,
    lng: -71.55178,
    direction: 44,
    region: 'Massachusetts',
    country: 'United States',
    website: 'https://www.skyjump.com/'
  },
  {
    name: 'Piedmont Skydiving',
    lat: 35.64629,
    lng: -80.52125,
    direction: 20,
    region: 'North Carolina',
    country: 'United States',
    website: 'https://piedmontskydiving.com/'
  },
  {
    name: 'Pinjarra Skydiving Airstrip',
    lat: -32.66445,
    lng: 115.8815,
    direction: 20,
    region: 'Western Australia',
    country: 'Australia'
  },
  {
    name: 'SA Skydiving Murray Bridge',
    lat: -35.06671,
    lng: 139.22394,
    direction: 26,
    country: 'Australia'
  },
  {
    name: 'Saltamos - SkydiveBCN',
    lat: 41.76456,
    lng: 1.86256,
    direction: 281,
    region: 'Catalunya',
    country: 'Spain',
    website: 'https://skydivebcn.com'
  },
  {
    name: 'Saumur Parachutisme',
    lat: 47.25848,
    lng: -0.11217,
    direction: 94,
    country: 'France'
  },
  {
    name: 'Seven Hills Skydivers',
    lat: 43.26041,
    lng: -89.06727,
    direction: 2,
    region: 'Wisconsin',
    country: 'United States'
  },
  {
    name: 'Silicon Valley Skydiving',
    lat: 37.07866,
    lng: -121.59886,
    region: 'California',
    country: 'United States',
    website: 'https://www.siliconvalleyskydiving.com/'
  },
  {
    name: 'Sky Company Clube e Escola de Paraquedismo',
    lat: -23.2974,
    lng: -47.69042,
    direction: 222,
    country: 'Brazil',
    website: 'https://www.paraquedismoskycompany.com.br/',
    modes: {
      swoop: {
        lat: -23.29854,
        lng: -47.68929,
        direction: 347
      },
    },
  },
  {
    name: 'Sky Down Skydiving',
    lat: 43.645,
    lng: -116.63724,
    direction: 138,
    region: 'Idaho',
    country: 'United States'
  },
  {
    name: 'Sky Kef',
    lat: 31.28538,
    lng: 34.72335,
    direction: 310,
    country: 'Israel',
    website: 'https://www.skykef.co.il/'
  },
  {
    name: 'Sky Service Skydive Prague',
    lat: 50.13097,
    lng: 14.53007,
    direction: 234,
    country: 'Czech Republic'
  },
  {
    name: 'Skydive Abel Tasman',
    lat: -41.12033,
    lng: 172.99303,
    direction: 227,
    region: 'Tasman',
    country: 'New Zealand'
  },
  {
    name: 'Skydive Aircruz-Totana',
    lat: 37.75377,
    lng: -1.44761,
    direction: 34,
    country: 'Spain',
    website: 'https://skydiveaircruz.com/'
  },
  {
    name: 'Skydive Alabama',
    lat: 34.26661,
    lng: -86.86196,
    direction: 128,
    region: 'Alabama',
    country: 'United States'
  },
  {
    name: 'Skydive Algarve',
    lat: 37.14846,
    lng: -8.58156,
    direction: 290,
    country: 'Portugal',
    website: 'https://www.skydivealgarve.com/'
  },
  {
    name: 'Skydive Andes',
    lat: -33.67747,
    lng: -71.10929,
    direction: 264,
    country: 'Chile',
    website: 'https://www.skydiveandes.com/',
    modes: {
      swoop: {
        lat: -33.67724,
        lng: -71.107,
        direction: 264
      },
    },
  },
  {
    name: 'Skydive Arizona',
    website: 'https://skydiveaz.com/',
    lat: 32.8035,
    lng: -111.57985,
    town: 'Eloy',
    region: 'Arizona',
    country: 'United States',
    direction: 181,
  },
  {
    name: 'Skydive Atlanta',
    lat: 32.95406,
    lng: -84.26341,
    direction: 295,
    town: 'Thomaston',
    region: 'Georgia',
    country: 'United States'
  },
  {
    name: 'Skydive Auckland',
    lat: -36.65046,
    lng: 174.43194,
    direction: 90,
    region: 'Auckland',
    country: 'New Zealand',
    modes: {
      swoop: {
        lat: -36.65037,
        lng: 174.43453,
        direction: 270
      },
    },
  },
  {
    name: 'Skydive Benghazi',
    lat: 31.97536,
    lng: 20.02613,
    direction: 336,
    country: 'Libya',
  },
  {
    name: 'Skydive Bovec',
    lat: 46.33203,
    lng: 13.55092,
    direction: 58,
    country: 'Slovenia',
    website: 'https://www.skydivebovec.com/'
  },
  {
    name: 'Skydive Braga',
    lat: 41.58688,
    lng: -8.44451,
    direction: 245,
    country: 'Portugal'
  },
  {
    name: 'Skydive Bragança Galsur',
    lat: 41.85802,
    lng: -6.70641,
    direction: 193,
    country: 'Portugal'
  },
  {
    name: 'Skydive Breclav',
    lat: 48.79227,
    lng: 16.89621,
    direction: 79,
    country: 'Czech Republic'
  },
  {
    name: 'Skydive Buckeye',
    lat: 33.42042,
    lng: -112.6879,
    direction: 3,
    region: 'Arizona',
    country: 'United States',
    website: 'https://skydivebuckeye.com/'
  },
  {
    name: 'Skydive Bulgaria',
    lat: 42.42256,
    lng: 23.76556,
    town: 'Ihtiman',
    country: 'Bulgaria',
    direction: 315
  },
  {
    name: 'Skydive Burnaby Inc.',
    lat: 42.876,
    lng: -79.35473,
    direction: 24,
    region: 'Ontario',
    country: 'Canada',
    website: 'https://www.skydiveburnaby.com/'
  },
  {
    name: 'Skydive Byron Bay',
    lat: -28.59568,
    lng: 153.54725,
    direction: 67,
    region: 'New South Wales',
    country: 'Australia',
    website: 'https://www.skydive.com.au/byron-bay/'
  },
  {
    name: 'Skydive Caribbean',
    lat: 10.46215,
    lng: -66.09536,
    direction: 74,
    town: 'Higuerote',
    region: 'Miranda',
    country: 'Venezuela',
    website: 'https://www.skydivecaribbeanvzla.com/'
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
    name: 'Skydive Castellon',
    lat: 39.99681,
    lng: 0.02552,
    direction: 5,
    country: 'Spain'
  },
  {
    name: 'Skydive Chelan',
    lat: 47.86397,
    lng: -119.94448,
    direction: 225,
    town: 'Chelan',
    region: 'Washington',
    country: 'United States'
  },
  {
    name: 'Skydive Chicago',
    lat: 41.39818,
    lng: -88.79379,
    direction: 216,
    town: 'Ottawa',
    region: 'Illinois',
    country: 'United States'
  },
  {
    name: 'Skydive City (ZHills)',
    lat: 28.21952,
    lng: -82.15154,
    town: 'Zephyrhills',
    region: 'Florida',
    country: 'United States',
    direction: 180,
    website: 'https://www.skydivecity.com/',
    // No nearbyStations supplement needed: KZPH (Zephyrhills Municipal AWOS)
    // is returned by NWS gridpoint discovery for this location — verified
    // against gridpoints/TBW/82,110/stations, where it is the nearest of 51.
    modes: {
      swoop: {
        lat: 28.21887,
        lng: -82.15107,
        direction: 270
      },
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
    name: 'Skydive Coastal Carolinas',
    lat: 33.93017,
    lng: -78.07334,
    direction: 225,
    region: 'North Carolina',
    country: 'United States',
    website: 'https://www.skydivecoastalcarolinas.com/'
  },
  {
    name: 'Skydive Colorado Springs',
    lat: 38.42961,
    lng: -105.10423,
    direction: 120,
    region: 'Colorado',
    country: 'United States'
  },
  {
    name: 'Skydive Costa D\'Argento',
    lat: 42.49546,
    lng: 11.23892,
    direction: 10,
    country: 'Italy',
    website: 'https://www.skydivecostadargento.com/'
  },
  {
    name: 'Skydive Cross Keys',
    lat: 39.70725,
    lng: -75.03609,
    direction: 78,
    region: 'New Jersey',
    country: 'United States',
    website: 'https://www.skydivecrosskeys.com/',
    modes: {
      swoop: {
        lat: 39.70593,
        lng: -75.03482,
        direction: 323
      },
    },
  },
  {
    name: 'Skydive Cuautla',
    lat: 18.70146,
    lng: -98.89191,
    direction: 30,
    country: 'Mexico',
    modes: {
      swoop: {
        lat: 18.7034,
        lng: -98.89056,
        direction: 210
      },
    },
  },
  {
    name: 'Skydive Danielson',
    lat: 41.82059,
    lng: -71.90105,
    direction: 119,
    region: 'Connecticut',
    country: 'United States',
    website: 'https://www.skydivedanielson.com/'
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
    lat: 25.09014,
    lng: 55.13651,
    town: 'Dubai',
    country: 'United Arab Emirates',
    direction: 262,
    modes: {
      swoop: {
        lat: 25.09025,
        lng: 55.13536,
        direction: 82
      },
    },
  },
  {
    name: 'Skydive Elsinore',
    lat: 33.63177,
    lng: -117.29979,
    town: 'Lake Elsinore',
    region: 'California',
    country: 'United States',
    direction: 308,
    modes: {
      swoop: {
        lat: 33.63005,
        lng: -117.2965,
        direction: 308
      },
    },
  },
  {
    name: 'Skydive Empuriabrava',
    lat: 42.25836,
    lng: 3.11008,
    direction: 346,
    town: 'Empuriabrava',
    region: 'Catalonia',
    country: 'Spain'
  },
  {
    name: 'Skydive Fehrbellin',
    lat: 52.79233,
    lng: 12.7616,
    direction: 286,
    region: 'Brandenburg',
    country: 'Germany'
  },
  {
    name: 'Skydive Finland',
    lat: 60.89762,
    lng: 26.9261,
    direction: 78,
    region: 'Kymenlaakso',
    country: 'Finland',
    website: 'https://www.skydivefinland.fi'
  },
  {
    name: 'Skydive Flanders',
    lat: 50.84967,
    lng: 3.14726,
    direction: 230,
    region: 'West-Vlaanderen',
    country: 'Belgium',
    website: 'https://www.pcv.be/'
  },
  {
    name: 'Skydive Gananoque',
    lat: 44.40279,
    lng: -76.23635,
    direction: 167,
    country: 'Canada'
  },
  {
    name: 'Skydive Gap Tallard',
    lat: 44.45571,
    lng: 6.03597,
    direction: 25,
    region: 'Provence-Alpes-Côte d\'Azur',
    country: 'France'
  },
  {
    name: 'Skydive Georgia',
    lat: 34.01796,
    lng: -85.14648,
    direction: 279,
    town: 'Cedartown',
    region: 'Georgia',
    country: 'United States'
  },
  {
    name: 'Skydive Geronimo Rottnest Island',
    lat: -32.00573,
    lng: 115.54435,
    country: 'Australia'
  },
  {
    name: 'Skydive Gran Canaria',
    lat: 27.93016,
    lng: -15.38801,
    country: 'Spain'
  },
  {
    name: 'Skydive Grand Haven',
    lat: 43.03347,
    lng: -86.19964,
    direction: 272,
    town: 'Grand Haven',
    region: 'Michigan',
    country: 'United States'
  },
  {
    name: 'Skydive Headcorn',
    lat: 51.15573,
    lng: 0.64187,
    direction: 283,
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Hervey Bay',
    lat: -25.31963,
    lng: 152.87757,
    country: 'Australia'
  },
  {
    name: 'Skydive Hinton',
    lat: 52.03026,
    lng: -1.2075,
    direction: 59,
    region: 'England',
    country: 'United Kingdom',
    website: 'https://www.skydive.co.uk/'
  },
  {
    name: 'Skydive Hoogeveen',
    lat: 52.73178,
    lng: 6.52221,
    direction: 92,
    region: 'Drenthe',
    country: 'Netherlands',
    website: 'https://skydivehoogeveen.nl/'
  },
  {
    name: 'Skydive Hunter Valley',
    lat: -32.60051,
    lng: 151.18862,
    direction: 294,
    region: 'New South Wales',
    country: 'Australia'
  },
  {
    name: 'Skydive Indianapolis',
    lat: 40.27616,
    lng: -86.56273,
    region: 'Indiana',
    country: 'United States',
    website: 'https://www.skydiveindianapolis.com/'
  },
  {
    name: 'Skydive Iseo',
    lat: 45.81514,
    lng: 10.09552,
    direction: 224,
    region: 'Lombardia',
    country: 'Italy',
    website: 'https://skydiveiseo.it/'
  },
  {
    name: 'Skydive Jeffreys Bay',
    lat: -33.96719,
    lng: 24.94383,
    direction: 237,
    region: 'Eastern Cape',
    country: 'South Africa'
  },
  {
    name: 'Skydive Jerez',
    lat: 36.6302,
    lng: -6.01832,
    direction: 112,
    country: 'Spain'
  },
  {
    name: 'Skydive Jersey',
    lat: 49.20786,
    lng: -2.18586,
    direction: 266,
    country: 'Jersey'
  },
  {
    name: 'Skydive Jyväskylä',
    lat: 62.40904,
    lng: 25.67093,
    region: 'Keski-Suomi',
    country: 'Finland',
    website: 'https://skydivejkl.fi/'
  },
  {
    name: 'Skydive Kalbarri',
    lat: -27.69278,
    lng: 114.25923,
    country: 'Australia'
  },
  {
    name: 'Skydive Kansas City',
    lat: 38.29112,
    lng: -94.3416,
    direction: 2,
    region: 'Missouri',
    country: 'United States',
    website: 'https://www.skydivekc.com/'
  },
  {
    name: 'Skydive Kapowsin',
    lat: 47.23761,
    lng: -123.1458,
    direction: 208,
    town: 'Shelton',
    region: 'Washington',
    country: 'United States',
    modes: {
      swoop: {
        lat: 47.23967,
        lng: -123.14286,
        direction: 208
      },
    },
  },
  {
    name: 'Skydive Karjala',
    lat: 61.24741,
    lng: 28.89801,
    direction: 30,
    region: 'Etelä-Karjala',
    country: 'Finland'
  },
  {
    name: 'Skydive Key West',
    lat: 24.64888,
    lng: -81.57664,
    direction: 103,
    region: 'Florida',
    country: 'United States',
    website: 'https://skydivekeywest.com/'
  },
  {
    name: 'Skydive Kiel',
    lat: 54.38216,
    lng: 10.14677,
    direction: 82,
    town: 'Holtenau',
    country: 'Germany'
  },
  {
    name: 'Skydive Konstanz',
    lat: 47.6818,
    lng: 9.13796,
    direction: 295,
    country: 'Germany'
  },
  {
    name: 'Skydive Krakow',
    lat: 50.08453,
    lng: 20.20402,
    direction: 271,
    town: 'Pobiednik Wielki',
    country: 'Poland'
  },
  {
    name: 'Skydive Langar',
    lat: 52.89138,
    lng: -0.90717,
    direction: 147,
    town: 'Langar',
    region: 'England',
    country: 'United Kingdom',
    modes: {
      swoop: {
        lat: 52.89086,
        lng: -0.90486,
        direction: 307
      },
    },
  },
  {
    name: 'Skydive Latvia',
    lat: 57.48712,
    lng: 24.67375,
    direction: 166,
    country: 'Latvia',
    website: 'https://www.skydive.lv/'
  },
  {
    name: 'Skydive Leipzig Loebnitz',
    lat: 51.57637,
    lng: 12.48816,
    direction: 277,
    country: 'Germany',
    modes: {
      swoop: {
        lat: 51.57627,
        lng: 12.48964,
        direction: 277
      },
    },
  },
  {
    name: 'Skydive Leon',
    lat: 42.58733,
    lng: -5.65402,
    direction: 230,
    town: 'La Virgen del Camino',
    country: 'Spain'
  },
  {
    name: 'Skydive Lucca',
    lat: 43.82565,
    lng: 10.57468,
    country: 'Italy',
    website: 'https://www.paracadutismolucca.it/'
  },
  {
    name: 'Skydive Madrid',
    lat: 39.71791,
    lng: -3.31984,
    region: 'Castilla-La Mancha',
    country: 'Spain',
    website: 'https://www.skydivemadrid.es'
  },
  {
    name: 'Skydive Maia',
    lat: 41.28049,
    lng: -8.51706,
    country: 'Portugal',
    website: 'https://www.skydive-maia.com/'
  },
  {
    name: 'Skydive Maitland',
    lat: -32.70194,
    lng: 151.48996,
    direction: 57,
    country: 'Australia'
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
    name: 'Skydive Merville',
    lat: 50.62295,
    lng: 2.64949,
    direction: 283,
    country: 'France'
  },
  {
    name: 'Skydive Midwest',
    lat: 42.70341,
    lng: -87.9587,
    direction: 79,
    region: 'Wisconsin',
    country: 'United States',
    website: 'https://sdmw.com/',
    modes: {
      swoop: {
        lat: 42.70255,
        lng: -87.95797,
        direction: 269
      },
    },
  },
  {
    name: 'Skydive Milwaukee/Sky Knights Sport Parachute Club',
    lat: 42.79717,
    lng: -88.37261,
    region: 'Wisconsin',
    country: 'United States',
    website: 'https://www.skydivemilwaukee.com/'
  },
  {
    name: 'Skydive Moab',
    lat: 38.75729,
    lng: -109.74427,
    direction: 169,
    town: 'Moab',
    region: 'Utah',
    country: 'United States'
  },
  {
    name: 'Skydive Monroe',
    lat: 33.78252,
    lng: -83.6928,
    region: 'Georgia',
    country: 'United States',
    website: 'https://www.skydivemonroe.com/'
  },
  {
    name: 'Skydive Monterey Bay',
    lat: 36.68038,
    lng: -121.76116,
    direction: 300,
    region: 'California',
    country: 'United States',
    website: 'https://www.skydivemontereybay.com/'
  },
  {
    name: 'Skydive Nagambie',
    lat: -36.78847,
    lng: 145.03972,
    region: 'Victoria',
    country: 'Australia'
  },
  {
    name: 'Skydive New England',
    lat: 43.37134,
    lng: -70.92663,
    direction: 336,
    region: 'Maine',
    country: 'United States',
    website: 'https://www.skydivenewengland.com/',
    modes: {
      swoop: {
        lat: 43.37182,
        lng: -70.92546,
        direction: 331
      },
    },
  },
  {
    name: 'Skydive Noosa',
    lat: -26.60713,
    lng: 153.08663,
    region: 'Queensland',
    country: 'Australia'
  },
  {
    name: 'Skydive Northwest',
    lat: 54.16345,
    lng: -2.9614,
    direction: 237,
    region: 'England',
    country: 'United Kingdom',
    website: 'https://skydivenorthwest.co.uk/'
  },
  {
    name: 'Skydive Nuggets',
    lat: 47.85886,
    lng: 10.01238,
    direction: 57,
    country: 'Germany',
    website: 'https://www.skydive-nuggets.de'
  },
  {
    name: 'Skydive Oppdal',
    lat: 62.65028,
    lng: 9.85463,
    country: 'Norway',
    website: 'https://skydiveoppdal.no/'
  },
  {
    name: 'Skydive Orange',
    lat: 38.24972,
    lng: -78.04602,
    direction: 64,
    region: 'Virginia',
    country: 'United States',
    website: 'https://www.skydiveorange.com/'
  },
  {
    name: 'Skydive Oregon',
    lat: 45.14526,
    lng: -122.61829,
    region: 'Oregon',
    country: 'United States',
    website: 'https://www.skydiveoregon.com/'
  },
  {
    name: 'Skydive Ostsee Barth',
    lat: 54.33742,
    lng: 12.71819,
    direction: 270,
    country: 'Germany'
  },
  {
    name: 'Skydive Oz',
    lat: -35.90294,
    lng: 150.14312,
    direction: 243,
    region: 'New South Wales',
    country: 'Australia'
  },
  {
    name: 'Skydive Panama City',
    lat: 30.84948,
    lng: -85.60415,
    region: 'Florida',
    country: 'United States',
    website: 'https://www.skydivepanamacity.com/'
  },
  {
    name: 'Skydive Paraclete XP',
    lat: 35.01754,
    lng: -79.19054,
    town: 'Raeford',
    region: 'North Carolina',
    country: 'United States',
    direction: 213,
    modes: {
      swoop: {
        lat: 35.01713,
        lng: -79.19396,
        direction: 33
      },
    },
  },
  {
    name: 'Skydive Pennsylvania',
    lat: 41.14553,
    lng: -80.16627,
    direction: 273,
    region: 'Pennsylvania',
    country: 'United States',
    website: 'https://www.skydivepa.com/'
  },
  {
    name: 'Skydive Peronne',
    lat: 49.87023,
    lng: 3.02813,
    country: 'France'
  },
  {
    name: 'Skydive Perris',
    lat: 33.76227,
    lng: -117.2176,
    direction: 168,
    region: 'California',
    country: 'United States',
    website: 'https://www.skydiveperris.com/'
  },
  {
    name: 'Skydive Pharaohs',
    lat: 30.047,
    lng: 31.843,
    region: 'Cairo',
    country: 'Egypt',
    website: 'https://skydivepharaohs.com/'
  },
  {
    name: 'Skydive Philadelphia',
    lat: 40.39033,
    lng: -75.28913,
    direction: 70,
    region: 'Pennsylvania',
    country: 'United States',
    website: 'https://www.skydivephiladelphia.com/'
  },
  {
    name: 'Skydive Phoenix',
    lat: 33.05352,
    lng: -112.17536,
    direction: 270,
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
    name: 'Skydive Portugal',
    lat: 38.52972,
    lng: -7.89194,
    country: 'Portugal',
    website: 'https://www.skydiveportugal.pt/'
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
    name: 'Skydive Proenca-a-Nova',
    lat: 39.73118,
    lng: -7.8753,
    direction: 306,
    country: 'Portugal'
  },
  {
    name: 'Skydive Puebla',
    lat: 18.85405,
    lng: -98.44649,
    direction: 20,
    country: 'Mexico',
    website: 'https://www.skydivepuebla.com/'
  },
  {
    name: 'Skydive Pull Out Ravenna',
    lat: 44.36147,
    lng: 12.21693,
    direction: 315,
    country: 'Italy'
  },
  {
    name: 'Skydive Ramblers',
    lat: -27.07137,
    lng: 152.38437,
    direction: 252,
    region: 'Queensland',
    country: 'Australia',
    website: 'https://www.ramblers.com.au/',
    modes: {
      swoop: {
        lat: -27.07083,
        lng: 152.38604,
        direction: 252
      },
    },
  },
  {
    name: 'Skydive Ries Dinkelsbuehl',
    lat: 49.06404,
    lng: 10.40007,
    country: 'Germany'
  },
  {
    name: 'Skydive Saulgau',
    lat: 48.02914,
    lng: 9.50493,
    country: 'Germany',
    website: 'https://www.skydive-saulgau.de/'
  },
  {
    name: 'Skydive Sebastian',
    lat: 27.81645,
    lng: -80.4995,
    direction: 180,
    region: 'Florida',
    country: 'United States',
    website: 'https://www.skydiveseb.com/',
    modes: {
      swoop: {
        lat: 27.81705,
        lng: -80.49839,
        direction: 135
      },
    },
  },
  {
    name: 'Skydive Sibson',
    lat: 52.5604,
    lng: -0.39576,
    direction: 230,
    town: 'Sibson',
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Sicilia',
    lat: 37.03029,
    lng: 15.24399,
    region: 'Sicilia',
    country: 'Italy',
    website: 'https://skydivesicilia.it/'
  },
  {
    name: 'Skydive Slavnica',
    lat: 48.99773,
    lng: 18.18851,
    country: 'Slovakia',
    website: 'https://www.skydiveslavnica.sk/'
  },
  {
    name: 'Skydive Snohomish',
    lat: 47.90611,
    lng: -122.10135,
    direction: 170,
    town: 'Snohomish',
    region: 'Washington',
    country: 'United States'
  },
  {
    name: 'Skydive Spa',
    lat: 50.4785,
    lng: 5.91272,
    country: 'Belgium',
    website: 'https://www.skydivespa.be/'
  },
  {
    name: 'Skydive Space Center',
    lat: 28.6206,
    lng: -80.83207,
    region: 'Florida',
    country: 'United States',
    website: 'https://www.skydivespacecenter.com/'
  },
  {
    name: 'Skydive Spaceland Atlanta',
    lat: 33.97696,
    lng: -85.16969,
    direction: 75,
    town: 'Rome',
    region: 'Georgia',
    country: 'United States',
    modes: {
      swoop: {
        lat: 33.97775,
        lng: -85.16761,
        direction: 250
      },
    },
  },
  {
    name: 'Skydive Spaceland Dallas',
    lat: 33.45054,
    lng: -96.37674,
    direction: 182,
    town: 'Whitewright',
    region: 'Texas',
    country: 'United States',
    website: 'https://dallas.skydivespaceland.com/',
    modes: {
      swoop: {
        lat: 33.44723,
        lng: -96.37707,
        direction: 2
      },
    },
  },
  {
    name: 'Skydive Spaceland Houston',
    lat: 29.35885,
    lng: -95.45801,
    town: 'Rosharon',
    region: 'Texas',
    country: 'United States',
    website: 'https://houston.skydivespaceland.com/',
    direction: 181,
    modes: {
      swoop: {
        lat: 29.35764,
        lng: -95.4618,
        direction: 151
      },
    },
  },
  {
    name: 'Skydive Spaceland San Marcos',
    lat: 29.77047,
    lng: -97.77156,
    town: 'San Marcos',
    region: 'Texas',
    country: 'United States',
    website: 'https://sanmarcos.skydivespaceland.com/',
    direction: 210,
    modes: {
      swoop: {
        lat: 29.77082,
        lng: -97.77366,
        direction: 50
      },
    },
  },
  {
    name: 'Skydive Spaceland-Clewiston',
    lat: 26.73563,
    lng: -81.04807,
    region: 'Florida',
    country: 'United States',
    website: 'https://skydivespaceland.com/'
  },
  {
    name: 'Skydive Spain',
    lat: 37.296,
    lng: -6.162,
    region: 'Andalusia',
    country: 'Spain'
  },
  {
    name: 'Skydive St Andrews',
    lat: 56.18419,
    lng: -3.21998,
    direction: 60,
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Stockholm',
    lat: 60.28415,
    lng: 17.42161,
    direction: 0,
    town: 'Gryttjom',
    region: 'Uppsala',
    country: 'Sweden',
    website: 'https://skydive.se/',
    modes: {
      swoop: {
        lat: 60.28548,
        lng: 17.42649,
        direction: 180
      },
    },
  },
  {
    name: 'Skydive Strathallan',
    lat: 56.32555,
    lng: -3.74849,
    direction: 95,
    region: 'Scotland',
    country: 'United Kingdom',
    website: 'https://skydivestrathallan.co.uk/'
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
    name: 'Skydive Sussex',
    lat: 41.19949,
    lng: -74.62508,
    direction: 20,
    region: 'New Jersey',
    country: 'United States',
    website: 'https://www.skydivesussex.com/'
  },
  {
    name: 'Skydive Swansea',
    lat: 51.60423,
    lng: -4.06926,
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Switzerland',
    lat: 46.61551,
    lng: 7.68111,
    direction: 215,
    country: 'Switzerland',
    website: 'https://www.skydiveswitzerland.com/'
  },
  {
    name: 'Skydive Sydney - Newcastle',
    lat: -33.06595,
    lng: 151.64933,
    direction: 264,
    region: 'New South Wales',
    country: 'Australia'
  },
  {
    name: 'Skydive Taroudant',
    lat: 30.50081,
    lng: -8.82528,
    direction: 253,
    country: 'Morocco',
    website: 'https://www.skydivetaroudant.com/'
  },
  {
    name: 'Skydive Tauranga',
    lat: -37.66967,
    lng: 176.19329,
    direction: 239,
    country: 'New Zealand'
  },
  {
    name: 'Skydive Tecumseh',
    lat: 42.16967,
    lng: -84.2628,
    region: 'Michigan',
    country: 'United States',
    website: 'https://www.skydivetecumseh.com/'
  },
  {
    name: 'Skydive Temora',
    lat: -34.42399,
    lng: 147.51409,
    country: 'Australia'
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
    lat: 52.24651,
    lng: 6.04902,
    direction: 90,
    town: 'Teuge',
    country: 'Netherlands'
  },
  {
    name: 'Skydive Thailand',
    lat: 19.1488,
    lng: 98.98847,
    direction: 267,
    country: 'Thailand',
    website: 'https://www.skydivethailand.com/'
  },
  {
    name: 'Skydive The Ranch',
    lat: 41.67515,
    lng: -74.1502,
    direction: 293,
    town: 'Gardiner',
    region: 'New York',
    country: 'United States',
    modes: {
      swoop: {
        lat: 41.67406,
        lng: -74.14726,
        direction: 293
      },
    },
  },
  {
    name: 'Skydive Thiene',
    lat: 45.67254,
    lng: 11.49562,
    direction: 354,
    country: 'Italy',
    website: 'https://www.skydivethiene.it/'
  },
  {
    name: 'Skydive Tilstock',
    lat: 52.93223,
    lng: -2.64475,
    direction: 145,
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Toledo',
    lat: 46.47783,
    lng: -122.81297,
    direction: 80,
    region: 'Washington',
    country: 'United States',
    website: 'https://www.skydivetoledo.com/'
  },
  {
    name: 'Skydive Twin Cities',
    lat: 44.96601,
    lng: -92.39057,
    direction: 183,
    region: 'Wisconsin',
    country: 'United States',
    website: 'https://www.skydivetwincities.com/'
  },
  {
    name: 'Skydive Uluru',
    lat: -25.18185,
    lng: 130.97577,
    country: 'Australia'
  },
  {
    name: 'Skydive Utah',
    lat: 40.61014,
    lng: -112.35378,
    direction: 1,
    region: 'Utah',
    country: 'United States'
  },
  {
    name: 'Skydive Vaasa',
    lat: 63.04052,
    lng: 21.77327,
    region: 'Österbotten',
    country: 'Finland'
  },
  {
    name: 'Skydive Valladolid',
    lat: 41.53198,
    lng: -4.92215,
    direction: 70,
    region: 'Castilla y León',
    country: 'Spain'
  },
  {
    name: 'Skydive Vancouver',
    lat: 49.09545,
    lng: -122.31247,
    direction: 225,
    region: 'British Columbia',
    country: 'Canada',
    website: 'https://www.skydivevancouver.com/'
  },
  {
    name: 'Skydive Venice',
    lat: 45.69929,
    lng: 12.76374,
    direction: 323,
    region: 'Veneto',
    country: 'Italy',
    website: 'https://www.skydive-venice.com/',
    modes: {
      swoop: {
        lat: 45.69849,
        lng: 12.76257,
        direction: 83
      },
    },
  },
  {
    name: 'Skydive Victoria Corowa',
    lat: -35.99171,
    lng: 146.35594,
    direction: 144,
    country: 'Australia'
  },
  {
    name: 'Skydive Vila Real',
    lat: 41.27674,
    lng: -7.71744,
    country: 'Portugal'
  },
  {
    name: 'Skydive Voss',
    lat: 60.63951,
    lng: 6.50354,
    direction: 85,
    town: 'Voss',
    country: 'Norway'
  },
  {
    name: 'Skydive Wanaka',
    lat: -44.72163,
    lng: 169.24993,
    direction: 144,
    region: 'Otago',
    country: 'New Zealand'
  },
  {
    name: 'Skydive Wellington',
    lat: -40.97201,
    lng: 175.64038,
    country: 'New Zealand'
  },
  {
    name: 'Skydive West Plains',
    lat: 47.16,
    lng: -118.292,
    region: 'Washington',
    country: 'United States'
  },
  {
    name: 'Skydive Yarra Valley',
    lat: -37.69495,
    lng: 145.36899,
    direction: 247,
    region: 'Victoria',
    country: 'Australia'
  },
  {
    name: 'St Florentin Sports Parachutisme',
    lat: 47.98291,
    lng: 3.77646,
    direction: 73,
    country: 'France'
  },
  {
    name: 'Start Skydiving',
    lat: 39.53374,
    lng: -84.39927,
    direction: 84,
    town: 'Middletown',
    region: 'Ohio',
    country: 'United States'
  },
  {
    name: 'Sundsvalls Fallskärmsklubb',
    lat: 62.38812,
    lng: 17.45096,
    country: 'Sweden'
  },
  {
    name: 'Sydney Skydivers',
    lat: -34.22116,
    lng: 150.67108,
    direction: 215,
    region: 'New South Wales',
    country: 'Australia',
    website: 'https://www.sydneyskydivers.com.au/',
    modes: {
      swoop: {
        lat: -34.22342,
        lng: 150.67178,
        direction: 30
      },
    },
  },
  {
    name: 'Tandem Cairns',
    lat: -17.07107,
    lng: 145.42892,
    country: 'Australia'
  },
  {
    name: 'Texas Skydiving',
    lat: 30.41602,
    lng: -96.96657,
    direction: 171,
    town: 'Lexington',
    region: 'Texas',
    country: 'United States',
    modes: {
      swoop: {
        lat: 30.41739,
        lng: -96.96622,
        direction: 166
      },
    },
  },
  {
    name: 'Thai Sky Adventures, Ltd.',
    lat: 13.14125,
    lng: 101.04679,
    direction: 58,
    country: 'Thailand',
    website: 'https://www.thaiskyadventures.com/'
  },
  {
    name: 'TNT-Brothers Dropzone',
    lat: 44.35805,
    lng: 25.93,
    direction: 257,
    country: 'Romania',
    website: 'https://www.tnt-brothers.ro/'
  },
  {
    name: 'Tournus Cuisery Parachutisme',
    lat: 46.56243,
    lng: 4.97634,
    direction: 52,
    country: 'France'
  },
  {
    name: 'Triangle Skydiving Center',
    lat: 36.026,
    lng: -78.329,
    region: 'North Carolina',
    country: 'United States'
  },
  {
    name: 'Vannes Parachutisme',
    lat: 47.72554,
    lng: -2.72459,
    direction: 85,
    country: 'France'
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
    name: 'Vzone S.S.D.',
    lat: 45.31079,
    lng: 8.42176,
    direction: 85,
    country: 'Italy',
    website: 'https://www.vzone.it/'
  },
  {
    name: 'West Jump Denmark',
    lat: 56.551,
    lng: 9.168,
    direction: 318,
    country: 'Denmark'
  },
  {
    name: 'West Tennessee Skydiving',
    lat: 35.22061,
    lng: -89.1887,
    region: 'Tennessee',
    country: 'United States',
    direction: 182,
    nearbyStations: ['KM08'], // Bolivar/Whitehurst Field AWOS — not in NWS gridpoints
    modes: {
      swoop: {
        lat: 35.22063,
        lng: -89.18982,
        direction: 182
      },
    },
  },
  {
    name: 'Whistler Skydiving Pemberton',
    lat: 50.30251,
    lng: -122.73884,
    country: 'Canada'
  },
  {
    name: 'Wild Geese Skydiving Centre',
    lat: 54.98824,
    lng: -6.64391,
    region: 'Northern Ireland',
    country: 'United Kingdom'
  },
  {
    name: 'Wisconsin Skydiving Center',
    lat: 42.962,
    lng: -88.818,
    direction: 214,
    town: 'East Troy',
    region: 'Wisconsin',
    country: 'United States'
  },
  {
    name: 'Xielo Skydive',
    lat: 4.37067,
    lng: -74.73673,
    region: 'Cundinamarca',
    country: 'Colombia',
    website: 'https://www.xielo.co/'
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
