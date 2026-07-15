import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback, useMemo } from 'react';

import { SCHEMA_VERSION } from '../core/model';
import { FALLBACK_MODE_ID, Mode, ModeId, getMode, migrateModeId } from '../modes';
import { createVersionedCodec } from '../util/storage';

interface UseModeResult {
  /** The active mode driving the UI. */
  mode: Mode;
  /** Stored choice; null = the user has not picked a mode yet. */
  storedModeId: ModeId | null;
  setModeId: (id: ModeId) => void;
  /** True until a mode has been chosen (shows the first-run picker). */
  firstRun: boolean;
}

/**
 * Mode selection, persisted via the versioned-storage mechanism.
 *
 * `urlModeId` (from ?mode=..., already validated) takes effect immediately
 * for the current render; the caller persists it separately. Until any
 * mode is chosen, the UI runs in the fallback (full) mode behind the
 * first-run picker so nothing disappears for pre-mode users.
 */
export function useMode(urlModeId: ModeId | null = null): UseModeResult {
  const [storedModeId, setStoredModeId] = useLocalStorageState<ModeId | null>(
    'flip.mode',
    null,
    { codec: createVersionedCodec(SCHEMA_VERSION, migrateModeId) }
  );

  const setModeId = useCallback(
    (id: ModeId) => setStoredModeId(migrateModeId(id)),
    [setStoredModeId]
  );

  const activeModeId = urlModeId ?? storedModeId ?? FALLBACK_MODE_ID;
  const mode = useMemo(() => getMode(activeModeId), [activeModeId]);

  return {
    mode,
    storedModeId: storedModeId ?? null,
    setModeId,
    firstRun: urlModeId === null && storedModeId === null
  };
}
