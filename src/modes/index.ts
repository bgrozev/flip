/**
 * Modes: declarative per-audience UI profiles over the one engine.
 *
 * A mode is data — which panels exist, which map layers render, which
 * coarse features are on, and which setting defaults apply. Switching
 * modes never touches stored user config; it only changes exposure.
 */
import { DEFAULT_SETTINGS } from '../core/model';
import { MapLayerId, PanelId, Settings } from '../types';

export type ModeId = 'pattern' | 'swoop' | 'flocking' | 'explore';

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
}

const ALL_PANELS: readonly PanelId[] = [
  'pattern', 'manoeuvre', 'target', 'wind', 'courses', 'settings', 'about'
];
const ALL_LAYERS: readonly MapLayerId[] = [
  'flightPaths', 'courses', 'measure', 'stations', 'targetEdit', 'courseEdit', 'windArrow'
];

export const MODES: readonly Mode[] = [
  {
    id: 'pattern',
    label: 'Pattern',
    description: 'Landing patterns for skydivers and students',
    enabled: true,
    nav: ['pattern', 'target', 'wind', 'settings', 'about'],
    mapLayers: ['flightPaths', 'measure', 'stations', 'targetEdit', 'windArrow'],
    // Student-friendly: show the wind arrow on the map by default
    defaults: { displayWindArrow: true },
    features: ['presets', 'export']
  },
  {
    id: 'swoop',
    label: 'Swoop',
    description: 'Patterns plus manoeuvres and canopy-piloting courses',
    enabled: true,
    nav: ALL_PANELS,
    mapLayers: ALL_LAYERS,
    defaults: {},
    features: ['manoeuvre', 'courses', 'presets', 'export']
  },
  // Stubs: defined to prove the shape; not yet selectable.
  {
    id: 'flocking',
    label: 'Flocking',
    description: 'Wind drift and jump run for flocks (coming soon)',
    enabled: false,
    nav: ['target', 'wind', 'settings', 'about'],
    mapLayers: ['stations', 'targetEdit', 'windArrow'],
    defaults: {},
    features: ['export']
  },
  {
    id: 'explore',
    label: 'Explore',
    description: 'Everything unlocked, no guardrails (coming soon)',
    enabled: false,
    nav: ALL_PANELS,
    mapLayers: ALL_LAYERS,
    defaults: {},
    features: ['manoeuvre', 'courses', 'presets', 'export']
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
 * Resolves effective settings for a mode: each mode default applies only
 * when the user's stored value still equals the global default, so user
 * customizations survive mode switches untouched.
 *
 * Known limitation (accepted for now): while a mode overrides a setting,
 * storing the global-default value for it re-applies the mode default —
 * e.g. in pattern mode the wind arrow cannot be turned back off via
 * Settings, because "off" is the global default. Kept deliberately
 * simple; revisit if mode defaults grow.
 */
export function applyModeDefaults(settings: Settings, mode: Mode): Settings {
  const resolved: Settings = { ...settings };

  for (const key of Object.keys(mode.defaults) as (keyof Settings)[]) {
    const stored = settings[key];
    const globalDefault = DEFAULT_SETTINGS[key];

    if (JSON.stringify(stored) === JSON.stringify(globalDefault)) {
      (resolved as Record<keyof Settings, unknown>)[key] = mode.defaults[key];
    }
  }

  return resolved;
}
