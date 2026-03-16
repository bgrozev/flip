import { Course } from '../types';

// CSS color name / hex → KML AABBGGRR
const NAMED_COLORS: Record<string, string> = {
  white:  'ffffffff',
  orange: 'ff00a5ff',
  yellow: 'ff00ffff',
  red:    'ff0000ff',
};

function cssToKml(color: string): string {
  if (NAMED_COLORS[color]) return NAMED_COLORS[color];
  const m = color.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (m) return `ff${m[3]}${m[2]}${m[1]}`;
  return 'ffffffff';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildKml(course: Course): string {
  const colors = new Set<string>(course.elements.map(el => el.color));

  let styleCounter = 0;
  const styleIds = new Map<string, string>();
  const styleDefs: string[] = [];

  for (const color of colors) {
    const id = `s${styleCounter++}`;
    styleIds.set(color, id);
    const kmlColor = cssToKml(color);
    styleDefs.push(
      `  <Style id="${id}">` +
      `<IconStyle><color>${kmlColor}</color><scale>0.6</scale>` +
      `<Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>` +
      `</IconStyle>` +
      `<LineStyle><color>${kmlColor}</color><width>2</width></LineStyle>` +
      `<LabelStyle><color>${kmlColor}</color><scale>0.7</scale></LabelStyle>` +
      `</Style>`
    );
  }

  const placemarks: string[] = [];

  for (const el of course.elements) {
    const sid = styleIds.get(el.color)!;
    if (el.type === 'buoy') {
      placemarks.push(
        `  <Placemark><styleUrl>#${sid}</styleUrl>` +
        `<Point><coordinates>${el.lng},${el.lat},0</coordinates></Point></Placemark>`
      );
    } else if (el.type === 'line') {
      placemarks.push(
        `  <Placemark><styleUrl>#${sid}</styleUrl>` +
        `<LineString><tessellate>1</tessellate>` +
        `<coordinates>${el.from.lng},${el.from.lat},0 ${el.to.lng},${el.to.lat},0</coordinates>` +
        `</LineString></Placemark>`
      );
    } else if (el.type === 'marker') {
      const name = el.label ? `<name>${escapeXml(el.label)}</name>` : '';
      placemarks.push(
        `  <Placemark>${name}<styleUrl>#${sid}</styleUrl>` +
        `<Point><coordinates>${el.lng},${el.lat},0</coordinates></Point></Placemark>`
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    `  <name>${escapeXml(course.name)}</name>`,
    ...styleDefs,
    ...placemarks,
    '</Document>',
    '</kml>'
  ].join('\n');
}

// CRC-32 lookup table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a minimal uncompressed ZIP (STORE method) with a single file. */
function buildZip(filename: string, data: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const name = enc.encode(filename);
  const crc = crc32(data);
  const size = data.length;

  // Local file header (30 + name)
  const local = new Uint8Array(30 + name.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0,  0x04034b50, true);
  lv.setUint16(4,  20,   true); // version needed
  lv.setUint16(6,  0,    true); // flags
  lv.setUint16(8,  0,    true); // STORE
  lv.setUint16(10, 0,    true); // mod time
  lv.setUint16(12, 0,    true); // mod date
  lv.setUint32(14, crc,  true);
  lv.setUint32(18, size, true); // compressed
  lv.setUint32(22, size, true); // uncompressed
  lv.setUint16(26, name.length, true);
  lv.setUint16(28, 0,    true); // extra length
  local.set(name, 30);

  const cdOffset = 30 + name.length + size;

  // Central directory header (46 + name)
  const cd = new Uint8Array(46 + name.length);
  const cv = new DataView(cd.buffer);
  cv.setUint32(0,  0x02014b50, true);
  cv.setUint16(4,  20,   true); // version made by
  cv.setUint16(6,  20,   true); // version needed
  cv.setUint16(8,  0,    true); // flags
  cv.setUint16(10, 0,    true); // STORE
  cv.setUint16(12, 0,    true); // mod time
  cv.setUint16(14, 0,    true); // mod date
  cv.setUint32(16, crc,  true);
  cv.setUint32(20, size, true); // compressed
  cv.setUint32(24, size, true); // uncompressed
  cv.setUint16(28, name.length, true);
  cv.setUint16(30, 0,    true); // extra length
  cv.setUint16(32, 0,    true); // comment length
  cv.setUint16(34, 0,    true); // disk number start
  cv.setUint16(36, 0,    true); // internal attrs
  cv.setUint32(38, 0,    true); // external attrs
  cv.setUint32(42, 0,    true); // local header offset
  cd.set(name, 46);

  // End of central directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0,  0x06054b50, true);
  ev.setUint16(4,  0,          true); // disk number
  ev.setUint16(6,  0,          true); // disk with CD start
  ev.setUint16(8,  1,          true); // records on disk
  ev.setUint16(10, 1,          true); // total records
  ev.setUint32(12, cd.length,  true); // CD size
  ev.setUint32(16, cdOffset,   true); // CD offset
  ev.setUint16(20, 0,          true); // comment length

  const out = new Uint8Array(local.length + data.length + cd.length + eocd.length);
  let pos = 0;
  out.set(local, pos); pos += local.length;
  out.set(data,  pos); pos += data.length;
  out.set(cd,    pos); pos += cd.length;
  out.set(eocd,  pos);
  return out;
}

export function downloadCourseKmz(course: Course): void {
  const kml = buildKml(course);
  const enc = new TextEncoder();
  const kmzBytes = buildZip('doc.kml', enc.encode(kml));
  const blob = new Blob([kmzBytes], { type: 'application/vnd.google-earth.kmz' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${course.name}.kmz`;
  a.click();
  URL.revokeObjectURL(url);
}
