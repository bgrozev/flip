/**
 * The place list behind the target picker: the known dropzones plus the
 * user's saved places, in one searchable list.
 *
 * Pure — no storage, no geocoder. The picker adds geocoder suggestions as a
 * separate group, because those have no coordinates until they are resolved.
 */
import { CustomLocation, Dropzone, Place } from '../types';

/** Saved places (favorites + custom) sort above the plain dropzone list. */
export function isSaved(place: Place): boolean {
  return place.kind !== 'dropzone';
}

export function dropzonePlaceId(name: string): string {
  return `dz:${name}`;
}

export function customPlaceId(name: string): string {
  return `custom:${name}`;
}

/**
 * Flatten the dropzone database and the user's saved data into one list:
 * saved places first (alphabetical), then the remaining dropzones.
 *
 * A favorited dropzone appears once, in the saved group. Favorites name a
 * dropzone rather than copying it, so a name that is no longer in the
 * database (renamed, removed) simply drops out.
 */
export function buildPlaces(
  dropzones: readonly Dropzone[],
  customLocations: readonly CustomLocation[],
  favoriteNames: readonly string[]
): Place[] {
  const favorites = new Set(favoriteNames);

  const saved: Place[] = [
    ...dropzones
      .filter(dz => favorites.has(dz.name))
      .map((dz): Place => ({
        id: dropzonePlaceId(dz.name),
        kind: 'favorite',
        name: dz.name,
        lat: dz.lat,
        lng: dz.lng,
        direction: dz.direction
      })),
    ...customLocations.map((loc): Place => ({
      id: customPlaceId(loc.name),
      kind: 'custom',
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      direction: loc.direction
    }))
  ].sort((a, b) => a.name.localeCompare(b.name));

  const rest: Place[] = dropzones
    .filter(dz => !favorites.has(dz.name))
    .map((dz): Place => ({
      id: dropzonePlaceId(dz.name),
      kind: 'dropzone',
      name: dz.name,
      lat: dz.lat,
      lng: dz.lng,
      direction: dz.direction
    }));

  return [...saved, ...rest];
}

/**
 * Fold a name down to what someone would type on a phone keyboard:
 * lower case, no diacritics, no punctuation. "Århus Faldskærm" matches
 * "arhus" and "faldskaerm".
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining marks: å → a, é → e
    .toLowerCase()
    // Ligatures and strokes don't decompose, so map them explicitly.
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Match quality, lower is better; `null` means no match. Ordering these as
 * tiers (rather than one fuzzy score) keeps "zh" → ZHills above incidental
 * letter-order coincidences, which a single score tends to interleave.
 */
function matchScore(haystack: string, needle: string): number | null {
  if (haystack === needle) {
    return 0;
  }
  if (haystack.startsWith(needle)) {
    return 1;
  }
  if (haystack.split(' ').some(word => word.startsWith(needle))) {
    return 2;
  }
  if (haystack.includes(needle)) {
    return 3;
  }
  if (isSubsequence(needle, haystack)) {
    return 4;
  }

  return null;
}

/** Are `needle`'s characters present in `haystack`, in order? ("sdaz" → "SkyDive AriZona") */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;

  for (const ch of haystack) {
    if (ch === needle[i]) {
      i++;
      if (i === needle.length) {
        return true;
      }
    }
  }

  return needle.length === 0;
}

/**
 * Filter and order places for a query. Every whitespace-separated token must
 * match ("spaceland tx" needs both), and the worst-matching token decides the
 * score, so a place that only just qualifies doesn't ride in on one strong
 * token. Ties break by group (saved first) then name, which is also the
 * order an empty query returns.
 */
export function rankPlaces(query: string, places: readonly Place[]): Place[] {
  const normalizedQuery = normalizeForSearch(query);

  if (normalizedQuery === '') {
    return [...places];
  }

  const tokens = normalizedQuery.split(' ');
  const scored: { place: Place; score: number }[] = [];

  places.forEach(place => {
    const haystack = normalizeForSearch(place.name);
    let worst = 0;

    for (const token of tokens) {
      const score = matchScore(haystack, token);

      if (score === null) {
        return;
      }
      worst = Math.max(worst, score);
    }

    scored.push({ place, score: worst });
  });

  return scored
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      const aSaved = isSaved(a.place) ? 0 : 1;
      const bSaved = isSaved(b.place) ? 0 : 1;

      return aSaved !== bSaved ? aSaved - bSaved : a.place.name.localeCompare(b.place.name);
    })
    .map(entry => entry.place);
}
