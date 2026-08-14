// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BUILT_IN_PARAMS,
  fromCourseRelative,
  getTargetRelativeToCourse
} from '../core/courses';
import { Target } from '../types';

import CoursesComponent from './CoursesComponent';

const COURSE = BUILT_IN_PARAMS.find(c => c.id === 'skydive-city-distance')!;
const CENTER = { lat: COURSE.lat, lng: COURSE.lng };
const M_PER_FT = 0.3048;

/** A target at a stated depth and offset (feet) from the course centre. */
function targetAt(depthFt: number, offsetFt: number, finalHeading = COURSE.direction): Target {
  return {
    target: fromCourseRelative(
      depthFt * M_PER_FT,
      offsetFt * M_PER_FT,
      CENTER,
      COURSE.direction
    ),
    finalHeading
  };
}

/** What the panel would read back off a target, in feet. */
function relativeFeet(target: Target) {
  const rel = getTargetRelativeToCourse(target.target, CENTER, COURSE.direction);

  return { depth: rel.depth / M_PER_FT, offset: rel.offset / M_PER_FT };
}

function renderPanel(target: Target) {
  const onTargetChange = vi.fn();
  const view = render(
    <CoursesComponent
      selectedCourseId={COURSE.id}
      onSelect={vi.fn()}
      target={target}
      onTargetChange={onTargetChange}
      editOpen={false}
      onEditOpenChange={vi.fn()}
      altitudeUnit="ft"
      placeId={COURSE.placeId ?? null}
      placeName="Skydive City (ZHills)"
    />
  );

  const rerenderWith = (next: Target) =>
    view.rerender(
      <CoursesComponent
        selectedCourseId={COURSE.id}
        onSelect={vi.fn()}
        target={next}
        onTargetChange={onTargetChange}
        editOpen={false}
        onEditOpenChange={vi.fn()}
        altitudeUnit="ft"
        placeId={COURSE.placeId ?? null}
        placeName="Skydive City (ZHills)"
      />
    );

  return { onTargetChange, rerenderWith };
}

const CUSTOM = {
  id: 'custom-1',
  name: 'Big pond',
  type: 'distance' as const,
  lat: 28.2187,
  lng: -82.1514,
  direction: 197,
  placeId: COURSE.placeId
};

/** A custom course in storage, so the panel offers its edit fields. */
function seedCustomCourse(over: Partial<typeof CUSTOM> = {}) {
  window.localStorage.setItem(
    'flip.courses.custom',
    JSON.stringify({ schemaVersion: 1, doc: [{ ...CUSTOM, ...over }] })
  );
}

function renderWithCustom(course: typeof CUSTOM) {
  const onTargetChange = vi.fn();
  const props = (c: typeof CUSTOM) => ({
    selectedCourseId: c.id,
    onSelect: vi.fn(),
    target: targetAt(100, 25),
    onTargetChange,
    editOpen: false,
    onEditOpenChange: vi.fn(),
    altitudeUnit: 'ft' as const,
    placeId: COURSE.placeId ?? null,
    placeName: 'Skydive City (ZHills)'
  });

  seedCustomCourse(course);
  const view = render(<CoursesComponent {...props(course)} />);

  return {
    /** Re-seed storage as a map drag would, then re-render. */
    moveTo: (next: typeof CUSTOM) => {
      seedCustomCourse(next);
      window.dispatchEvent(new StorageEvent('storage', { key: 'flip.courses.custom' }));
      view.rerender(<CoursesComponent {...props(next)} />);
    }
  };
}

const depthField = () => screen.getByLabelText('Depth') as HTMLInputElement;
const offsetField = () => screen.getByLabelText('Offset') as HTMLInputElement;
const angleField = () => screen.getByLabelText('Approach angle') as HTMLInputElement;

