/**
 * The place list behind the target picker: the known dropzones plus the
 * user's saved places, in one searchable list.
 *
 * Pure — no storage, no geocoder. The picker adds geocoder suggestions as a
 * separate group, because those have no coordinates until they are resolved.
 */
import { CustomLocation, Dropzone, DropzoneModeConfig, Place, Target } from '../types';

import { regionAliases } from './regions';

/** Longest query still treated as possible initials — see `matchScore`. */
const MAX_SUBSEQUENCE_LENGTH = 5;

/** The weakest match tier: letters in order, nothing more (see `matchScore`). */
const SUBSEQUENCE_SCORE = 4;

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
 * The name a place id was built from. Both id forms carry it verbatim after
 * the prefix, so this works for custom places too — which is the point: a
 * course can be created at one, and the Courses panel has to be able to name
 * the group it lands in.
 */
export function placeNameFromId(placeId: string | null): string | null {
  if (!placeId) {
    return null;
  }

  const separator = placeId.indexOf(':');

  return separator < 0 ? placeId : placeId.slice(separator + 1) || null;
}

/**
 * The dropzone a place id refers to, if it refers to one at all: custom
 * places and geocoder hits have no entry in the database.
 */
export function dropzoneForPlaceId(
  dropzones: readonly Dropzone[],
  placeId: string | null
): Dropzone | undefined {
  if (!placeId) {
    return undefined;
  }

  return dropzones.find(dz => dropzonePlaceId(dz.name) === placeId);
}

/**
 * The per-mode starting targets a place declares, resolved against the
 * place's own position and heading: an entry may give a position, a heading,
 * or both, and whatever it leaves out comes from `base`. Modes that declare
 * nothing are left out entirely so they fall back to the shared target.
 */
export function placeModeTargets(
  modes: Record<string, DropzoneModeConfig> | undefined,
  base: Target
): Record<string, Target> {
  const targets: Record<string, Target> = {};

  if (!modes) {
    return targets;
  }

  Object.entries(modes).forEach(([modeId, config]) => {
    const { lat, lng, direction } = config ?? {};
    const hasPosition = typeof lat === 'number' && typeof lng === 'number';
    const hasHeading = typeof direction === 'number';

    if (modeId === '' || (!hasPosition && !hasHeading)) {
      return;
    }

    targets[modeId] = {
      target: hasPosition ? { lat, lng } : base.target,
      finalHeading: hasHeading ? direction : base.finalHeading
    };
  });

  return targets;
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
        direction: dz.direction,
        modes: dz.modes,
        website: dz.website,
        town: dz.town,
        region: dz.region,
        country: dz.country
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
      direction: dz.direction,
      modes: dz.modes,
      website: dz.website,
      town: dz.town,
      region: dz.region,
      country: dz.country
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
  // Subsequence matching is what makes initials work ("sdaz" → Skydive
  // Arizona), but on a longer query almost anything qualifies — "deland"
  // is a subsequence of "Skydive Spaceland Dallas" — so it is limited to
  // queries short enough to be initials.
  if (needle.length <= MAX_SUBSEQUENCE_LENGTH && isSubsequence(needle, haystack)) {
    return SUBSEQUENCE_SCORE;
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
/**
 * Everything a place can be found by: its name, where it is, and the short
 * forms of those ("AZ" for Arizona). Kept as separate strings rather than
 * one blob so a town match scores as a match on the town, not as an
 * incidental substring somewhere in the middle of a concatenation.
 */
export function placeSearchFields(place: Place): string[] {
  const fields = [place.name, place.town, place.region, place.country]
    .filter((value): value is string => value !== undefined && value !== '')
    .map(normalizeForSearch);

  const aliases = fields.flatMap(regionAliases);

  return [...fields, ...aliases];
}

/** The best (lowest) score this token gets against any of a place's fields. */
function bestFieldScore(fields: readonly string[], token: string): number | null {
  let best: number | null = null;

  for (const field of fields) {
    const score = matchScore(field, token);

    if (score !== null && (best === null || score < best)) {
      best = score;
    }
  }

  return best;
}

/**
 * Filter and order places for a query. Every whitespace-separated token must
 * match ("spaceland tx" needs both), and the worst-matching token decides the
 * score, so a place that only just qualifies doesn't ride in on one strong
 * token. Ties break by group (saved first) then name, which is also the
 * order an empty query returns.
 *
 * Places that only qualify by subsequence are dropped as soon as anything
 * matched properly: "eloy" is a subsequence of "Skydive Pink Klatovy", and
 * showing that next to the dropzone actually in Eloy is just noise. They
 * still carry the query when nothing else matches, which is what makes
 * initials ("sdaz") work.
 */
export function rankPlaces(query: string, places: readonly Place[]): Place[] {
  const normalizedQuery = normalizeForSearch(query);

  if (normalizedQuery === '') {
    return [...places];
  }

  const tokens = normalizedQuery.split(' ');
  const scored: { place: Place; score: number }[] = [];

  places.forEach(place => {
    const fields = placeSearchFields(place);
    let worst = 0;

    for (const token of tokens) {
      const score = bestFieldScore(fields, token);

      if (score === null) {
        return;
      }
      worst = Math.max(worst, score);
    }

    scored.push({ place, score: worst });
  });

  const hasRealMatch = scored.some(entry => entry.score < SUBSEQUENCE_SCORE);
  const kept = hasRealMatch
    ? scored.filter(entry => entry.score < SUBSEQUENCE_SCORE)
    : scored;

  return kept
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

/**
 * The dropzone list grouped by country, for browsing rather than searching.
 *
 * 274 dropzones is not a list anyone reads; 41 countries is. The group is the
 * first thing shown and the dropzones inside it come second, which turns
 * "scroll until you see it" into two decisions.
 *
 * Countries sort alphabetically, and entries with no country at all collect
 * under a final "Elsewhere" so nothing can go missing from the browse view.
 */
export const NO_COUNTRY_GROUP = 'Elsewhere';

export interface PlaceGroupByCountry {
  country: string;
  places: Place[];
}

export function groupPlacesByCountry(places: readonly Place[]): PlaceGroupByCountry[] {
  const groups = new Map<string, Place[]>();

  places.forEach(place => {
    const country = place.country?.trim() || NO_COUNTRY_GROUP;
    const group = groups.get(country);

    if (group) {
      group.push(place);
    } else {
      groups.set(country, [place]);
    }
  });

  return [...groups.entries()]
    .map(([country, entries]): PlaceGroupByCountry => ({
      country,
      places: [...entries].sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => {
      if (a.country === NO_COUNTRY_GROUP) {
        return 1;
      }
      if (b.country === NO_COUNTRY_GROUP) {
        return -1;
      }

      return a.country.localeCompare(b.country);
    });
}
