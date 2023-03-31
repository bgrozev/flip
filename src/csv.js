import { Path, Point, metersToFeet } from './geo.js';

// Note we reverse the path so it's more convenient to work with
// (e.g. rotations and translations are around the first point, not the last)
export function extractPathFromCsv(csv) {
    if (!csv || !csv.length) {
        return new Path();
    }

    // Note we assume the final elevation will be 0!
    const points = [];
    const finalElevMeters = csv[csv.length - 1].hMSL;

    csv.slice(1).forEach(row => {
        points.push(new Point(
            Number(row.lat),
            Number(row.lon),
            new Date(row.time).getTime(),
            Boolean(row.pom),
            (row.hMSL - finalElevMeters) * metersToFeet
        ));
    });
    points.reverse();

    const poms = points.filter(p => p.pom);
    const time = (points[0].time - points[points.length - 1].time) / 1000;

    console.log(`Extracted path with ${points.length} points, ${poms.length} POMs`);
    console.log(`POMs at altitudes: ${poms.map(p => Math.round(p.alt)).join(', ')} ft`);
    console.log(`Start altitude ${Math.round(points[points.length - 1].alt)} ft, total time ${time} seconds`);

    return new Path(points);
}

export function trim(csv, startAltitude) {
    if (!csv || csv.length < 2) {
        return;
    }
    const finalElevMeters = csv[csv.length - 1].hMSL;
    let firstIndex = 2;
    let lastIndex = csv.length - 1;

    // Find the first index with altitude below startAltitude.
    for (let i = 2; i < csv.length - 1; i++) {
        const altFt = (csv[i].hMSL - finalElevMeters) * metersToFeet;

        if (altFt < startAltitude) {
            firstIndex = i;
            break;
        }
    }

    // Find the last index with altitude above 10 ft.
    for (let i = csv.length - 1; i >= 2; i--) {
        const altFt = (csv[i].hMSL - finalElevMeters) * metersToFeet;

        if (altFt > 10) {
            break;
        }
        lastIndex = i;
    }

    csv.splice(lastIndex, csv.length - lastIndex);
    csv.splice(1, firstIndex - 1);
}
