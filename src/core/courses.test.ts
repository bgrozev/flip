import { describe, expect, it } from 'vitest';

import { CourseParams } from '../types';

import { BUILT_IN_PARAMS, courseIsAtPlace, coursesForPlace } from './courses';

function course(id: string, placeId?: string): CourseParams {
  return { id, name: id, type: 'distance', lat: 0, lng: 0, direction: 0, placeId };
}

const ELOY = 'dz:Skydive Arizona';
const ZHILLS = 'dz:Skydive City (ZHills)';

describe('course scoping', () => {
  it('ships every built-in course with the dropzone it is at', () => {
    expect(BUILT_IN_PARAMS.every(c => typeof c.placeId === 'string' && c.placeId !== ''))
      .toBe(true);
  });

  it('gives each dropzone its own courses', () => {
    const { atPlace } = coursesForPlace(BUILT_IN_PARAMS, ELOY);

    expect(atPlace.map(c => c.id)).toEqual([
      'skydive-arizona-distance',
      'skydive-arizona-speed',
      'skydive-arizona-za'
    ]);
  });

  it('offers nothing built-in at a dropzone that ships none', () => {
    expect(coursesForPlace(BUILT_IN_PARAMS, 'dz:Skydive Atlanta').atPlace).toEqual([]);
    expect(coursesForPlace(BUILT_IN_PARAMS, null).atPlace).toEqual([]);
  });

  describe('courseIsAtPlace', () => {
    it('matches only its own place', () => {
      expect(courseIsAtPlace(course('a', ELOY), ELOY)).toBe(true);
      expect(courseIsAtPlace(course('a', ELOY), ZHILLS)).toBe(false);
      expect(courseIsAtPlace(course('a', ELOY), null)).toBe(false);
    });

    // The custom courses of users from before courses were scoped: offered
    // everywhere rather than hidden or guessed at.
    it('treats a course with no place as belonging everywhere', () => {
      expect(courseIsAtPlace(course('a'), ELOY)).toBe(true);
      expect(courseIsAtPlace(course('a'), null)).toBe(true);
    });
  });

  describe('coursesForPlace', () => {
    const all = [course('here', ELOY), course('there', ZHILLS), course('nowhere')];

    it('splits by place and hides the ones from elsewhere', () => {
      const { atPlace, unassigned, elsewhere } = coursesForPlace(all, ELOY);

      expect(atPlace.map(c => c.id)).toEqual(['here']);
      expect(unassigned.map(c => c.id)).toEqual(['nowhere']);
      expect(elsewhere).toEqual([]);
    });

    // A preset can name a course saved at another dropzone; it has to stay in
    // the list or the picker falls back to rendering its raw id.
    it('keeps a named course from another place', () => {
      const { atPlace, elsewhere } = coursesForPlace(all, ELOY, 'there');

      expect(atPlace.map(c => c.id)).toEqual(['here']);
      expect(elsewhere.map(c => c.id)).toEqual(['there']);
    });

    it('does not duplicate the named course when it is already here', () => {
      const { atPlace, elsewhere } = coursesForPlace(all, ELOY, 'here');

      expect(atPlace.map(c => c.id)).toEqual(['here']);
      expect(elsewhere).toEqual([]);
    });

    it('offers only the unassigned ones when no place is active', () => {
      const { atPlace, unassigned } = coursesForPlace(all, null);

      expect(atPlace).toEqual([]);
      expect(unassigned.map(c => c.id)).toEqual(['nowhere']);
    });
  });
});
