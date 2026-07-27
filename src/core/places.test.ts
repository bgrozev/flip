import { describe, it, expect } from 'vitest';

import { CustomLocation, Dropzone } from '../types';

import { buildPlaces, normalizeForSearch, rankPlaces } from './places';

const DZS: Dropzone[] = [
  { name: 'Århus Faldskærm Club', lat: 56.313, lng: 10.615 },
  { name: 'Skydive Arizona', lat: 32.80799, lng: -111.58167, direction: 216 },
  { name: 'Skydive City (ZHills)', lat: 28.21887, lng: -82.15122, direction: 270 },
  { name: 'Skydive Spaceland Dallas', lat: 33.449, lng: -96.378 },
  { name: 'Skydive Spaceland Houston', lat: 29.357628, lng: -95.461775, direction: 151 }
];

const CUSTOM: CustomLocation[] = [
  { name: 'Back field', lat: 28.22, lng: -82.15, direction: 90 }
];

describe('buildPlaces', () => {
  it('puts saved places first, alphabetically, then the rest', () => {
    const places = buildPlaces(DZS, CUSTOM, ['Skydive Arizona']);

    expect(places.map(p => p.name)).toEqual([
      'Back field',
      'Skydive Arizona',
      'Århus Faldskærm Club',
      'Skydive City (ZHills)',
      'Skydive Spaceland Dallas',
      'Skydive Spaceland Houston'
    ]);
    expect(places.map(p => p.kind)).toEqual([
      'custom', 'favorite', 'dropzone', 'dropzone', 'dropzone', 'dropzone'
    ]);
  });

  it('shows a favorited dropzone once, and carries its data', () => {
    const places = buildPlaces(DZS, [], ['Skydive Arizona']);
    const arizona = places.filter(p => p.name === 'Skydive Arizona');

    expect(arizona).toHaveLength(1);
    expect(arizona[0]).toMatchObject({ kind: 'favorite', lat: 32.80799, direction: 216 });
  });

  it('drops a favorite whose dropzone no longer exists', () => {
    const places = buildPlaces(DZS, [], ['Skydive Atlantis']);

    expect(places.map(p => p.name)).not.toContain('Skydive Atlantis');
    expect(places.every(p => p.kind === 'dropzone')).toBe(true);
  });

  it('gives places unique ids', () => {
    const places = buildPlaces(DZS, CUSTOM, ['Skydive Arizona']);
    const ids = places.map(p => p.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves direction undefined for dropzones that have none', () => {
    const places = buildPlaces(DZS, [], []);

    expect(places.find(p => p.name === 'Århus Faldskærm Club')?.direction).toBeUndefined();
  });
});

describe('normalizeForSearch', () => {
  it('folds case, diacritics, ligatures and punctuation', () => {
    expect(normalizeForSearch('Århus Faldskærm Club')).toBe('arhus faldskaerm club');
    expect(normalizeForSearch('Skydive City (ZHills)')).toBe('skydive city zhills');
    expect(normalizeForSearch('  Bjørn  ')).toBe('bjorn');
  });
});

describe('rankPlaces', () => {
  const places = buildPlaces(DZS, CUSTOM, []);
  const names = (query: string) => rankPlaces(query, places).map(p => p.name);

  it('returns everything, in list order, for an empty query', () => {
    expect(names('')).toEqual(places.map(p => p.name));
    expect(names('   ')).toEqual(places.map(p => p.name));
  });

  it('matches a word in the middle of a name', () => {
    expect(names('zhills')).toEqual(['Skydive City (ZHills)']);
  });

  it('matches without diacritics', () => {
    expect(names('arhus')).toEqual(['Århus Faldskærm Club']);
    expect(names('faldskaerm')).toEqual(['Århus Faldskærm Club']);
  });

  it('requires every token to match', () => {
    expect(names('spaceland houston')).toEqual(['Skydive Spaceland Houston']);
    expect(names('spaceland denmark')).toEqual([]);
  });

  it('ranks a prefix above a mid-name hit', () => {
    expect(names('sky')[0]).toBe('Skydive Arizona');
    expect(names('sky')).not.toContain('Back field');
  });

  it('supports initials as a subsequence, below real word matches', () => {
    const ranked = names('sdaz');

    expect(ranked).toContain('Skydive Arizona');
  });

  it('puts a saved place above a dropzone that matches equally well', () => {
    const withFavorite = buildPlaces(DZS, [], ['Skydive Spaceland Houston']);
    const ranked = rankPlaces('skydive spaceland', withFavorite);

    expect(ranked[0].name).toBe('Skydive Spaceland Houston');
    expect(ranked[0].kind).toBe('favorite');
  });

  it('returns nothing when nothing matches', () => {
    expect(names('nowhere at all')).toEqual([]);
  });
});
