/**
 * The Location panel: where you are planning, and how to go somewhere else.
 *
 * It used to be the Target panel, and it used to edit the target — a final
 * heading field with an "Upwind" button, under a paragraph explaining that
 * you could also drag the target on the map. Now that the target is always
 * draggable and the heading has its own handle on it, none of that was the
 * panel's job: the map edits the target, the panel chooses the place. The
 * heading keeps its keyboard bindings (`<` `>` coarse, `,` `.` fine, `u` into
 * wind), which the shortcuts overlay lists.
 *
 * So the panel opens with the answer to its own question — which place, in
 * display type — and everything below it is how to change that.
 */
import { Stack } from '@mui/material';
import React from 'react';

import { TargetProvider } from '../hooks';
import { Place, Target } from '../types';

import LocationHero from './LocationHero';
import { PlacePicker } from './';

interface TargetComponentProps {
  target: Target;
  setTarget: (target: Target) => void;
  /** Applies a place chosen in the picker — every mode, not just this one. */
  selectPlace: (target: Target) => void;
  /**
   * Heading that lands into wind — the current wind direction, or null when
   * there is no usable wind. The fallback heading for places with no known
   * landing direction.
   */
  upwindHeading: number | null;
  /** The active place, or null when the target belongs to none. */
  activePlace: Place | null;
  /** How far the target sits from the active place, formatted; absent if on it. */
  placeOffsetLabel?: string;
  /** Put the target back on the active place's own coordinates. */
  onResetToPlace: () => void;
  isFavorite: boolean;
  onToggleFavorite?: () => void;
}

export default function TargetComponent({
  target,
  setTarget,
  selectPlace,
  upwindHeading,
  activePlace,
  placeOffsetLabel,
  onResetToPlace,
  isFavorite,
  onToggleFavorite
}: TargetComponentProps) {
  return (
    <Stack spacing={2}>
      <LocationHero
        place={activePlace}
        targetLat={target.target.lat}
        targetLng={target.target.lng}
        offsetLabel={placeOffsetLabel}
        onResetToPlace={onResetToPlace}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />
      <TargetProvider target={target} setTarget={setTarget} selectPlace={selectPlace}>
        <PlacePicker upwindHeading={upwindHeading} />
      </TargetProvider>
    </Stack>
  );
}
