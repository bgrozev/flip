import { fetchCscGroundWind } from '../forecast/csc.js';
import { fetchSdazGroundWind } from '../forecast/sdaz.js';
import { fetchSpacelandGroundWind } from '../forecast/spaceland.js';
import { Point } from '../util/geo.js';

export const DROPZONES = [
    {
        name: 'Chicagoland Skydiving Center',
        lat: 41.89338,
        lng: -89.07201,
        direction: 250,
        fetchGroundWind: () => fetchCscGroundWind()
    },
    {
        name: 'Parachute Montreal',
        lat: 45.28492,
        lng: -73.01050,
        direction: 278
    },
    {
        name: 'Skydive Arizona',
        lat: 32.80799,
        lng: -111.58167,
        direction: 216,
        fetchGroundWind: () => fetchSdazGroundWind()
    },
    {
        name: 'Skydive City (ZHills)',
        lat: 28.21887,
        lng: -82.15122,
        direction: 270
    },
    {
        name: 'Skydive DeLand',
        lat: 29.06402,
        lng: -81.27847,
        direction: 125
    },
    {
        name: 'Skydive Paraclete XP',
        lat: 35.01717,
        lng: -79.19393,
        direction: 33
    },
    {
        name: 'Skydive Bulgaria (Ihtiman)',
        lat: 42.42256,
        lng: 23.76556,
        direction: 315
    },
    {
        name: 'Skydive Dubai',
        lat: 25.090263,
        lng: 55.135610,
        direction: 82
    },
    {
        name: 'Skydive Pink Klatovy',
        lat: 49.420251,
        lng: 13.325027,
        direction: 292
    },
    {
        name: 'Skydive Pretoria',
        lat: -25.663081,
        lng: 28.220605,
        direction: 80
    },
    {
        name: 'Skydive Spaceland Houston',
        lat: 29.357628,
        lng: -95.461775,
        direction: 151,
        fetchGroundWind: () => fetchSpacelandGroundWind('HOU')
    },
    {
        name: 'Skydive Spaceland San Marcos',
        lat: 29.76994,
        lng: -97.77173,
        direction: 210,
        fetchGroundWind: () => fetchSpacelandGroundWind('SSM')
    },
    {
        name: 'West Tennessee Skydiving',
        lat: 35.22037,
        lng: -89.18982,
        direction: 182
    }
];

export function findClosestDropzone(center) {
    let minDistance = Number.MAX_VALUE;
    let minDz;

    DROPZONES.forEach(dz => {
        const distance = center.distanceTo(new Point(dz.lat, dz.lng));

        if (distance < minDistance) {
            minDistance = distance;
            minDz = dz;
        }
    });

    return minDz;
}
