import React from 'react';

/**
 * Select a field's contents when it takes focus, so the next keystroke replaces
 * the value instead of appending to it.
 *
 * Reach for this on a field that ARRIVES WITH A VALUE the user typically
 * replaces wholesale — a number, a coordinate, the current name in a rename
 * dialog. Not on free text (a description, a search box you refine), where
 * landing the caret where you clicked is the point, and not on a native date or
 * time input, which owns its own selection behaviour.
 *
 * `NumberField` applies it for every numeric field in the app; this is for the
 * ones that cannot be a `NumberField` because what they hold is not a plain
 * bounded number.
 */
export default function selectOnFocus(
  // MUI's `TextField` hands its handler either element, so take both.
  event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
): void {
  event.target.select();
}
