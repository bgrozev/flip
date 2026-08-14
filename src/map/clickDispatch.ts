/**
 * Who gets a click on the map background.
 *
 * Pure, and shared by every provider container: the rule is part of the
 * adapter's contract, not of any one map library, and having it in two places
 * meant the two could drift.
 */
import { LatLng } from '../types';

import { MapClickModifiers } from './MapAdapter';

export interface ClickEntry {
  handler: (pos: LatLng, mods: MapClickModifiers) => void;
  /** Higher wins. Ties go to the later registration. */
  priority: number;
  /** Registration order, for tie-breaking. */
  seq: number;
  /** Watch every click without competing for it. */
  observe: boolean;
}

/**
 * Notify every observer, then the one competing handler that wins.
 *
 * Observers exist because "the map was pressed" and "the map was pressed HERE"
 * are different questions: closing a panel wants the first and must not take
 * the click away from the layer answering the second.
 */
export function dispatchMapClick(
  entries: readonly ClickEntry[],
  pos: LatLng,
  mods: MapClickModifiers
): void {
  const competing: ClickEntry[] = [];

  for (const entry of entries) {
    if (entry.observe) {
      entry.handler(pos, mods);
    } else {
      competing.push(entry);
    }
  }

  if (competing.length === 0) {
    return;
  }

  const top = competing.reduce((a, b) =>
    (b.priority > a.priority || (b.priority === a.priority && b.seq > a.seq) ? b : a));

  top.handler(pos, mods);
}
