import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback, useEffect } from 'react';

import { SCHEMA_VERSION } from '../core/model';
import { FALLBACK_MODE_ID, ModeId, migrateModeId } from '../modes';
import { createVersionedCodec } from '../util/storage';

/**
 * FliP/FloP: the wordmark switches between flocking and the planner you were
 * in before it.
 *
 * "Before it" has to be remembered rather than derived — flocking is one mode
 * and there are two it can return to, and a reload must not forget which. A
 * pattern jumper who flips to FloP and comes back tomorrow should land back in
 * Standard Pattern, not in the fallback mode that happens to be swoop.
 */

const FLOCKING: ModeId = 'flocking';

/**
 * The stored return mode, validated. Anything unrecognised — and flocking
 * itself, which would make the switch a no-op — falls back.
 */
export function migrateReturnModeId(raw: unknown): ModeId {
  const id = migrateModeId(raw);

  return id && id !== FLOCKING ? id : FALLBACK_MODE_ID;
}

export interface UseFlipFlopResult {
  /** True in flocking: the wordmark reads FloP. */
  flocking: boolean;
  /** Switch to the other planner. */
  toggle: () => void;
}

export function useFlipFlop(modeId: ModeId, setModeId: (id: ModeId) => void): UseFlipFlopResult {
  const [storedReturnMode, setStoredReturnMode] = useLocalStorageState<ModeId>(
    'flip.mode.beforeFlocking',
    FALLBACK_MODE_ID,
    { codec: createVersionedCodec(SCHEMA_VERSION, migrateReturnModeId) }
  );
  const returnMode = migrateReturnModeId(storedReturnMode);
  const flocking = modeId === FLOCKING;

  // Recorded on arrival rather than on the way out, so a mode reached any
  // other way — the mode menu, a shortcut, a setup, ?mode= — is remembered
  // too. The wordmark is not the only door into flocking.
  useEffect(() => {
    if (!flocking && modeId !== storedReturnMode) {
      setStoredReturnMode(modeId);
    }
  }, [flocking, modeId, storedReturnMode, setStoredReturnMode]);

  const toggle = useCallback(
    () => setModeId(flocking ? returnMode : FLOCKING),
    [flocking, returnMode, setModeId]
  );

  return { flocking, toggle };
}
