/**
 * One-shot browser geolocation.
 *
 * Strictly opt-in: nothing here runs until `request()` is called, so the
 * permission prompt only ever appears in response to a tap. Everything that
 * uses it must work without it — a denial, a timeout or a browser with no
 * geolocation at all resolves to `null` and sets a status the caller can
 * show. It never throws and never rejects.
 */
import { useRef, useState } from 'react';

import { LatLng } from '../types';

export type GeolocationStatus = 'idle' | 'locating' | 'ready' | 'unavailable' | 'denied' | 'error';

const TIMEOUT_MS = 10000;

export interface Geolocation {
  status: GeolocationStatus;
  /** Resolves with the position, or null if it could not be obtained. */
  request: () => Promise<LatLng | null>;
}

export function useGeolocation(): Geolocation {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  // A second tap while one lookup is in flight joins it instead of starting
  // another (and re-prompting).
  const pending = useRef<Promise<LatLng | null> | null>(null);

  const request = (): Promise<LatLng | null> => {
    if (pending.current) {
      return pending.current;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');

      return Promise.resolve(null);
    }

    setStatus('locating');

    const lookup = new Promise<LatLng | null>(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => {
          setStatus('ready');
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        error => {
          setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
          resolve(null);
        },
        { timeout: TIMEOUT_MS, maximumAge: 60000 }
      );
    }).finally(() => {
      pending.current = null;
    });

    pending.current = lookup;

    return lookup;
  };

  return { status, request };
}