describe('CoursesComponent — relative position', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads the target off the course', () => {
    renderPanel(targetAt(100, 25));

    expect(Number(depthField().value)).toBeCloseTo(100, 0);
    expect(Number(offsetField().value)).toBeCloseTo(25, 0);
  });

  // The target is dragged on the map while the panel is open. The fields
  // describe the target, so they have to follow it.
  it('follows the target when it moves on the map', () => {
    const { rerenderWith } = renderPanel(targetAt(100, 25));

    rerenderWith(targetAt(250, -40));

    expect(Number(depthField().value)).toBeCloseTo(250, 0);
    expect(Number(offsetField().value)).toBeCloseTo(-40, 0);
  });

  it('follows the final heading too', () => {
    const { rerenderWith } = renderPanel(targetAt(100, 25, COURSE.direction));

    expect(Number(angleField().value)).toBeCloseTo(0, 0);
    rerenderWith(targetAt(100, 25, COURSE.direction - 20));
    expect(Number(angleField().value)).toBeCloseTo(20, 0);
  });

  // Each field writes BOTH coordinates, so one holding a stale value drags
  // the target sideways the moment the other is stepped.
  it('does not move the target sideways when depth is stepped after a drag', () => {
    const { onTargetChange, rerenderWith } = renderPanel(targetAt(100, 25));

    rerenderWith(targetAt(250, -40));
    fireEvent.change(depthField(), { target: { value: '300' } });

    expect(onTargetChange).toHaveBeenCalled();
    const written = relativeFeet(onTargetChange.mock.calls.at(-1)![0]);

    expect(written.depth).toBeCloseTo(300, 0);
    expect(written.offset).toBeCloseTo(-40, 0);
  });

  it('does not move the target along the course when offset is stepped after a drag', () => {
    const { onTargetChange, rerenderWith } = renderPanel(targetAt(100, 25));

    rerenderWith(targetAt(250, -40));
    fireEvent.change(offsetField(), { target: { value: '10' } });

    const written = relativeFeet(onTargetChange.mock.calls.at(-1)![0]);

    expect(written.depth).toBeCloseTo(250, 0);
    expect(written.offset).toBeCloseTo(10, 0);
  });

  // Editing one coordinate must not quantise the other to the tenth of a foot
  // the field happens to display.
  it('keeps the untouched coordinate exactly where it was', () => {
    const start = targetAt(250, 40.06);
    const { onTargetChange } = renderPanel(start);

    fireEvent.change(depthField(), { target: { value: '300' } });

    const written = relativeFeet(onTargetChange.mock.calls.at(-1)![0]);

    expect(written.offset).toBeCloseTo(relativeFeet(start).offset, 6);
  });
});

// A custom course is dragged and rotated on the map in "Position on map"
// mode, so its own fields have the same obligation to follow.
describe('CoursesComponent — a custom course’s own fields', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const latField = () => screen.getByLabelText('Lat') as HTMLInputElement;
  const lngField = () => screen.getByLabelText('Lng') as HTMLInputElement;
  const dirField = () => screen.getByLabelText('Direction') as HTMLInputElement;

  it('shows where the course is', () => {
    renderWithCustom(CUSTOM);

    expect(latField().value).toBe(String(CUSTOM.lat));
    expect(lngField().value).toBe(String(CUSTOM.lng));
    expect(dirField().value).toBe(String(CUSTOM.direction));
  });

  it('follows a drag on the map', () => {
    const { moveTo } = renderWithCustom(CUSTOM);

    moveTo({ ...CUSTOM, lat: 28.22, lng: -82.15 });

    expect(latField().value).toBe('28.22');
    expect(lngField().value).toBe('-82.15');
  });

  it('follows a rotation on the map', () => {
    const { moveTo } = renderWithCustom(CUSTOM);

    moveTo({ ...CUSTOM, direction: 214.7563 });

    // Rounded to the thousandth: a rotate handle produces arbitrary precision.
    expect(dirField().value).toBe('214.756');
  });

  // The coordinate fields commit on blur, so an incoming value must not
  // overwrite half-typed text — which is what the focus refs are for.
  it('does not overwrite a coordinate being typed', () => {
    const { moveTo } = renderWithCustom(CUSTOM);

    fireEvent.focus(latField());
    fireEvent.change(latField(), { target: { value: '28.9' } });
    moveTo({ ...CUSTOM, lat: 28.5 });

    expect(latField().value).toBe('28.9');
  });
});
