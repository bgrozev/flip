/**
 * Whether the user has accepted the assumption-of-risk notice.
 *
 * The app is unusable until they have — see `components/RiskNotice` and the
 * overlay's placement in `App` — so this hook answers exactly one question
 * and records exactly one answer.
 *
 * The stored value carries the VERSION of the text accepted rather than a
 * boolean, so bumping `RISK_TEXT_VERSION` after a material rewrite re-asks
 * everyone. An acceptance of a NEWER version than this build knows about
 * still counts: a user who accepted on a newer deploy should not be asked
 * again by an older cached one.
 */
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback } from 'react';

import { RISK_TEXT_VERSION } from '../core/disclaimer';
import { SCHEMA_VERSION, migrateRiskAcceptance } from '../core/model';
import { RiskAcceptance } from '../types';
import { createVersionedCodec } from '../util/storage';

const codec = createVersionedCodec(SCHEMA_VERSION, migrateRiskAcceptance);

export interface RiskAcceptanceState {
  /** False while the notice still has to be shown. */
  accepted: boolean;
  accept: () => void;
}

export function useRiskAcceptance(): RiskAcceptanceState {
  const [stored, setStored] = useLocalStorageState<RiskAcceptance | null>(
    'flip.risk.accepted',
    null,
    { codec }
  );

  const accept = useCallback(
    () => setStored({ version: RISK_TEXT_VERSION, at: new Date().toISOString() }),
    [setStored]
  );

  return {
    accepted: stored !== null && stored !== undefined && stored.version >= RISK_TEXT_VERSION,
    accept
  };
}
