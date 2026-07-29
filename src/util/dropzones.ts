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
    name: '321 Chutelibre',
    lat: 48.34066,
    lng: 2.79611,
    country: 'France'
  },
  {
    name: 'Abu Dhabi Skydive',
    lat: 24.72669,
    lng: 54.83057,
    region: 'Al Smeih Area',
    country: 'United Arab Emirates',
    website: 'https://www.abudhabiskydive.com/'
  },
  {
    name: 'Aero Fallschirmsport Kassel Calden',
    lat: 51.41658,
    lng: 9.38613,
    country: 'Germany'
  },
  {
    name: 'Aerohio Skydiving Center',
    lat: 40.89722,
    lng: -82.25734,
    region: 'Ohio',
    country: 'United States',
    website: 'https://www.aerohio.com/'
  },
  {
    name: 'Aeroklub Bialostocki',
    lat: 53.1324,
    lng: 23.15917,
    town: 'Białystok',
    country: 'Poland'
  },
  {
    name: 'Aeroklub Elblaski',
    lat: 54.15587,
    lng: 19.40446,
    town: 'Elbląg',
    country: 'Poland'
  },
  {
    name: 'Aeroklub Gliwicki',
    lat: 50.30113,
    lng: 18.66235,
    town: 'Gliwice',
    country: 'Poland'
  },
  {
    name: 'Aeroklub Rzeszowski',
    lat: 51.94983,
    lng: 19.39077,
    town: 'Jasionka',
    country: 'Poland'
  },
  {
    name: 'Aeroklub Warszawski Skydive Warszawa',
    lat: 52.57273,
    lng: 20.861,
    town: 'Chrcynno',
    country: 'Poland'
  },
  {
    name: 'Air Libre Parachutisme Dieppe',
    lat: 49.88451,
    lng: 1.08378,
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
    lat: 43.50297,
    lng: 5.37341,
    country: 'France'
  },
  {
    name: 'Amiens Parachutisme',
    lat: 49.87256,
    lng: 2.38527,
    country: 'France'
  },
  {
    name: 'Århus Faldskærm Club',
    lat: 56.313,
    lng: 10.615,
    country: 'Denmark'
  },
  {
    name: 'Australian Skydive Bridgewater',
    lat: -36.60102,
    lng: 143.94147,
    town: 'Bridgewater on Loddon',
    country: 'Australia'
  },
  {
    name: 'Avignon Pujaut',
    lat: 43.99604,
    lng: 4.75486,
    country: 'France'
  },
  {
    name: 'Bay Area Skydiving',
    lat: 37.83516,
    lng: -121.63264,
    region: 'California',
    country: 'United States',
    website: 'https://www.bayareaskydiving.com/'
  },
  {
    name: 'Beccles Skydivers',
    lat: 52.43537,
    lng: 1.61868,
    country: 'United Kingdom'
  },
  {
    name: 'Beni Mellal DZ',
    lat: 32.42887,
    lng: -6.33518,
    country: 'Morocco',
    website: 'https://www.pacma.ma/'
  },
  {
    name: 'Black Knights Skydiving Centre',
    lat: 53.96328,
    lng: -2.83584,
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Cahors Parachutisme',
    lat: 44.35213,
    lng: 1.47516,
    country: 'France'
  },
  {
    name: 'Capital City Skydiving Campbell River',
    lat: 49.9541,
    lng: -125.27572,
    country: 'Canada'
  },
  {
    name: 'Centre ecole parachutisme Laval',
    lat: 48.03213,
    lng: -0.74324,
    country: 'France'
  },
  {
    name: 'Centre Europeen de Chute Libre Lapalisse',
    lat: 46.25369,
    lng: 3.59,
    country: 'France'
  },
  {
    name: 'Centro Paracaidismo Pirineos Jaca',
    lat: 42.5692,
    lng: -0.72778,
    country: 'Spain'
  },
  {
    name: 'CEPS Ariege Pamiers',
    lat: 43.09074,
    lng: 1.69831,
    country: 'France'
  },
  {
    name: 'Chattanooga Skydiving Company',
    lat: 35.06067,
    lng: -85.58531,
    region: 'Tennessee',
    country: 'United States',
    website: 'https://www.chattanoogaskydivingcompany.com/'
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
    name: 'Chute Libre Dordogne',
    lat: 45.1973,
    lng: 0.81459,
    country: 'France'
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
    name: 'Complete Parachute Solutions Bishop',
    lat: 33.75565,
    lng: -111.44427,
    region: 'Arizona',
    country: 'United States',
    website: 'https://www.cpsworld.com/'
  },
  {
    name: 'Connecticut Parachutists, Inc.',
    lat: 41.92542,
    lng: -72.45711,
    region: 'Connecticut',
    country: 'United States',
    website: 'https://www.skydivect.com/'
  },
  {
    name: 'Cornish Parachute Club',
    lat: 50.33126,
    lng: -5.17836,
    country: 'United Kingdom'
  },
  {
    name: 'Darwin Parachute Club',
    lat: -12.63466,
    lng: 131.07469,
    town: 'Noonamah',
    country: 'Australia'
  },
  {
    name: 'DreamFly',
    lat: 38.77618,
    lng: -9.33964,
    country: 'Portugal'
  },
  {
    name: 'Dropzone Ceska Lipa',
    lat: 50.70922,
    lng: 14.56603,
    country: 'Czech Republic'
  },
  {
    name: 'Dropzone Denmark',
    lat: 56.184,
    lng: 9.031,
    country: 'Denmark'
  },
  {
    name: 'Dropzone Most',
    lat: 50.52515,
    lng: 13.68199,
    country: 'Czech Republic'
  },
  {
    name: 'Dropzone Prostejov',
    lat: 49.44521,
    lng: 17.13065,
    country: 'Czech Republic',
    website: 'https://www.dropzoneprostejov.com/'
  },
  {
    name: 'Dunkerque Parachutisme',
    lat: 51.03966,
    lng: 2.54915,
    country: 'France'
  },
  {
    name: 'DZ Pribram',
    lat: 49.71608,
    lng: 14.09464,
    country: 'Czech Republic',
    website: 'https://skycentrum.com/'
  },
  {
    name: 'École de Parachutisme de Lyon Corbas',
    lat: 45.65814,
    lng: 4.91378,
    region: 'Auvergne-Rhône-Alpes',
    country: 'France',
    website: 'https://parachutisme-lyon.fr/'
  },
  {
    name: 'Ecole de Parachutisme du Valinco',
    lat: 41.66003,
    lng: 8.89374,
    country: 'France'
  },
  {
    name: 'Ecole de Parachutisme Nord Franche-Comte',
    lat: 47.70259,
    lng: 6.54805,
    country: 'France'
  },
  {
    name: 'EFPLB Lille Bondues',
    lat: 50.68725,
    lng: 3.0859,
    country: 'France'
  },
  {
    name: 'EPCOL Orleans',
    lat: 47.89938,
    lng: 2.16655,
    country: 'France'
  },
  {
    name: 'EPSBA Arcachon',
    lat: 44.59781,
    lng: -1.11398,
    country: 'France'
  },
  {
    name: 'ERP Granville',
    lat: 48.83763,
    lng: -1.59592,
    town: 'Granville',
    country: 'France'
  },
  {
    name: 'Euroa Skydive – The Parachute School',
    lat: -36.74381,
    lng: 145.5158,
    region: 'Victoria',
    country: 'Australia',
    website: 'https://www.skydivingmelbourne.com.au/'
  },
  {
    name: 'Faldskærmsklubben DFC',
    lat: 55.34383,
    lng: 12.11057,
    region: 'Region Sjælland',
    country: 'Denmark'
  },
  {
    name: 'Fallschirmsport Damme',
    lat: 52.48855,
    lng: 8.1849,
    region: 'Niedersachsen',
    country: 'Germany'
  },
  {
    name: 'Fallschirmsprungzentrum Mitteldeutschland',
    lat: 51.87403,
    lng: 11.38828,
    town: 'Cochstedt',
    country: 'Germany'
  },
  {
    name: 'Fano Sky Team S.S.D.',
    lat: 43.82733,
    lng: 13.03409,
    country: 'Italy',
    website: 'https://www.skydivefano.com/'
  },
  {
    name: 'Firebird Skydiving Bitburg',
    lat: 49.95061,
    lng: 6.5761,
    country: 'Germany'
  },
  {
    name: 'FlyFast Zamosc',
    lat: 50.72125,
    lng: 23.25958,
    town: 'Zamość',
    country: 'Poland'
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
    lat: 49.03091,
    lng: 7.99106,
    country: 'Germany',
    website: 'https://www.fsc-suedpfalz.de/'
  },
  {
    name: 'Fun Parachutisme Albi',
    lat: 43.91423,
    lng: 2.11878,
    country: 'France'
  },
  {
    name: 'Gaokongshijie Skydiving Base',
    lat: 21.95834,
    lng: 112.11014,
    region: 'Guangdong Province',
    country: 'China'
  },
  {
    name: 'GoJump Hawaii',
    lat: 21.65357,
    lng: -158.2063,
    region: 'Hawaii',
    country: 'United States',
    website: 'https://www.gojump-america.com/'
  },
  {
    name: 'GoJump Las Vegas LLC',
    lat: 35.76827,
    lng: -115.32964,
    region: 'Nevada',
    country: 'United States',
    website: 'https://www.gojump.vegas/'
  },
  {
    name: 'GoJump New York',
    lat: 40.81533,
    lng: -72.86603,
    region: 'New York',
    country: 'United States',
    website: 'https://gojump-newyork.com/'
  },
  {
    name: 'GoJump Oceanside',
    lat: 33.21715,
    lng: -117.35231,
    region: 'California',
    country: 'United States',
    website: 'https://www.gojump-oceanside.com/'
  },
  {
    name: 'Gotlands Fallskärmsklubb',
    lat: 57.64811,
    lng: 18.32698,
    country: 'Sweden',
    website: 'https://gotland.com/companies/gotlands-fallskarmsklubb/'
  },
  {
    name: 'Gravity Skydive',
    lat: 14.01387,
    lng: -90.77103,
    country: 'Guatemala',
    website: 'https://www.gravity.com.gt/'
  },
  {
    name: 'HLF Denmark',
    lat: 56.396,
    lng: 8.442,
    country: 'Denmark'
  },
  {
    name: 'Hosin Ceske Budejovice Skysurf',
    lat: 49.03959,
    lng: 14.49214,
    country: 'Czech Republic'
  },
  {
    name: 'Irish Parachute Club, Ltd.',
    lat: 53.2336,
    lng: -7.1168,
    country: 'Ireland',
    website: 'https://www.skydive.ie/'
  },
  {
    name: 'iSkydive America – Miami',
    lat: 25.49923,
    lng: -80.55424,
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
    lat: -26.36972,
    lng: 27.35217,
    region: 'Gauteng',
    country: 'South Africa'
  },
  {
    name: 'Jump Club Krems',
    lat: 48.44608,
    lng: 15.62897,
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
    lat: 32.65,
    lng: -81.598,
    region: 'Georgia',
    country: 'United States'
  },
  {
    name: 'Jump TN',
    lat: 36.19601,
    lng: -82.81099,
    region: 'Tennessee',
    country: 'United States',
    website: 'https://www.jumptn.com/'
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
    name: 'Krutitcy',
    lat: 54.27618,
    lng: 40.81746,
    country: 'Russian Federation',
    website: 'https://www.dzk-resort.com/'
  },
  {
    name: 'Kunovice OK Boogie',
    lat: 49.0329,
    lng: 17.4414,
    country: 'Czech Republic'
  },
  {
    name: 'Kuwait Skydive',
    lat: 28.60255,
    lng: 48.30974,
    country: 'Kuwait',
    website: 'https://kuwaitskydiveco.com/'
  },
  {
    name: 'La Rochelle Parachutisme',
    lat: 46.1777,
    lng: -1.18973,
    country: 'France'
  },
  {
    name: 'Lens Parachutisme',
    lat: 50.46607,
    lng: 2.82142,
    country: 'France'
  },
  {
    name: 'Lons le Saunier Parachutisme',
    lat: 46.67442,
    lng: 5.46932,
    country: 'France'
  },
  {
    name: 'Maubeuge Parachutisme',
    lat: 50.31092,
    lng: 4.0326,
    country: 'France'
  },
  {
    name: 'Meido Skydive',
    lat: 52.71309,
    lng: 9.87313,
    region: 'Niedersachsen',
    country: 'Germany',
    website: 'https://www.meido.de/'
  },
  {
    name: 'Midwest Freefall Sport Parachute Club, Inc.',
    lat: 42.75956,
    lng: -82.94168,
    region: 'Michigan',
    country: 'United States',
    website: 'https://www.midwestfreefall.com/'
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
    name: 'Music City Skydiving',
    lat: 36.11186,
    lng: -87.74158,
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
    lat: 51.245,
    lng: -1.764,
    town: 'Netheravon',
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Newcastle Sport Parachute Club Elderslie',
    lat: -34.05903,
    lng: 150.7154,
    town: 'Elderslie',
    country: 'Australia'
  },
  {
    name: 'Nimes Courbessac Parachutisme',
    lat: 43.85388,
    lng: 4.41507,
    country: 'France'
  },
  {
    name: 'NorCal Skydiving',
    lat: 38.77288,
    lng: -122.99271,
    region: 'California',
    country: 'United States'
  },
  {
    name: 'Normandie Belleme ULM',
    lat: 48.37536,
    lng: 0.56294,
    town: 'Bellême',
    country: 'France'
  },
  {
    name: 'NZOne Skydive',
    lat: -45.03122,
    lng: 168.6597,
    region: 'Otago',
    country: 'New Zealand',
    website: 'https://www.nzoneskydive.co.nz/'
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
    lat: 50.24658,
    lng: -119.32819,
    country: 'Canada'
  },
  {
    name: 'Olimpic Skydive Wroclaw',
    lat: 50.95515,
    lng: 16.76772,
    country: 'Poland'
  },
  {
    name: 'Pacific Northwest Skydiving Center',
    lat: 45.21816,
    lng: -122.58878,
    region: 'Oregon',
    country: 'United States',
    website: 'https://www.pnwskydiving.com/'
  },
  {
    name: 'Para 71 Chalon-sur-Saone',
    lat: 46.82679,
    lng: 4.82502,
    country: 'France'
  },
  {
    name: 'Paracaidismo Galicia Galsur',
    lat: 42.92795,
    lng: -8.99414,
    town: 'Mazaricos',
    country: 'Spain'
  },
  {
    name: 'Paracentro Roma',
    lat: 41.88457,
    lng: 12.71334,
    region: 'Lazio',
    country: 'Italy'
  },
  {
    name: 'Paracentrum Texel',
    lat: 53.11818,
    lng: 4.82774,
    country: 'Netherlands',
    website: 'https://www.paracentrumtexel.nl/'
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
    name: 'Parachute Montreal Rive-Nord',
    lat: 45.91116,
    lng: -73.67241,
    region: 'Quebec',
    country: 'Canada',
    website: 'https://www.parachutemontreal.ca/'
  },
  {
    name: 'Parachute Ottawa',
    lat: 45.46049,
    lng: -75.64412,
    country: 'Canada'
  },
  {
    name: 'Parachute School of Toronto',
    lat: 44.26373,
    lng: -79.33951,
    region: 'Ontario',
    country: 'Canada',
    website: 'https://www.parachuteschool.com/'
  },
  {
    name: 'Parachute Victoriaville',
    lat: 46.11545,
    lng: -71.92454,
    region: 'Quebec',
    country: 'Canada',
    website: 'https://www.paravic.com/'
  },
  {
    name: 'Parachutisme 38 Grenoble',
    lat: 45.21822,
    lng: 5.8482,
    country: 'France'
  },
  {
    name: 'Parachutisme 42 Saint Galmier',
    lat: 45.60637,
    lng: 4.30362,
    country: 'France'
  },
  {
    name: 'Parachutisme Adrenaline Trois-Rivieres',
    lat: 46.36547,
    lng: -72.67565,
    region: 'Quebec',
    country: 'Canada',
    website: 'https://www.parachute3r.ca/'
  },
  {
    name: 'Parachutisme Besancon',
    lat: 47.20694,
    lng: 6.08281,
    country: 'France'
  },
  {
    name: 'Paraclub Agenais',
    lat: 44.17396,
    lng: 0.59331,
    country: 'France'
  },
  {
    name: 'Paraklub Jihlava',
    lat: 49.41431,
    lng: 15.63706,
    town: 'Henčov',
    country: 'Czech Republic'
  },
  {
    name: 'Paraklub Nove Mesto nad Metuji',
    lat: 50.35343,
    lng: 16.12143,
    country: 'Czech Republic'
  },
  {
    name: 'Paris Parachutisme Fretoy le Chateau',
    lat: 49.67005,
    lng: 2.96777,
    country: 'France'
  },
  {
    name: 'Pau Parachutisme Passion',
    lat: 43.37914,
    lng: -0.41643,
    country: 'France'
  },
  {
    name: 'Pepperell Skydiving Center',
    lat: 42.69862,
    lng: -71.55006,
    region: 'Massachusetts',
    country: 'United States',
    website: 'https://www.skyjump.com/'
  },
  {
    name: 'Piedmont Skydiving',
    lat: 35.64831,
    lng: -80.51749,
    region: 'North Carolina',
    country: 'United States',
    website: 'https://piedmontskydiving.com/'
  },
  {
    name: 'Pinjarra Skydiving Airstrip',
    lat: -32.66481,
    lng: 115.88244,
    region: 'Western Australia',
    country: 'Australia'
  },
  {
    name: 'Przasnysz Skoczek',
    lat: 53.01829,
    lng: 20.88456,
    town: 'Przasnysz',
    country: 'Poland'
  },
  {
    name: 'SA Skydiving Murray Bridge',
    lat: -35.06475,
    lng: 139.22395,
    country: 'Australia'
  },
  {
    name: 'Saltamos - SkydiveBCN',
    lat: 41.76414,
    lng: 1.86374,
    region: 'Catalunya',
    country: 'Spain',
    website: 'https://skydivebcn.com'
  },
  {
    name: 'Saumur Parachutisme',
    lat: 47.25806,
    lng: -0.1164,
    country: 'France'
  },
  {
    name: 'Seven Hills Skydivers',
    lat: 43.258,
    lng: -89.065,
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
    name: 'Sissonne Parachutisme',
    lat: 49.57299,
    lng: 3.89279,
    town: 'Sissonne',
    country: 'France'
  },
  {
    name: 'Skoczek Nowy Targ',
    lat: 49.48921,
    lng: 20.02634,
    town: 'Nowy Targ',
    country: 'Poland'
  },
  {
    name: 'Sky Company Clube e Escola de Paraquedismo',
    lat: -23.29543,
    lng: -47.69083,
    country: 'Brazil',
    website: 'https://www.paraquedismoskycompany.com.br/'
  },
  {
    name: 'Sky Down Skydiving',
    lat: 43.642,
    lng: -116.636,
    region: 'Idaho',
    country: 'United States'
  },
  {
    name: 'Sky Kef',
    lat: 31.28669,
    lng: 34.72425,
    country: 'Israel',
    website: 'https://www.skykef.co.il/'
  },
  {
    name: 'Sky Service Skydive Prague',
    lat: 50.12779,
    lng: 14.51587,
    country: 'Czech Republic'
  },
  {
    name: 'Sky4 Pombal',
    lat: 39.88561,
    lng: -8.64993,
    country: 'Portugal'
  },
  {
    name: 'Skydive 12 Apostles Peterborough',
    lat: -38.60612,
    lng: 142.87702,
    town: 'Peterborough',
    country: 'Australia'
  },
  {
    name: 'Skydive Abel Tasman',
    lat: -41.12042,
    lng: 172.99293,
    region: 'Tasman',
    country: 'New Zealand'
  },
  {
    name: 'Skydive Adelaide',
    lat: -35.29594,
    lng: 139.03645,
    town: 'Langhorne Creek',
    country: 'Australia'
  },
  {
    name: 'Skydive Aircruz-Totana',
    lat: 37.75247,
    lng: -1.4493,
    country: 'Spain',
    website: 'https://skydiveaircruz.com/'
  },
  {
    name: 'Skydive Alabama',
    lat: 34.267,
    lng: -86.863,
    region: 'Alabama',
    country: 'United States'
  },
  {
    name: 'Skydive Algarve',
    lat: 37.14748,
    lng: -8.58122,
    country: 'Portugal',
    website: 'https://www.skydivealgarve.com/'
  },
  {
    name: 'Skydive Andes',
    lat: -33.67727,
    lng: -71.11043,
    country: 'Chile',
    website: 'https://www.skydiveandes.com/'
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
    name: 'Skydive Auckland',
    lat: -36.65181,
    lng: 174.43553,
    region: 'Auckland',
    country: 'New Zealand'
  },
  {
    name: 'Skydive Bad Lippspringe',
    lat: 51.78844,
    lng: 8.78713,
    country: 'Germany'
  },
  {
    name: 'Skydive Benghazi',
    lat: 31.97593,
    lng: 20.02693,
    country: 'Libya',
    website: 'https://skydivebenghazi.com/'
  },
  {
    name: 'Skydive Bovec',
    lat: 46.32861,
    lng: 13.54861,
    country: 'Slovenia',
    website: 'https://www.skydivebovec.com/'
  },
  {
    name: 'Skydive Braga',
    lat: 41.5863,
    lng: -8.44541,
    country: 'Portugal'
  },
  {
    name: 'Skydive Bragança Galsur',
    lat: 41.85778,
    lng: -6.7069,
    country: 'Portugal'
  },
  {
    name: 'Skydive Breclav',
    lat: 48.79127,
    lng: 16.89198,
    country: 'Czech Republic'
  },
  {
    name: 'Skydive Buckeye',
    lat: 33.4204,
    lng: -112.6862,
    region: 'Arizona',
    country: 'United States',
    website: 'https://skydivebuckeye.com/'
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
    name: 'Skydive Burnaby Inc.',
    lat: 42.87784,
    lng: -79.35299,
    region: 'Ontario',
    country: 'Canada',
    website: 'https://www.skydiveburnaby.com/'
  },
  {
    name: 'Skydive Byron Bay',
    lat: -28.59468,
    lng: 153.54696,
    region: 'New South Wales',
    country: 'Australia',
    website: 'https://www.skydive.com.au/byron-bay/'
  },
  {
    name: 'Skydive Canberra',
    lat: -35.41427,
    lng: 149.44944,
    town: 'Hoskinstown',
    country: 'Australia'
  },
  {
    name: 'Skydive Capricorn',
    lat: -23.37821,
    lng: 150.51342,
    town: 'Rockhampton',
    country: 'Australia'
  },
  {
    name: 'Skydive Caribbean',
    lat: 10.46376,
    lng: -66.09553,
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
    lat: 39.99837,
    lng: 0.02645,
    country: 'Spain'
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
    name: 'Skydive Coastal Carolinas',
    lat: 33.93081,
    lng: -78.07336,
    region: 'North Carolina',
    country: 'United States',
    website: 'https://www.skydivecoastalcarolinas.com/'
  },
  {
    name: 'Skydive Colorado Springs',
    lat: 38.427,
    lng: -105.105,
    region: 'Colorado',
    country: 'United States'
  },
  {
    name: 'Skydive Costa D\'Argento',
    lat: 42.49546,
    lng: 11.23892,
    country: 'Italy',
    website: 'https://www.skydivecostadargento.com/'
  },
  {
    name: 'Skydive Cross Keys',
    lat: 39.70548,
    lng: -75.033,
    region: 'New Jersey',
    country: 'United States',
    website: 'https://www.skydivecrosskeys.com/'
  },
  {
    name: 'Skydive Cuautla',
    lat: 18.69891,
    lng: -98.88979,
    country: 'Mexico',
    website: 'https://www.skydivecuautla.com/'
  },
  {
    name: 'Skydive Danielson',
    lat: 41.81974,
    lng: -71.90096,
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
    name: 'Skydive Deluxe Freiburg',
    lat: 47.91746,
    lng: 7.62388,
    town: 'Bremgarten',
    country: 'Germany'
  },
  {
    name: 'Skydive Diani',
    lat: -4.36992,
    lng: 39.55744,
    region: 'Kwale',
    country: 'Kenya',
    website: 'https://www.skydivediani.com/'
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
    name: 'Skydive Egypt - Jump Like A Pharaoh',
    lat: 30.1121,
    lng: 31.40075,
    country: 'Egypt',
    website: 'https://www.skydiveegypt.info/'
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
    name: 'Skydive Estonia',
    lat: 59.41169,
    lng: 24.74243,
    country: 'Estonia',
    website: 'https://www.skydive.ee/'
  },
  {
    name: 'Skydive Fehrbellin',
    lat: 52.79424,
    lng: 12.76087,
    region: 'Brandenburg',
    country: 'Germany'
  },
  {
    name: 'Skydive Finland',
    lat: 60.89785,
    lng: 26.91936,
    region: 'Kymenlaakso',
    country: 'Finland',
    website: 'https://www.skydivefinland.fi'
  },
  {
    name: 'Skydive Finsterwalde',
    lat: 51.63153,
    lng: 13.70736,
    town: 'Finsterwalde',
    country: 'Germany'
  },
  {
    name: 'Skydive Flanders dropzone Moorsele',
    lat: 50.84872,
    lng: 3.14651,
    region: 'West-Vlaanderen',
    country: 'Belgium',
    website: 'https://www.pcv.be/'
  },
  {
    name: 'Skydive FlyGang F4F DZone',
    lat: 44.59778,
    lng: 11.65389,
    country: 'Italy',
    website: 'https://www.skydiveflygang.com/'
  },
  {
    name: 'Skydive Franz Josef and Fox Glacier',
    lat: -43.36158,
    lng: 170.13197,
    country: 'New Zealand'
  },
  {
    name: 'Skydive Gananoque',
    lat: 44.40112,
    lng: -76.24286,
    country: 'Canada'
  },
  {
    name: 'Skydive Gap Tallard',
    lat: 44.4543,
    lng: 6.03819,
    region: 'Provence-Alpes-Côte d\'Azur',
    country: 'France'
  },
  {
    name: 'Skydive GB',
    lat: 54.08224,
    lng: -0.19086,
    country: 'United Kingdom'
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
    lat: 43.035,
    lng: -86.2,
    town: 'Grand Haven',
    region: 'Michigan',
    country: 'United States'
  },
  {
    name: 'Skydive Great Ocean Road',
    lat: -38.25924,
    lng: 144.42892,
    region: 'Victoria',
    country: 'Australia'
  },
  {
    name: 'Skydive Headcorn',
    lat: 51.15635,
    lng: 0.64191,
    region: 'England',
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Hel',
    lat: 54.62371,
    lng: 18.7275,
    town: 'Hel',
    country: 'Poland'
  },
  {
    name: 'Skydive Hervey Bay',
    lat: -25.31963,
    lng: 152.87757,
    country: 'Australia'
  },
  {
    name: 'Skydive Hinton',
    lat: 52.03012,
    lng: -1.21025,
    region: 'England',
    country: 'United Kingdom',
    website: 'https://www.skydive.co.uk/'
  },
  {
    name: 'Skydive Hoogeveen',
    lat: 52.73216,
    lng: 6.52105,
    region: 'Drenthe',
    country: 'Netherlands',
    website: 'https://skydivehoogeveen.nl/'
  },
  {
    name: 'Skydive Hunter Valley',
    lat: -32.60906,
    lng: 151.19542,
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
    name: 'Skydive Ireland',
    lat: 55.13159,
    lng: -6.67186,
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Iseo',
    lat: 45.81514,
    lng: 10.09552,
    region: 'Lombardia',
    country: 'Italy',
    website: 'https://skydiveiseo.it/'
  },
  {
    name: 'Skydive Jeffreys Bay',
    lat: -33.96682,
    lng: 24.94379,
    region: 'Eastern Cape',
    country: 'South Africa'
  },
  {
    name: 'Skydive Jerez',
    lat: 36.62949,
    lng: -6.01826,
    country: 'Spain'
  },
  {
    name: 'Skydive Jersey',
    lat: 49.20656,
    lng: -2.18467,
    country: 'Jersey'
  },
  {
    name: 'Skydive Jurien Bay',
    lat: -30.30318,
    lng: 115.05439,
    country: 'Australia'
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
    lat: 38.28978,
    lng: -94.34014,
    region: 'Missouri',
    country: 'United States',
    website: 'https://www.skydivekc.com/'
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
    name: 'Skydive Karjala',
    lat: 61.24827,
    lng: 28.89576,
    region: 'Etelä-Karjala',
    country: 'Finland'
  },
  {
    name: 'Skydive Key West',
    lat: 24.64833,
    lng: -81.57315,
    region: 'Florida',
    country: 'United States',
    website: 'https://skydivekeywest.com/'
  },
  {
    name: 'Skydive Kiel',
    lat: 54.3725,
    lng: 10.13617,
    town: 'Holtenau',
    country: 'Germany'
  },
  {
    name: 'Skydive Konstanz',
    lat: 47.6818,
    lng: 9.13796,
    country: 'Germany'
  },
  {
    name: 'Skydive Krakow',
    lat: 50.0822,
    lng: 20.20545,
    town: 'Pobiednik Wielki',
    country: 'Poland'
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
    name: 'Skydive Latvia',
    lat: 57.4855,
    lng: 24.67104,
    country: 'Latvia',
    website: 'https://www.skydive.lv/'
  },
  {
    name: 'Skydive Leipzig Loebnitz',
    lat: 51.57848,
    lng: 12.50071,
    country: 'Germany'
  },
  {
    name: 'Skydive Leon',
    lat: 42.58166,
    lng: -5.64374,
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
    lat: -32.70093,
    lng: 151.49284,
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
    name: 'Skydive Melbourne',
    lat: -37.87404,
    lng: 144.97644,
    region: 'Victoria',
    country: 'Australia'
  },
  {
    name: 'Skydive Merville',
    lat: 50.61908,
    lng: 2.64434,
    country: 'France'
  },
  {
    name: 'Skydive Midwest',
    lat: 42.70312,
    lng: -87.95587,
    region: 'Wisconsin',
    country: 'United States',
    website: 'https://sdmw.com/'
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
    name: 'Skydive Mission Beach',
    lat: -17.86751,
    lng: 146.10733,
    region: 'Queensland',
    country: 'Australia'
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
    name: 'Skydive Monroe',
    lat: 33.78252,
    lng: -83.6928,
    region: 'Georgia',
    country: 'United States',
    website: 'https://www.skydivemonroe.com/'
  },
  {
    name: 'Skydive Monterey Bay',
    lat: 36.68153,
    lng: -121.76167,
    region: 'California',
    country: 'United States',
    website: 'https://www.skydivemontereybay.com/'
  },
  {
    name: 'Skydive Mount Cook',
    lat: -44.25122,
    lng: 170.11893,
    region: 'Canterbury',
    country: 'New Zealand'
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
    lat: 43.37441,
    lng: -70.92777,
    region: 'Maine',
    country: 'United States',
    website: 'https://www.skydivenewengland.com/'
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
    lat: 54.16498,
    lng: -2.96344,
    region: 'England',
    country: 'United Kingdom',
    website: 'https://skydivenorthwest.co.uk/'
  },
  {
    name: 'Skydive Nuggets',
    lat: 47.85866,
    lng: 10.0102,
    country: 'Germany',
    website: 'https://www.skydive-nuggets.de'
  },
  {
    name: 'Skydive Olsztyn',
    lat: 53.77664,
    lng: 20.47775,
    town: 'Olsztyn',
    country: 'Poland'
  },
  {
    name: 'Skydive Oppdal',
    lat: 62.65028,
    lng: 9.85463,
    country: 'Norway',
    website: 'https://skydiveoppdal.no/'
  },
  {
    name: 'Skydive Orange, Inc.',
    lat: 38.24907,
    lng: -78.04813,
    region: 'Virginia',
    country: 'United States',
    website: 'https://www.skydiveorange.com/'
  },
  {
    name: 'Skydive Oregon, Inc.',
    lat: 45.14526,
    lng: -122.61829,
    region: 'Oregon',
    country: 'United States',
    website: 'https://www.skydiveoregon.com/'
  },
  {
    name: 'Skydive Ostsee Barth',
    lat: 54.33608,
    lng: 12.72456,
    country: 'Germany'
  },
  {
    name: 'Skydive Oz',
    lat: -35.90427,
    lng: 150.14185,
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
    lat: 35.01717,
    lng: -79.19393,
    town: 'Raeford',
    region: 'North Carolina',
    country: 'United States',
    direction: 33
  },
  {
    name: 'Skydive Pennsylvania',
    lat: 41.14603,
    lng: -80.16775,
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
    lat: 33.76464,
    lng: -117.219,
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
    lat: 40.39217,
    lng: -75.2861,
    region: 'Pennsylvania',
    country: 'United States',
    website: 'https://www.skydivephiladelphia.com/'
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
    country: 'Portugal'
  },
  {
    name: 'Skydive Puebla',
    lat: 18.85528,
    lng: -98.44643,
    country: 'Mexico',
    website: 'https://www.skydivepuebla.com/'
  },
  {
    name: 'Skydive Ramblers',
    lat: -27.06955,
    lng: 152.38358,
    region: 'Queensland',
    country: 'Australia',
    website: 'https://www.ramblers.com.au/'
  },
  {
    name: 'Skydive Requena',
    lat: 39.47158,
    lng: -1.01129,
    country: 'Spain'
  },
  {
    name: 'Skydive Ries Dinkelsbuehl',
    lat: 49.06404,
    lng: 10.40007,
    country: 'Germany'
  },
  {
    name: 'Skydive Rockingham',
    lat: -32.27615,
    lng: 115.73074,
    region: 'Western Australia',
    country: 'Australia'
  },
  {
    name: 'Skydive Salerno',
    lat: 40.47195,
    lng: 14.96104,
    country: 'Italy',
    website: 'https://www.skydivesalerno.it/'
  },
  {
    name: 'Skydive San Diego',
    lat: 32.63491,
    lng: -116.89021,
    region: 'California',
    country: 'United States',
    website: 'https://www.skydivesandiego.com/'
  },
  {
    name: 'Skydive Sandown',
    lat: 50.65264,
    lng: -1.18281,
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Sardegna',
    lat: 39.40111,
    lng: 9.14,
    country: 'Italy',
    website: 'https://www.skydivesardegna.it/'
  },
  {
    name: 'Skydive Sauerland Schmallenberg',
    lat: 51.18856,
    lng: 8.31194,
    town: 'Bad Fredeburg',
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
    lat: 27.81672,
    lng: -80.50071,
    region: 'Florida',
    country: 'United States',
    website: 'https://www.skydiveseb.com/'
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
    lat: 47.907,
    lng: -122.101,
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
    lat: 56.18347,
    lng: -3.21941,
    country: 'United Kingdom'
  },
  {
    name: 'SkyDive St-Frederic',
    lat: 46.33198,
    lng: -70.96225,
    country: 'Canada'
  },
  {
    name: 'Skydive Strathallan',
    lat: 56.32582,
    lng: -3.75112,
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
    name: 'Skydive Sunrise Scuola di Paracadutismo',
    lat: 43.22698,
    lng: 13.74207,
    region: 'Marche',
    country: 'Italy',
    website: 'https://www.skydivesunrise.com/'
  },
  {
    name: 'Skydive Surfers Paradise',
    lat: -27.95987,
    lng: 153.42425,
    region: 'Queensland',
    country: 'Australia'
  },
  {
    name: 'Skydive Sussex',
    lat: 41.20028,
    lng: -74.62305,
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
    lat: 46.61522,
    lng: 7.6812,
    country: 'Switzerland',
    website: 'https://www.skydiveswitzerland.com/'
  },
  {
    name: 'Skydive Sydney - Newcastle',
    lat: -33.06633,
    lng: 151.65081,
    region: 'New South Wales',
    country: 'Australia'
  },
  {
    name: 'Skydive Taroudant',
    lat: 30.50017,
    lng: -8.8275,
    country: 'Morocco',
    website: 'https://www.skydivetaroudant.com/'
  },
  {
    name: 'Skydive Tauranga',
    lat: -37.67302,
    lng: 176.199,
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
    lat: 52.246,
    lng: 6.047,
    town: 'Teuge',
    country: 'Netherlands'
  },
  {
    name: 'Skydive Thailand',
    lat: 19.14874,
    lng: 98.98806,
    country: 'Thailand',
    website: 'https://www.skydivethailand.com/'
  },
  {
    name: 'Skydive The Falls',
    lat: 43.26396,
    lng: -78.96603,
    region: 'New York',
    country: 'United States',
    website: 'https://www.skydivethefalls.com/'
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
    name: 'Skydive Thiene',
    lat: 45.67459,
    lng: 11.495,
    country: 'Italy',
    website: 'https://www.skydivethiene.it/'
  },
  {
    name: 'Skydive Tilstock',
    lat: 52.93292,
    lng: -2.64772,
    country: 'United Kingdom'
  },
  {
    name: 'Skydive Tirol',
    lat: 47.46379,
    lng: 11.95055,
    region: 'Tirol',
    country: 'Austria'
  },
  {
    name: 'Skydive Toledo',
    lat: 46.47717,
    lng: -122.80648,
    region: 'Washington',
    country: 'United States',
    website: 'https://www.skydivetoledo.com/'
  },
  {
    name: 'Skydive Townsville',
    lat: -19.25694,
    lng: 146.82395,
    town: 'Townsville',
    country: 'Australia'
  },
  {
    name: 'Skydive Twin Cities',
    lat: 44.96464,
    lng: -92.39054,
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
    lat: 40.619,
    lng: -112.407,
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
    lat: 41.53081,
    lng: -4.92142,
    region: 'Castilla y León',
    country: 'Spain'
  },
  {
    name: 'Skydive Vancouver',
    lat: 49.09556,
    lng: -122.31351,
    region: 'British Columbia',
    country: 'Canada',
    website: 'https://www.skydivevancouver.com/'
  },
  {
    name: 'Skydive Venice',
    lat: 45.70019,
    lng: 12.76395,
    region: 'Veneto',
    country: 'Italy',
    website: 'https://www.skydive-venice.com/'
  },
  {
    name: 'Skydive Victoria Corowa',
    lat: -35.99261,
    lng: 146.35699,
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
    lat: 60.64,
    lng: 6.482,
    town: 'Voss',
    country: 'Norway'
  },
  {
    name: 'Skydive Wanaka',
    lat: -44.72254,
    lng: 169.24545,
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
    lat: -37.69543,
    lng: 145.36985,
    region: 'Victoria',
    country: 'Australia'
  },
  {
    name: 'St Florentin Sports Parachutisme',
    lat: 47.98101,
    lng: 3.77629,
    country: 'France'
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
    name: 'Strefa Baltic',
    lat: 54.43973,
    lng: 16.99681,
    town: 'Kobylnica',
    country: 'Poland'
  },
  {
    name: 'Strefa Silesia',
    lat: 51.92714,
    lng: 14.91671,
    town: 'Kaniów',
    country: 'Poland'
  },
  {
    name: 'Sundsvalls Fallskärmsklubb',
    lat: 62.38812,
    lng: 17.45096,
    country: 'Sweden'
  },
  {
    name: 'Sydney Skydivers',
    lat: -34.2205,
    lng: 150.67036,
    region: 'New South Wales',
    country: 'Australia',
    website: 'https://www.sydneyskydivers.com.au/'
  },
  {
    name: 'Tandem Cairns',
    lat: -17.07107,
    lng: 145.42892,
    country: 'Australia'
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
    name: 'Thai Sky Adventures, Ltd.',
    lat: 13.14181,
    lng: 101.04855,
    country: 'Thailand',
    website: 'https://www.thaiskyadventures.com/'
  },
  {
    name: 'TNT-Brothers Dropzone',
    lat: 44.35883,
    lng: 25.92513,
    country: 'Romania',
    website: 'https://www.tnt-brothers.ro/'
  },
  {
    name: 'Tournus Cuisery Parachutisme',
    lat: 46.56293,
    lng: 4.97632,
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
    lat: 47.727,
    lng: -2.72122,
    country: 'France'
  },
  {
    name: 'Varde Faldskærmsklub',
    lat: 55.60868,
    lng: 8.44343,
    region: 'Region Syddanmark',
    country: 'Denmark',
    website: 'https://vaf13.dk/'
  },
  {
    name: 'Vendee Chute Libre',
    lat: 46.4775,
    lng: -1.62803,
    town: 'Talmont-Saint-Hilaire',
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
    lat: 45.31133,
    lng: 8.42324,
    country: 'Italy',
    website: 'https://www.vzone.it/'
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
