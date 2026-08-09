/**
 * Setups: a named arrangement of everything a jump is planned with.
 *
 * Two things live here, both pure. The first is the DIFF — a setup is a
 * document, so the app has to be able to say whether what is on screen is
 * still the setup that was loaded, and which parts of it are not. The second
 * is the COPY — taking a setup to another dropzone while keeping where it
 * sits relative to a course, which is the whole point of having three of
 * them for one comp.
 */
import {
  CourseParams,
  FlightPath,
  ManoeuvreConfig,
  PatternParams,
  Setup,
  Target
} from '../types';

import { courseTypeLabel, fromCourseRelative, getTargetRelativeToCourse } from './courses';
import { FlockingParams } from './flocking';
import { describeManoeuvrePath } from './manoeuvre';
import { normalizeDirection, normalizeRelativeAngle } from './validation';

/**
 * What is on screen right now, in the shape a setup stores it. The site
 * fields are always present here — the app always has a target — and are
 * only compared against a setup that has a site of its own.
 */
export interface SetupSnapshot {
  modeId: string;
  patternParams: PatternParams;
  manoeuvre: ManoeuvreConfig;
  flockingParams: FlockingParams;
  target: Target;
  placeId: string | null;
  selectedCourseId: string | null;
}

export interface SetupDiff {
  pattern: boolean;
  manoeuvre: boolean;
  flocking: boolean;
  target: boolean;
  course: boolean;
  place: boolean;
}

const NO_DIFF: SetupDiff = {
  pattern: false,
  manoeuvre: false,
  flocking: false,
  target: false,
  course: false,
  place: false
};

/**
 * Below any edit a human can make: a drag is metres and a heading step is a
 * degree, while a value that has been through storage and back differs by
 * nothing at all. Comparing exactly would work today and turn a rounding
 * change somewhere else into a setup that is permanently "modified".
 */
const COORD_EPSILON_DEG = 1e-7;
const HEADING_EPSILON_DEG = 1e-6;

