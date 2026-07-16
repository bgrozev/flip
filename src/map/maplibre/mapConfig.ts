/**
 * MapLibre-specific configuration: the default map style and shared tuning.
 *
 * FliP is a satellite-oriented tool (the Google adapter uses the `satellite`
 * map type), so the default MapLibre style is a raster style backed by ESRI
 * "World Imagery" satellite tiles. That endpoint needs no API key and serves
 * CORS-enabled tiles; ESRI's attribution is carried on the source so MapLibre
 * renders it in the map's attribution control.
 */
import type { StyleSpecification } from 'maplibre-gl';

/** ESRI World Imagery attribution (required whenever these tiles are shown). */
export const ESRI_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, ' +
  'and the GIS User Community';

/**
 * Default satellite raster style. ESRI serves imagery to ~z19 everywhere and
 * deeper in many areas; `maxzoom: 19` lets MapLibre overzoom (upscale the z19
 * tile) past that instead of requesting tiles that may not exist, so the map
 * stays usable at the course-marker zoom levels (>= 20).
 */
export const DEFAULT_MAPLIBRE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-world-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: ESRI_ATTRIBUTION
    }
  },
  layers: [
    {
      id: 'esri-world-imagery',
      type: 'raster',
      source: 'esri-world-imagery'
    }
  ]
};
