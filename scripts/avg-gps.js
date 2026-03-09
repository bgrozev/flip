#!/usr/bin/env node
/**
 * avg-gps.js — average lat/lng from a FlySight/FliP CSV file
 *
 * Usage: node scripts/avg-gps.js <file.csv>
 *
 * Reads all rows that have parseable lat/lon values and prints their
 * arithmetic mean. Useful for deriving precise coordinates from a
 * stationary GPS log.
 */

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/avg-gps.js <file.csv>');
  process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');
const lines = content.trim().split('\n');

if (lines.length < 2) {
  console.error('File has no data rows');
  process.exit(1);
}

// First line is column headers
const headers = lines[0].split(',').map(h => h.trim());
const latIdx = headers.indexOf('lat');
const lonIdx = headers.indexOf('lon');

if (latIdx === -1 || lonIdx === -1) {
  console.error(`Could not find 'lat' and 'lon' columns. Found: ${headers.join(', ')}`);
  process.exit(1);
}

// Skip any row where lat/lon don't parse as numbers (e.g. the units row)
let sumLat = 0;
let sumLon = 0;
let count = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const fields = line.split(',');
  const lat = parseFloat(fields[latIdx]);
  const lon = parseFloat(fields[lonIdx]);
  if (!isNaN(lat) && !isNaN(lon)) {
    sumLat += lat;
    sumLon += lon;
    count++;
  }
}

if (count === 0) {
  console.error('No valid lat/lon rows found');
  process.exit(1);
}

const avgLat = sumLat / count;
const avgLon = sumLon / count;

//process.stderr.write(`Averaged ${count} points\n`);
console.log(`${file}=${avgLat.toFixed(7)},${avgLon.toFixed(7)}`);
