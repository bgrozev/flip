import * as turf from '@turf/turf';
import { describe, expect, it } from 'vitest';

import { CourseParams, FlightPoint, ManoeuvreParams, Setup, Target } from '../types';

import { getTargetRelativeToCourse } from './courses';
import { DEFAULT_FLOCKING_PARAMS, DEFAULT_MANOEUVRE_CONFIG, DEFAULT_PATTERN_PARAMS } from './model';
import {
  SetupSnapshot,
  canCopyRelative,
  describeSetup,
  describeSetupDiff,
  isSetupDirty,
  planSetupCopy,
  setupDiff,
  turnLabel
} from './setups';
import { normalizeRelativeAngle } from './validation';

const ZHILLS: Target = { target: { lat: 28.21952, lng: -82.15154 }, finalHeading: 180 };

const PARAMS_450: ManoeuvreParams = {
  turnDirection: 'left',
  rotationDeg: 450,
  altitudeFt: 900,
  depthFt: 300,
  offsetFt: 150,
  duration: 8
};

function pt(lng: number, lat: number, time: number): FlightPoint {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { alt: 1000 - time * 10, time, pom: false }
  };
}

/** North, then west: a left 90, measured off the path like a real track. */
function quarterTurnPath(): FlightPoint[] {
  return [pt(0, 0, 0), pt(0, 0.01, 1), pt(-0.01, 0.02, 2), pt(-0.02, 0.02, 3)];
}

const siteBound: Setup = {
  id: 'setup_1',
  name: 'ZHills ZoneAcc',
  canopy: 'SAW 75',
  modeId: 'swoop',
  patternParams: DEFAULT_PATTERN_PARAMS,
  manoeuvre: DEFAULT_MANOEUVRE_CONFIG,
  site: { placeId: 'dz:Skydive City', target: ZHILLS, selectedCourseId: 'course_za' },
  createdAt: 1
};

const portable: Setup = {
  id: 'setup_2',
  name: 'Comp canopy',
  canopy: 'SAW 75',
  modeId: 'swoop',
  patternParams: DEFAULT_PATTERN_PARAMS,
  manoeuvre: DEFAULT_MANOEUVRE_CONFIG,
  createdAt: 2
};

const snapshot: SetupSnapshot = {
  modeId: 'swoop',
  patternParams: DEFAULT_PATTERN_PARAMS,
  manoeuvre: DEFAULT_MANOEUVRE_CONFIG,
  flockingParams: DEFAULT_FLOCKING_PARAMS,
  target: ZHILLS,
  placeId: 'dz:Skydive City',
  selectedCourseId: 'course_za'
};

describe('setupDiff', () => {
  it('is clean when nothing has changed', () => {
    expect(isSetupDirty(setupDiff(snapshot, siteBound))).toBe(false);
  });

  it('is clean with no setup loaded', () => {
    expect(isSetupDirty(setupDiff(snapshot, null))).toBe(false);
  });

  it('reports the pattern', () => {
    const diff = setupDiff(
      { ...snapshot, patternParams: { ...DEFAULT_PATTERN_PARAMS, glideRatio: 2.4 } },
      siteBound
    );

    expect(diff.pattern).toBe(true);
    expect(diff.manoeuvre).toBe(false);
    expect(describeSetupDiff(diff)).toBe('pattern');
  });

  it('reports the target and the course together', () => {
    const diff = setupDiff(
      {
        ...snapshot,
        target: { target: { lat: 28.22, lng: -82.15 }, finalHeading: 180 },
        selectedCourseId: 'course_speed'
      },
      siteBound
    );

    expect(describeSetupDiff(diff)).toBe('target and course');
  });

  // A portable setup describes a canopy and a turn; taking them to another
  // dropzone is what it is FOR, so moving must not make it look modified.
  it('never dirties a portable setup by moving', () => {
    const diff = setupDiff(
      {
        ...snapshot,
        placeId: 'dz:Skydive Arizona',
        target: { target: { lat: 32.8, lng: -111.6 }, finalHeading: 30 },
        selectedCourseId: null
      },
      portable
    );

    expect(isSetupDirty(diff)).toBe(false);
  });

  // Flocking params are global, so an unrelated flocking edit must not make
  // a swoop setup look modified.
  it('ignores flocking params for a setup that stores none', () => {
    const diff = setupDiff(
      { ...snapshot, flockingParams: { ...DEFAULT_FLOCKING_PARAMS, windowTopFt: 13000 } },
      siteBound
    );

    expect(diff.flocking).toBe(false);
  });

  it('reports flocking params for a setup that stores them', () => {
    const flockingSetup: Setup = { ...siteBound, flockingParams: DEFAULT_FLOCKING_PARAMS };
    const diff = setupDiff(
      { ...snapshot, flockingParams: { ...DEFAULT_FLOCKING_PARAMS, windowTopFt: 13000 } },
      flockingSetup
    );

    expect(diff.flocking).toBe(true);
  });

  // Storage round-trips and re-derivations wobble in the last bits; a drag is
  // metres. Comparing exactly would eventually strand a setup as "modified".
  it('does not call float noise a change', () => {
    const diff = setupDiff(
      {
        ...snapshot,
        target: {
          target: { lat: ZHILLS.target.lat + 1e-12, lng: ZHILLS.target.lng - 1e-12 },
          finalHeading: ZHILLS.finalHeading + 1e-12
        }
      },
      siteBound
    );

    expect(diff.target).toBe(false);
  });

  it('does call a one-degree heading step a change', () => {
    const diff = setupDiff(
      { ...snapshot, target: { ...ZHILLS, finalHeading: 181 } },
      siteBound
    );

    expect(diff.target).toBe(true);
  });

  it('sees a heading that wrapped past north as unchanged', () => {
    const diff = setupDiff(
      { ...snapshot, target: { ...ZHILLS, finalHeading: 180 + 360 } },
      siteBound
    );

    expect(diff.target).toBe(false);
  });
});