function sameDocument(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameTarget(a: Target, b: Target): boolean {
  return (
    Math.abs(a.target.lat - b.target.lat) < COORD_EPSILON_DEG &&
    Math.abs(a.target.lng - b.target.lng) < COORD_EPSILON_DEG &&
    Math.abs(normalizeRelativeAngle(a.finalHeading - b.finalHeading)) < HEADING_EPSILON_DEG
  );
}

/**
 * Which parts of the current state no longer match the setup it came from.
 *
 * A setup with no site is never dirty for having moved: it describes a canopy
 * and a turn, and taking them to another dropzone is what it is FOR. Flocking
 * params only count for a setup that stores them, so an unrelated flocking
 * edit cannot make a swoop setup look modified.
 */
export function setupDiff(current: SetupSnapshot, stored: Setup | null): SetupDiff {
  if (!stored) {
    return NO_DIFF;
  }

  const site = stored.site ?? null;

  return {
    pattern: !sameDocument(current.patternParams, stored.patternParams),
    manoeuvre: !sameDocument(current.manoeuvre, stored.manoeuvre),
    flocking: stored.flockingParams !== undefined &&
      !sameDocument(current.flockingParams, stored.flockingParams),
    target: site !== null && !sameTarget(current.target, site.target),
    course: site !== null && current.selectedCourseId !== site.selectedCourseId,
    place: site !== null && current.placeId !== site.placeId
  };
}

export function isSetupDirty(diff: SetupDiff): boolean {
  return Object.values(diff).some(Boolean);
}

/** "pattern and target", for the tooltip that says what is unsaved. */
export function describeSetupDiff(diff: SetupDiff): string {
  const parts: string[] = [];

  if (diff.pattern) parts.push('pattern');
  if (diff.manoeuvre) parts.push('turn');
  if (diff.flocking) parts.push('flocking');
  if (diff.place) parts.push('place');
  if (diff.target) parts.push('target');
  if (diff.course) parts.push('course');

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Measured rotations land near a round turn; name the round one. */
function roundRotation(deg: number): number {
  return Math.round(deg / 5) * 5;
}

/**
 * "450 L" — the turn, however it is described. A parametric turn states its
 * rotation, and a track or a sample only has one measured off the path, so
 * those read as approximate. The sample library stores one hand, so its
 * direction comes from the flag rather than from the path.
 */
export function turnLabel(
  config: ManoeuvreConfig,
  samplePath?: FlightPath | null
): string | null {
  if (config.type === 'parameters') {
    const params = config.params;

    if (!params) return null;

    return `${Math.round(params.rotationDeg)} ${params.turnDirection === 'left' ? 'L' : 'R'}`;
  }

  if (config.type === 'samples') {
    if (!samplePath) return null;
    const measured = describeManoeuvrePath(samplePath);

    if (!measured) return null;

    return `${roundRotation(Math.abs(measured.rotationDeg))} ${config.sampleLeft === false ? 'R' : 'L'}`;
  }

  const measured = config.trackData ? describeManoeuvrePath(config.trackData) : null;

  if (!measured) {
    return config.trackName ?? null;
  }

  return `≈${roundRotation(Math.abs(measured.rotationDeg))} ${measured.rotationDeg < 0 ? 'L' : 'R'}`;
}

export interface DescribeSetupContext {
  /** The setup's own course, already resolved — it may live at another place. */
  course?: CourseParams | null;
  /** The sample the setup's manoeuvre names, for a rotation to be measured off. */
  samplePath?: FlightPath | null;
  /** Named only when it differs from the mode the user is in. */
  activeModeId?: string;
  modeLabel?: (modeId: string) => string;
}

/**
 * The line under a setup's name: "SAW 75 · 450 L · Zone Accuracy". Every part
 * but the canopy is derived, so nothing here can disagree with the setup it
 * describes. Flocking has no turn to name.
 */
export function describeSetup(setup: Setup, ctx: DescribeSetupContext = {}): string[] {
  const chips: string[] = [];
  const isFlocking = setup.modeId === 'flocking';

  if (setup.modeId && ctx.activeModeId && setup.modeId !== ctx.activeModeId) {
    chips.push(ctx.modeLabel ? ctx.modeLabel(setup.modeId) : setup.modeId);
  }

  if (setup.canopy) {
    chips.push(setup.canopy);
  }

  if (!isFlocking) {
    const turn = turnLabel(setup.manoeuvre, ctx.samplePath);

    if (turn) chips.push(turn);
  }

  if (ctx.course) {
    chips.push(ctx.course.name || courseTypeLabel(ctx.course.type));
  }

  return chips;
}

/**
 * The state loading a setup puts the app in: the setup where it says
 * something, what is already on screen where it does not. A portable setup
 * says nothing about where you are, so you stay there.
 */
export function snapshotOfSetup(setup: Setup, current: SetupSnapshot): SetupSnapshot {
  return {
    modeId: setup.modeId ?? current.modeId,
    patternParams: setup.patternParams,
    manoeuvre: setup.manoeuvre,
    flockingParams: setup.flockingParams ?? current.flockingParams,
    target: setup.site ? setup.site.target : current.target,
    placeId: setup.site ? setup.site.placeId : current.placeId,
    selectedCourseId: setup.site ? setup.site.selectedCourseId : current.selectedCourseId
  };
}

/** The site half as a setup stores it, taken from what is on screen. */
export function siteOfSnapshot(current: SetupSnapshot) {
  return {
    placeId: current.placeId,
    target: current.target,
    selectedCourseId: current.selectedCourseId
  };
}

export interface GroupedSetups {
  /** Bound to the place you are at. */
  here: Setup[];
  /** No site at all: a canopy and a turn, which travel. */
  anywhere: Setup[];
  /** Bound to some other dropzone. */
  elsewhere: Setup[];
}

/**
 * The menu's three groups. "Here" and "anywhere" are what you can act on
 * without going anywhere; the rest are still listed, because a setup you
 * cannot find is a setup you will save again.
 */
export function groupSetups(
  setups: readonly Setup[],
  placeId: string | null
): GroupedSetups {
  const grouped: GroupedSetups = { here: [], anywhere: [], elsewhere: [] };

  setups.forEach(setup => {
    if (!setup.site) {
      grouped.anywhere.push(setup);
    } else if (setup.site.placeId === placeId) {
      grouped.here.push(setup);
    } else {
      grouped.elsewhere.push(setup);
    }
  });

  return grouped;
}

export interface SetupCopyPlan {
  /**
   * The course at the destination the copy is positioned against, or null
   * when it simply takes the target as it stands.
   */
  course: CourseParams | null;
  target: Target;
}

export interface SetupCopyParams {
  setup: Setup;
  /** The setup's own course, resolved — it belongs to the place being copied FROM. */
  sourceCourse: CourseParams | null;
  /** Courses available at the destination, in the order the panel lists them. */
  destinationCourses: readonly CourseParams[];
  /** What is selected at the destination right now; an explicit choice wins. */
  destinationSelectedCourseId: string | null;
  /** Where the target is now — what the copy gets when nothing is course-relative. */
  currentTarget: Target;
  /** Whether to carry the course-relative position over at all. */
  relative: boolean;
}

/**
 * Picks the course a copy is positioned against, silently.
 *
 * An explicit selection wins whatever its type — the user is looking at it.
 * Failing that the same type as the source, which is the case this exists
 * for: a Distance setup lands on the Distance course at the new dropzone.
 * Failing THAT, the first course there: a pond is a pond, the offset is
 * visible on the map the moment the copy loads, and dragging it is one
 * gesture. Nothing at all means the copy just keeps the target it has.
 */
function pickDestinationCourse(
  sourceCourse: CourseParams,
  destinationCourses: readonly CourseParams[],
  destinationSelectedCourseId: string | null
): CourseParams | null {
  const selected = destinationCourses.find(c => c.id === destinationSelectedCourseId);

  if (selected) return selected;

  const sameType = destinationCourses.find(c => c.type === sourceCourse.type);

  if (sameType) return sameType;

  return destinationCourses[0] ?? null;
}

/**
 * Where a copy of this setup lands at another dropzone.
 *
 * The relative position is not stored anywhere — the Courses panel derives it
 * from the absolute target every time it renders — so a copy measures it off
 * the setup's own target and re-lays it against the destination's course.
 * Depth, offset and the approach angle all carry, which means the copy is
 * turned the way the new course is turned, not the way the old one was.
 */
export function planSetupCopy(params: SetupCopyParams): SetupCopyPlan {
  const { setup, sourceCourse, destinationCourses, destinationSelectedCourseId } = params;
  const source = setup.site;

  if (!params.relative || !sourceCourse || !source) {
    return { course: null, target: params.currentTarget };
  }

  const course = pickDestinationCourse(
    sourceCourse,
    destinationCourses,
    destinationSelectedCourseId
  );

  if (!course) {
    return { course: null, target: params.currentTarget };
  }

  const sourceCenter = { lat: sourceCourse.lat, lng: sourceCourse.lng };
  const relative = getTargetRelativeToCourse(
    source.target.target,
    sourceCenter,
    sourceCourse.direction
  );
  const approachAngle = normalizeRelativeAngle(
    sourceCourse.direction - source.target.finalHeading
  );

  return {
    course,
    target: {
      target: fromCourseRelative(
        relative.depth,
        relative.offset,
        { lat: course.lat, lng: course.lng },
        course.direction
      ),
      finalHeading: normalizeDirection(course.direction - approachAngle)
    }
  };
}

/**
 * Whether a copy could be positioned against a course at all — the switch in
 * the copy dialog is only meaningful when there is something to preserve and
 * somewhere to preserve it against.
 */
export function canCopyRelative(
  sourceCourse: CourseParams | null,
  destinationCourses: readonly CourseParams[]
): boolean {
  return sourceCourse !== null && destinationCourses.length > 0;
}
