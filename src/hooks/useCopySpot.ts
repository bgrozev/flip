/**
 * Handing the spot on: to the clipboard, or straight into whatever the
 * phone shares with.
 *
 * The spot is what flocking exists to produce, and it leaves FliP by being
 * sent to a pilot — so every surface that shows it can also give it away,
 * through this one hook. Sharing is preferred where the platform has it
 * (a phone's share sheet reaches the message the pilot is actually going
 * to read); everything else copies.
 */
import { useCallback } from 'react';

import { useNotifications } from './useNotifications';

/**
 * An intersection rather than an extension: the DOM lib declares `share` as
 * always present, which is exactly the claim this hook has to check.
 */
type ShareCapableNavigator = Navigator & {
  share?: (data: { text: string }) => Promise<void>;
};

/** Older browsers and any insecure origin have no async clipboard. */
async function writeClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}

export interface CopySpot {
  /** Copy the given text, telling the user whether it worked. */
  copy: (text: string) => void;
  /** Share it if the platform can, else copy. */
  share: (text: string) => void;
  /** Whether a share sheet exists — decides if the Share button is shown. */
  canShare: boolean;
}

export function useCopySpot(): CopySpot {
  const { notify } = useNotifications();
  const canShare = typeof navigator !== 'undefined' &&
    typeof (navigator as ShareCapableNavigator).share === 'function';

  const copy = useCallback((text: string) => {
    writeClipboard(text).then(ok => notify(
      ok ? `Copied: ${text}` : 'Could not copy the spot',
      ok ? 'success' : 'error'
    ));
  }, [notify]);

  const share = useCallback((text: string) => {
    const share_ = (navigator as ShareCapableNavigator).share;

    if (!share_) {
      copy(text);

      return;
    }

    // A cancelled share sheet rejects; that is the user changing their mind,
    // not a failure to report.
    share_.call(navigator, { text }).catch(() => undefined);
  }, [copy]);

  return { copy, share, canShare };
}
