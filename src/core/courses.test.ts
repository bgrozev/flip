import { describe, expect, it } from 'vitest';

import { CourseParams } from '../types';

import {
  BUILT_IN_PARAMS,
  courseIsAtPlace,
  courseChipLabel,
  courseTypeLabel,
  courseTypeShortLabel,
  coursesForPlace,
  defaultCourseName,
  duplicateCourseParams
} from './courses';

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

describe('defaultCourseName', () => {
  it('names a course after its type, matching the built-ins', () => {
    expect(defaultCourseName('distance', [])).toBe('Distance');
    expect(defaultCourseName('zone-accuracy', [])).toBe('Zone Accuracy');
    expect(defaultCourseName('speed', [])).toBe('Speed');
  });

  // A second speed course at one dropzone must be tellable from the first.
  it('numbers a name that is already in use', () => {
    expect(defaultCourseName('speed', ['Speed'])).toBe('Speed 2');
    expect(defaultCourseName('speed', ['Speed', 'Speed 2'])).toBe('Speed 3');
  });

  it('fills a gap left by a deleted course', () => {
    expect(defaultCourseName('speed', ['Speed', 'Speed 3'])).toBe('Speed 2');
  });

  it('ignores names of other types', () => {
    expect(defaultCourseName('speed', ['Distance', 'Zone Accuracy'])).toBe('Speed');
  });
});

describe('courseChipLabel', () => {
  const za = (over: Partial<CourseParams>): CourseParams => ({
    id: 'c1',
    name: 'Zone Accuracy',
    type: 'zone-accuracy',
    lat: 0,
    lng: 0,
    direction: 0,
    ...over
  });

  it('keeps the full name unless asked to shorten', () => {
    expect(courseChipLabel(za({}))).toBe('Zone Accuracy');
  });

  // A built-in is named after its type, so shortening its label is
  // shortening the type.
  it('shortens a built-in name', () => {
    expect(courseChipLabel(za({}), true)).toBe('ZoneAcc');
    expect(courseChipLabel(za({ name: 'Distance', type: 'distance' }), true))
      .toBe('Distance');
  });

  // A custom course keeps the name its owner gave it — that is the point of
  // naming one.
  it('leaves a custom name alone', () => {
    expect(courseChipLabel(za({ name: 'Big pond' }), true)).toBe('Big pond');
  });

  it('falls back to the type when there is no name', () => {
    expect(courseChipLabel(za({ name: '' }), true)).toBe('ZoneAcc');
    expect(courseChipLabel(za({ name: '' }))).toBe('Zone Accuracy');
  });
});

describe('courseTypeLabel', () => {
  it('labels every type', () => {
    expect(courseTypeLabel('distance')).toBe('Distance');
    expect(courseTypeLabel('speed')).toBe('Speed');
    expect(courseTypeLabel('zone-accuracy')).toBe('Zone Accuracy');
  });

  it('has a short form for the one that needs it', () => {
    expect(courseTypeShortLabel('zone-accuracy')).toBe('ZoneAcc');
    expect(courseTypeShortLabel('distance')).toBe('Distance');
    expect(courseTypeShortLabel('speed')).toBe('Speed');
  });

  // The built-in courses are named for their type, which is what lets the
  // list drop the redundant caption on their rows.
  it('matches what the built-in courses are called', () => {
    BUILT_IN_PARAMS.forEach(builtIn => {
      expect(builtIn.name).toBe(courseTypeLabel(builtIn.type));
    });
  });
});

describe('duplicateCourseParams', () => {
  const speed: CourseParams = {
    id: 'skydive-arizona-speed',
    name: 'Speed',
    type: 'speed',
    lat: 32.808,
    lng: -111.5818,
    direction: 163.722,
    carveDirection: 'right',
    placeId: ELOY
  };

  // The hand-written copy this replaced listed its fields, and carveDirection
  // was not among them: duplicating Eloy's right-carve speed course produced
  // a left-carve one, since buildCourse defaults the missing value to 'left'.
  it('carries the carve direction', () => {
    expect(duplicateCourseParams(speed).carveDirection).toBe('right');
  });

  it('keeps the original place, not wherever the user is', () => {
    expect(duplicateCourseParams(speed).placeId).toBe(ELOY);
  });

  it('marks the name and drops the id', () => {
    const copy = duplicateCourseParams(speed);

    expect(copy.name).toBe('Speed (copy)');
    expect(copy).not.toHaveProperty('id');
  });

  it('leaves an unassigned course unassigned', () => {
    expect(duplicateCourseParams(course('a')).placeId).toBeUndefined();
  });
});
