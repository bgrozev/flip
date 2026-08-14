import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback, useMemo } from 'react';

import { SCHEMA_VERSION } from '../core/model';
import { ModeId } from '../modes';
import { createVersionedCodec } from '../util/storage';

/**
 * The map zoom, remembered per mode.
 *
 * A mode's `defaultZoom` says how wide its picture is — flocking spans miles
 * of jumprun, a landing pattern spans hundreds of feet — but it is a STARTING
 * point, not a preference: a flocker who zooms in to read the spot against the
 * ground should find that zoom again after a trip through another mode, rather
 * than being pulled back out to the default every time.
 *
 * Same shape as the other per-mode records (`flip.pattern.byMode`): the mode's
 * own default applies until the user has zoomed in that mode, and each mode's
 * value is independent, since the zoom describes the picture and the picture
 * is what the mode changes.
 */

/** Loose bounds — the point is to reject junk, not to police the map. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;

export function migrateZoomByMode(doc: unknown): Record<string, number> {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return {};
  }

  const out: Record<string, number> = {};

  for (const [modeId, zoom] of Object.entries(doc as Record<string, unknown>)) {
    if (typeof zoom === 'number' && Number.isFinite(zoom) && zoom >= MIN_ZOOM && zoom <= MAX_ZOOM) {
      out[modeId] = zoom;
    }
  }

  return out;
}

export interface UseModeZoomResult {
  /**
   * What the map should open at: what the user last left this mode on, else
   * the mode's own default. Undefined means the map's own default applies.
   */
  zoom: number | undefined;
  /** Record where the user settled, for the mode they are in now. */
  recordZoom: (zoom: number) => void;
}

export function useModeZoom(modeId: ModeId, defaultZoom?: number): UseModeZoomResult {
  const [storedZoomByMode, setStoredZoomByMode] = useLocalStorageState<Record<string, number>>(
    'flip.map.zoomByMode',
    {},
    { codec: createVersionedCodec(SCHEMA_VERSION, migrateZoomByMode) }
  );
  const zoomByMode = useMemo(() => storedZoomByMode ?? {}, [storedZoomByMode]);

  const recordZoom = useCallback(
    (zoom: number) => {
      // The map reports its zoom on load as well as after a gesture, so this
      // arrives with an unchanged value on every mode switch. The check has to
      // be HERE rather than in an updater returning the previous object:
      // `useLocalStorageState` encodes and writes whatever it is handed, so a
      // no-op update still hits localStorage and still notifies every
      // subscriber of the key.
      if (zoomByMode[modeId] === zoom) {
        return;
      }

      setStoredZoomByMode({ ...zoomByMode, [modeId]: zoom });
    },
    [modeId, zoomByMode, setStoredZoomByMode]
  );

  return { zoom: zoomByMode[modeId] ?? defaultZoom, recordZoom };
}
