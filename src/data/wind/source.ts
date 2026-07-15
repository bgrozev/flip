import { LatLng, ObservedWindStation } from '../../types';
import { WindProfile } from '../../core/wind';

/**
 * The wind data layer is a set of source plugins implementing WindSource.
 *
 * - 'model-forecast' — numerical weather model output (OpenMeteo)
 * - 'sounding'       — real radiosonde soundings
 * - 'observed-station' — live surface observations (NWS, CSC, Spaceland)
 *
 * Aloft sources (model-forecast, sounding) resolve to a WindProfile;
 * observed-station sources resolve to a list of stations near the location.
 */
export type WindSourceKind = 'model-forecast' | 'sounding' | 'observed-station';

/** A selectable forecast model offered by a model-forecast source. */
export interface WindModelOption {
  id: string;
  label: string;
}

export interface WindSourceCapabilities {
  /**
   * How many forecast hours a single fetch can cover (enables local hour
   * switching without a refetch).
   */
  hours?: number;
  /** Selectable forecast models, if the source offers a choice. */
  models?: readonly WindModelOption[];
  /**
   * True when the source discovers stations/sites from the location itself
   * (as opposed to a fixed, site-specific feed).
   */
  discovery?: boolean;
}

export interface WindFetchOpts {
  /** Forecast hour offset from now (model-forecast sources). */
  hourOffset?: number;
  /** Forecast model id (must be one of capabilities.models). */
  model?: string;
  /** Bypass any prefetch cache and hit the network. */
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

interface WindSourceBase {
  id: string;
  label: string;
  kind: WindSourceKind;
  capabilities: WindSourceCapabilities;
}

/** A source of winds-aloft profiles (model forecast or sounding). */
export interface AloftWindSource extends WindSourceBase {
  kind: 'model-forecast' | 'sounding';
  fetch(location: LatLng, opts?: WindFetchOpts): Promise<WindProfile>;
}

/** A source of surface observations near a location. */
export interface ObservedStationSource extends WindSourceBase {
  kind: 'observed-station';
  /** Resolves to the stations in range of `location` (possibly empty). */
  fetch(location: LatLng, opts?: WindFetchOpts): Promise<ObservedWindStation[]>;
}

export type WindSource = AloftWindSource | ObservedStationSource;