describe('turnLabel', () => {
  it('names a parametric turn', () => {
    expect(turnLabel({ type: 'parameters', params: { ...PARAMS_450 } }))
      .toBe('450 L');
  });

  it('names the other hand', () => {
    expect(
      turnLabel({
        type: 'parameters',
        params: { ...PARAMS_450, turnDirection: 'right' }
      })
    ).toBe('450 R');
  });

  it('falls back to a track name when the track has no data', () => {
    expect(turnLabel({ type: 'track', trackName: 'jump-42.csv' })).toBe('jump-42.csv');
  });

  it('takes a sample\'s hand from the flag, not the path', () => {
    // The library stores one hand; `sampleLeft: false` mirrors it.
    const path = quarterTurnPath();

    expect(turnLabel({ type: 'samples', sampleIndex: 0, sampleLeft: false }, path))
      .toMatch(/ R$/);
    expect(turnLabel({ type: 'samples', sampleIndex: 0, sampleLeft: true }, path))
      .toMatch(/ L$/);
  });
});

describe('describeSetup', () => {
  it('reads canopy, turn and course', () => {
    const course: CourseParams = {
      id: 'course_za',
      name: 'Zone Accuracy',
      type: 'zone-accuracy',
      lat: 28.2,
      lng: -82.15,
      direction: 0
    };

    expect(describeSetup(siteBound, { course })).toEqual(['SAW 75', '90 L', 'Zone Accuracy']);
  });

  // Under "At <place>" the heading already says it; under "Other dropzones"
  // and in the manage dialog nothing does, which is why the name no longer
  // has to carry it.
  it('names the dropzone when asked, first', () => {
    expect(describeSetup(siteBound, { place: 'Skydive City (ZHills)' }))
      .toEqual(['Skydive City (ZHills)', 'SAW 75', '90 L']);
    expect(describeSetup(siteBound)).toEqual(['SAW 75', '90 L']);
  });

  it('shortens the course label on request', () => {
    const course: CourseParams = {
      id: 'za',
      name: 'Zone Accuracy',
      type: 'zone-accuracy',
      lat: 28.2,
      lng: -82.15,
      direction: 0
    };

    expect(describeSetup(siteBound, { course, shortCourse: true }))
      .toEqual(['SAW 75', '90 L', 'ZoneAcc']);
  });

  it('names the mode only when it is not the one you are in', () => {
    expect(describeSetup(siteBound, { activeModeId: 'swoop' })).toEqual(['SAW 75', '90 L']);
    expect(describeSetup(siteBound, { activeModeId: 'pattern' }))
      .toEqual(['swoop', 'SAW 75', '90 L']);
  });

  it('has no turn to name in flocking', () => {
    const flocking: Setup = { ...siteBound, modeId: 'flocking' };

    expect(describeSetup(flocking)).toEqual(['SAW 75']);
  });
});

