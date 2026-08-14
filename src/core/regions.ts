/**
 * Short forms for the regions and countries the dropzone list uses, so a
 * search for "az" finds a dropzone whose region is recorded as "Arizona".
 *
 * A table here rather than an alias on every dropzone entry: the codes are
 * the same everywhere, and per-entry aliases are the kind of data that gets
 * filled in for the first few rows and forgotten for the rest.
 *
 * Keys are already normalized (lower case, no punctuation) so the search can
 * look them up directly. The mapping is used in both directions — searching
 * the code finds the full name, and vice versa.
 */

/** US states and territories that appear, or plausibly will. */
const US_STATES: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar',
  california: 'ca', colorado: 'co', connecticut: 'ct', delaware: 'de',
  florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id',
  illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks',
  kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms',
  missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
  'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok',
  oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut',
  vermont: 'vt', virginia: 'va', washington: 'wa', 'west virginia': 'wv',
  wisconsin: 'wi', wyoming: 'wy'
};

/** Country short forms — the ones someone would actually type. */
const COUNTRIES: Record<string, string> = {
  'united states': 'usa',
  'united kingdom': 'uk',
  'united arab emirates': 'uae',
  'czech republic': 'cz',
  netherlands: 'nl',
  denmark: 'dk',
  'south africa': 'za'
};

const FULL_TO_SHORT: Record<string, string> = { ...US_STATES, ...COUNTRIES };

const SHORT_TO_FULL: Record<string, string> = Object.fromEntries(
  Object.entries(FULL_TO_SHORT).map(([full, short]) => [short, full])
);

/**
 * The other ways of writing a region or country name: the code for a full
 * name, the full name for a code. Returns an empty array for anything the
 * table does not know, which is the normal case for a town.
 */
export function regionAliases(normalized: string): string[] {
  const aliases: string[] = [];
  const short = FULL_TO_SHORT[normalized];
  const full = SHORT_TO_FULL[normalized];

  if (short !== undefined) {
    aliases.push(short);
  }
  if (full !== undefined) {
    aliases.push(full);
  }

  return aliases;
}
