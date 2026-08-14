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
 *
 * The one exception is the numeric heading field, which comes back under NERD
 * mode between the card and the search: flying wants the handle, but someone
 * who already knows the runway heading wants to type it, and that is the nerd
 * test exactly.
 */
import { Stack } from '@mui/material';
import React from 'react';

import { TargetProvider } from '../hooks';
import { normalizeDirection } from '../core/validation';
import { Place, Target } from '../types';

import LocationHero from './LocationHero';
import NumberField from './NumberField';
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
  /**
   * Offer the numeric final-heading field (nerd mode's `headingField`, and
   * never in flocking, which has no final heading). Everyone else sets the
   * heading on the map or from the keyboard.
   */
  showHeadingField?: boolean;
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
  onToggleFavorite,
  showHeadingField = false
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
      {showHeadingField && (
        <NumberField
          title="The direction of the final approach. Set it on the map by dragging the target's heading handle, or click that handle to face the wind."
          label="Final heading"
          value={Math.round(target.finalHeading)}
          step={1}
          wrap={360}
          unit="°"
          onChange={value =>
            setTarget({ ...target, finalHeading: normalizeDirection(value) })}
        />
      )}
      <TargetProvider target={target} setTarget={setTarget} selectPlace={selectPlace}>
        <PlacePicker upwindHeading={upwindHeading} />
      </TargetProvider>
    </Stack>
  );
}