describe('planSetupCopy', () => {
  const sourceCourse: CourseParams = {
    id: 'course_za',
    name: 'Zone Accuracy',
    type: 'zone-accuracy',
    lat: 28.219,
    lng: -82.151,
    direction: 0,
    placeId: 'dz:Skydive City'
  };
  // Another dropzone, and pointed a different way — which is the whole point:
  // the copy has to turn with the course it lands on.
  const destZa: CourseParams = {
    id: 'az_za',
    name: 'ZA pond',
    type: 'zone-accuracy',
    lat: 32.8092,
    lng: -111.5806,
    direction: 115,
    placeId: 'dz:Skydive Arizona'
  };
  const destDistance: CourseParams = {
    id: 'az_distance',
    name: 'Distance',
    type: 'distance',
    lat: 32.81,
    lng: -111.58,
    direction: 40,
    placeId: 'dz:Skydive Arizona'
  };
  const elsewhereTarget: Target = {
    target: { lat: 32.8, lng: -111.6 },
    finalHeading: 30
  };

  const plan = (over: Partial<Parameters<typeof planSetupCopy>[0]> = {}) =>
    planSetupCopy({
      setup: siteBound,
      sourceCourse,
      destinationCourses: [destDistance, destZa],
      destinationSelectedCourseId: null,
      currentTarget: elsewhereTarget,
      relative: true,
      ...over
    });

  it('carries depth, offset and approach angle onto the matching course', () => {
    const before = getTargetRelativeToCourse(
      siteBound.site!.target.target,
      { lat: sourceCourse.lat, lng: sourceCourse.lng },
      sourceCourse.direction
    );
    const result = plan();

    expect(result.course?.id).toBe('az_za');

    const after = getTargetRelativeToCourse(
      result.target.target,
      { lat: destZa.lat, lng: destZa.lng },
      destZa.direction
    );

    expect(after.depth).toBeCloseTo(before.depth, 3);
    expect(after.offset).toBeCloseTo(before.offset, 3);
    expect(
      normalizeRelativeAngle(destZa.direction - result.target.finalHeading)
    ).toBeCloseTo(
      normalizeRelativeAngle(sourceCourse.direction - siteBound.site!.target.finalHeading),
      6
    );
  });

  it('lands the copy at the destination, not the source', () => {
    const result = plan();
    const at = (t: Target) => [t.target.lng, t.target.lat];
    const fromDestination = turf.distance(at(result.target), [destZa.lng, destZa.lat], {
      units: 'meters'
    });
    const fromSourceTarget = turf.distance(at(result.target), at(siteBound.site!.target), {
      units: 'meters'
    });

    // Beside the destination course, and a continent away from where the
    // setup was saved.
    expect(fromDestination).toBeLessThan(500);
    expect(fromSourceTarget).toBeGreaterThan(2_000_000);
  });

  // Rule 1: an explicit selection wins whatever its type — the user is
  // looking at it.
  it('uses the selected course even when the type does not match', () => {
    expect(plan({ destinationSelectedCourseId: 'az_distance' }).course?.id)
      .toBe('az_distance');
  });

  // Rule 3: no course of the source's type, so the first one there.
  it('falls back to any course at the destination', () => {
    expect(plan({ destinationCourses: [destDistance] }).course?.id).toBe('az_distance');
  });

  it('keeps the current target when the destination has no courses', () => {
    const result = plan({ destinationCourses: [] });

    expect(result.course).toBeNull();
    expect(result.target).toEqual(elsewhereTarget);
  });

  it('keeps the current target when the setup was not on a course', () => {
    const result = plan({ sourceCourse: null });

    expect(result.course).toBeNull();
    expect(result.target).toEqual(elsewhereTarget);
  });

  it('keeps the current target when the switch is off', () => {
    const result = plan({ relative: false });

    expect(result.course).toBeNull();
    expect(result.target).toEqual(elsewhereTarget);
  });

  it('knows when the switch is worth offering', () => {
    expect(canCopyRelative(sourceCourse, [destZa])).toBe(true);
    expect(canCopyRelative(null, [destZa])).toBe(false);
    expect(canCopyRelative(sourceCourse, [])).toBe(false);
  });
});
