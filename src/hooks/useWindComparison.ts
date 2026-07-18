import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchOpenMeteoComparison } from '../data/wind/openmeteo';
import { fetchSoundingProfile } from '../data/wind/soundings';
import { LatLng } from '../types';
import { OPEN_METEO_MODELS, WindProfile } from '../core/wind';

/** One comparison source: a model or the nearest sounding. */
export interface ComparisonSourceResult {
  id: string;
  /** Short column label (model name or sounding station id). */
  label: string;
  /** The fetched profile, or null when this source failed. */
  profile: WindProfile | null;
  /** Failure reason when profile is null. */
  error?: string;
}

interface UseWindComparisonResult {
  loading: boolean;
  /** Null until the first load; then one entry per attempted source. */
  results: ComparisonSourceResult[] | null;
  /** Fetch all sources concurrently for the location. */
  load: (target: LatLng) => void;
  /** Abort and drop the results (closing the compare view). */
  clear: () => void;
}

/* eslint-disable camelcase -- keys are OpenMeteo model ids */
/** Short column labels for the comparison table. */
const MODEL_SHORT_LABELS: Record<string, string> = {
  best_match: 'Best',
  gfs_seamless: 'GFS',
  icon_seamless: 'ICON',
  ecmwf_ifs025: 'ECMWF'
};
/* eslint-enable camelcase */

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Side-by-side wind sources for the comparison view: all selectable
 * OpenMeteo models plus the nearest sounding, fetched concurrently.
 * Per-source failures (e.g. no radiosonde station nearby) surface as an
 * error on that source instead of failing the whole comparison. Model
 * fetches use the cache-read-only comparison path, so a sweep never
 * disturbs the single-model prefetch window behind the time scrubber.
 */
export function useWindComparison(): UseWindComparisonResult {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComparisonSourceResult[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const load = useCallback((target: LatLng) => {
    abortRef.current?.abort();
    const controller = new AbortController();

    abortRef.current = controller;
    setLoading(true);

    const modelTasks = OPEN_METEO_MODELS.map(model =>
      fetchOpenMeteoComparison(target, model.id, controller.signal)
        .then(profile => ({
          id: model.id,
          label: MODEL_SHORT_LABELS[model.id] ?? model.label,
          profile
        }))
        .catch(err => ({
          id: model.id,
          label: MODEL_SHORT_LABELS[model.id] ?? model.label,
          profile: null,
          error: errorMessage(err)
        }))
    );

    const soundingTask = fetchSoundingProfile(target, { signal: controller.signal })
      .then(profile => ({
        id: 'sounding',
        label: profile.meta?.station ?? 'Sounding',
        profile
      }))
      .catch(err => ({
        id: 'sounding',
        label: 'Sounding',
        profile: null,
        error: errorMessage(err)
      }));

    Promise.all([...modelTasks, soundingTask]).then(settled => {
      if (!controller.signal.aborted) {
        setResults(settled);
        setLoading(false);
      }
    });
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setResults(null);
    setLoading(false);
  }, []);

  return { loading, results, load, clear };
}
