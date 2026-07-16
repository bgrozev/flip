/**
 * z-index emulation for MapLibre layers.
 *
 * MapLibre paints layers in insertion order and has no numeric z-index; the
 * Google adapter, by contrast, orders overlapping vector primitives with a
 * numeric `zIndex`. To match, each managed layer registers a zIndex and is
 * inserted before the first existing layer that should paint above it, so the
 * canvas stacking matches the Google adapter (lower zIndex below; equal
 * zIndex in insertion order, i.e. later on top).
 *
 * Confined to `src/map/maplibre/`.
 */
import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

interface Entry {
  id: string;
  z: number;
  seq: number;
}

interface Registry {
  entries: Entry[];
  seq: number;
}

const REGISTRIES = new WeakMap<MapLibreMap, Registry>();

function registryFor(map: MapLibreMap): Registry {
  let reg = REGISTRIES.get(map);

  if (!reg) {
    reg = { entries: [], seq: 0 };
    REGISTRIES.set(map, reg);
  }

  return reg;
}

/**
 * Add `layer` to the map at the position implied by `zIndex`, keeping the
 * managed layers ordered by (zIndex, insertion order).
 */
export function addOrderedLayer(
  map: MapLibreMap,
  layer: LayerSpecification,
  zIndex = 0
): void {
  const reg = registryFor(map);
  const entry: Entry = { id: layer.id, z: zIndex, seq: reg.seq++ };

  // Insert before the first managed layer that should paint above this one:
  // a strictly higher zIndex (equal-zIndex layers stay in insertion order).
  const before = reg.entries.find(e => e.z > zIndex);

  map.addLayer(layer, before?.id);

  reg.entries.push(entry);
  reg.entries.sort((a, b) => (a.z - b.z) || (a.seq - b.seq));
}

/** Remove a previously added layer and forget its ordering entry. */
export function removeOrderedLayer(map: MapLibreMap, layerId: string): void {
  const reg = registryFor(map);

  reg.entries = reg.entries.filter(e => e.id !== layerId);

  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}
