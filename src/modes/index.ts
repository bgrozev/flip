/**
 * Modes: declarative per-audience UI profiles over the one engine.
 *
 * A mode is data — which panels exist, which map layers render, which
 * coarse features are on, and which setting defaults apply. Switching
 * modes never touches stored user config; it only changes exposure.
 */
import { MapLayerId, PanelId, Settings } from '../types';

export type ModeId = 'pattern' | 'swoop' | 'flocking';

/** Coarse feature switches for gates that are neither nav nor a map layer. */
export const FEATURE_IDS = ['manoeuvre', 'courses', 'presets', 'export'] as const;
export type FeatureId = typeof FEATURE_IDS[number];

export interface Mode {
  id: ModeId;
  label: string;
  /** One-liner shown on the first-run picker cards. */
  description: string;
  /** Stub modes are defined to prove the shape but not yet selectable. */
  enabled: boolean;
  /** Panels exposed in navigation (sidebar and mobile bottom nav). */
  nav: readonly PanelId[];
  /** Map layers that render in this mode. */
  mapLayers: readonly MapLayerId[];
  /**
   * Setting defaults for this mode. Applied only where the user's stored
   * value still equals the global default — see applyModeDefaults().
   */
  defaults: Partial<Settings>;
  features: readonly FeatureId[];
  /**
   * Initial map zoom for this mode; omitted = the map's own default.
   * Applied on load and on mode switch (flocking spans miles, patterns
   * span hundreds of feet).
   */
  defaultZoom?: number;
}

const ALL_PANELS: readonly PanelId[] = [
  'pattern', 'manoeuvre', 'target', 'wind', 'courses', 'settings', 'about'
];
const ALL_LAYERS: readonly MapLayerId[] = [
  'flightPaths', 'courses', 'stations', 'targetEdit', 'courseEdit'
];

export const MODES: readonly Mode[] = [
  {
    id: 'pattern',
    label: 'Standard Pattern',
    description: 'Standard downwind-base-final pattern',
    enabled: true,
    nav: ['pattern', 'target', 'wind', 'settings', 'about'],
    mapLayers: ['flightPaths', 'stations', 'targetEdit'],
    defaults: {},
    features: ['presets', 'export']
  },
  {
    id: 'swoop',
    label: 'High Performance Landing',
    description: 'Include a landing manoeuvre and CP courses',
    enabled: true,
    nav: ALL_PANELS,
    mapLayers: ALL_LAYERS,
    defaults: {},
    features: ['manoeuvre', 'courses', 'presets', 'export']
  },
  {
    id: 'flocking',
    label: 'Flocking',
    description: 'Wind drift and spot planning for flocking.',
    enabled: true,
    nav: ['flocking', 'target', 'wind', 'settings', 'about'],
    mapLayers: ['flocking', 'stations', 'targetEdit'],
    defaults: {},
    features: ['export'],
    // The flocking picture (descent + 3 nm jumprun) spans several miles
    defaultZoom: 12
  }
];

export const ENABLED_MODES: readonly Mode[] = MODES.filter(m => m.enabled);

/**
 * Fallback for stored data referencing an unknown/disabled mode, and for
 * pre-mode users: swoop is today's full UI, so nothing disappears.
 */
export const FALLBACK_MODE_ID: ModeId = 'swoop';

export function getMode(id: ModeId): Mode {
  return MODES.find(m => m.id === id) ?? getMode(FALLBACK_MODE_ID);
}

export function hasFeature(mode: Mode, feature: FeatureId): boolean {
  return mode.features.includes(feature);
}

export function hasLayer(mode: Mode, layer: MapLayerId): boolean {
  return mode.mapLayers.includes(layer);
}

/**
 * Validates a stored/URL mode id. Returns null for anything that is not
 * an *enabled* mode id — callers treat null as "no mode chosen yet"
 * (first-run picker).
 */
export function migrateModeId(raw: unknown): ModeId | null {
  if (typeof raw !== 'string') {
    return null;
  }

  return ENABLED_MODES.some(m => m.id === raw) ? raw as ModeId : null;
}

/**
 * Resolves effective settings for a mode from explicit touch tracking:
 * a mode default applies only to settings the user has never changed
 * ("touched" keys always keep the user's stored value). Unlike the old
 * equals-global-default heuristic, this lets the user force a
 * mode-overridden setting back to the global default — setting it at all
 * marks it touched, so the mode stops overriding it.
 */
export function applyModeDefaults(
  settings: Settings,
  mode: Mode,
  touched: readonly (keyof Settings)[]
): Settings {
  const resolved: Settings = { ...settings };

  for (const key of Object.keys(mode.defaults) as (keyof Settings)[]) {
    if (!touched.includes(key)) {
      (resolved as Record<keyof Settings, unknown>)[key] = mode.defaults[key];
    }
  }

  return resolved;
}
