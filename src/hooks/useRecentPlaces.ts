/**
 * The places the user picked recently, most recent first.
 *
 * Written by the picker rather than by every code path that moves the target:
 * a preset load or a mode switch also selects a place, and neither is
 * something the user "went to". Recents answer "take me back to where I was",
 * which is a thing you did on purpose.
 *
 * Stored as snapshots — see `RecentPlace`. A favorite is a reference to a
 * dropzone; a recent cannot be, because a geocoder hit is in no database.
 */
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback } from 'react';

import { MAX_RECENT_PLACES, SCHEMA_VERSION, migrateRecentPlaces } from '../core/model';
import { RecentPlace } from '../types';
import { createVersionedCodec } from '../util/storage';

const codec = createVersionedCodec(SCHEMA_VERSION, migrateRecentPlaces);
const NONE: RecentPlace[] = [];

export interface RecentPlaces {
  recents: RecentPlace[];
  /** Record a pick, moving it to the front if it is already there. */
  record: (place: RecentPlace) => void;
  clear: () => void;
}

/** Same identity rule as the migrator: the id if there is one, else the name. */
function keyOf(place: RecentPlace): string {
  return place.id || `name:${place.name}`;
}

export function useRecentPlaces(): RecentPlaces {
  const [stored, setStored] = useLocalStorageState<RecentPlace[]>(
    'flip.places.recent',
    NONE,
    { codec }
  );

  const recents = stored ?? NONE;

  const record = useCallback((place: RecentPlace) => {
    const key = keyOf(place);

    setStored([
      place,
      ...(stored ?? NONE).filter(entry => keyOf(entry) !== key)
    ].slice(0, MAX_RECENT_PLACES));
  }, [setStored, stored]);

  const clear = useCallback(() => setStored(NONE), [setStored]);

  return { recents, record, clear };
}
