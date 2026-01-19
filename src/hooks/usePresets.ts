import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback, useMemo } from 'react';

import {
  FlightPath,
  ManoeuvreConfig,
  ManoeuvreParams,
  ManoeuvreType,
  PatternParams,
  Preset,
  Target
} from '../types';
import { makePatternByType } from '../util/pattern';
import { createManoeuvrePath } from '../util/manoeuvre';
import { mirror } from '../util/geo';
import { samples } from '../samples';
import { CODEC_JSON } from '../util/util';

// Storage keys for reading current configuration
const STORAGE_KEYS = {
  presets: 'flip.presets',
  activePreset: 'flip.presets.active',
  patternParams: 'flip.pattern.params',
  manoeuvreType: 'flip.manoeuvre.type',
  manoeuvreParams: 'flip.manoeuvre.params',
  manoeuvreTrackSelected: 'flip.manoeuvre.track.selected',
  manoeuvreTrackTracks: 'flip.manoeuvre.track.tracks',
  manoeuvreSamplesIndex: 'flip.manoeuvre.samples.selectedIndex'
} as const;

interface Track {
  name: string;
  description: string;
  track: FlightPath;
}

interface UsePresetsParams {
  target: Target;
  setTarget: (target: Target) => void;
  setPattern: (pattern: FlightPath) => void;
  setManoeuvre: (manoeuvre: FlightPath) => void;
}

export interface UsePresetsResult {
  presets: Preset[];
  activePresetId: string | null;
  createPreset: (name: string) => void;
  loadPreset: (id: string | null) => void;
  updatePreset: (id: string) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, newName: string) => void;
}

export function usePresets({
  target,
  setTarget,
  setPattern,
  setManoeuvre
}: UsePresetsParams): UsePresetsResult {
  const [storedPresets, setStoredPresets] = useLocalStorageState<Preset[]>(
    STORAGE_KEYS.presets,
    [],
    { codec: CODEC_JSON }
  );
  const presets = storedPresets ?? [];

  const [activePresetId, setActivePresetId] = useLocalStorageState<string | null>(
    STORAGE_KEYS.activePreset,
    null
  );

  // Helper to read current configuration from localStorage
  const readCurrentConfig = useCallback((): {
    patternParams: PatternParams;
    manoeuvre: ManoeuvreConfig;
  } => {
    // Read pattern params
    const patternParamsStr = localStorage.getItem(STORAGE_KEYS.patternParams);
    const patternParams: PatternParams = patternParamsStr
      ? JSON.parse(patternParamsStr)
      : {
          type: 'three-leg',
          descentRateMph: 12,
          glideRatio: 2.6,
          legs: [
            { altitude: 300, direction: 0 },
            { altitude: 300, direction: 270 },
            { altitude: 300, direction: 270 }
          ]
        };

    // Read manoeuvre type (stored as plain string, not JSON)
    const manoeuvreTypeStr = localStorage.getItem(STORAGE_KEYS.manoeuvreType);
    const manoeuvreType: ManoeuvreType = (manoeuvreTypeStr as ManoeuvreType) || 'none';

    const manoeuvre: ManoeuvreConfig = { type: manoeuvreType };

    if (manoeuvreType === 'parameters') {
      const paramsStr = localStorage.getItem(STORAGE_KEYS.manoeuvreParams);
      if (paramsStr) {
        manoeuvre.params = JSON.parse(paramsStr) as ManoeuvreParams;
      }
    } else if (manoeuvreType === 'track') {
      // track.selected is stored as plain string, tracks is JSON
      const trackName = localStorage.getItem(STORAGE_KEYS.manoeuvreTrackSelected);
      const tracksStr = localStorage.getItem(STORAGE_KEYS.manoeuvreTrackTracks);

      if (trackName && tracksStr) {
        const tracks = JSON.parse(tracksStr) as Track[];
        const track = tracks.find(t => t.name === trackName);

        if (track) {
          manoeuvre.trackName = trackName;
          manoeuvre.trackData = track.track;
        }
      }
    } else if (manoeuvreType === 'samples') {
      // selectedIndex is stored as plain number string
      const indexStr = localStorage.getItem(STORAGE_KEYS.manoeuvreSamplesIndex);
      if (indexStr) {
        manoeuvre.sampleIndex = parseInt(indexStr, 10);
      }
      // Note: left/right state is local to component, defaults to left
      manoeuvre.sampleLeft = true;
    }

    return { patternParams, manoeuvre };
  }, []);

  // Helper to apply manoeuvre config and return the flight path
  const applyManoeuvreConfig = useCallback((config: ManoeuvreConfig): FlightPath => {
    // Write type to localStorage (plain string, not JSON)
    localStorage.setItem(STORAGE_KEYS.manoeuvreType, config.type);

    if (config.type === 'none') {
      return [];
    }

    if (config.type === 'parameters' && config.params) {
      localStorage.setItem(STORAGE_KEYS.manoeuvreParams, JSON.stringify(config.params));
      return createManoeuvrePath(config.params);
    }

    if (config.type === 'track' && config.trackData) {
      // Write track to localStorage (selected is plain string, tracks is JSON)
      if (config.trackName) {
        localStorage.setItem(STORAGE_KEYS.manoeuvreTrackSelected, config.trackName);

        // Also ensure the track exists in tracks list
        const tracksStr = localStorage.getItem(STORAGE_KEYS.manoeuvreTrackTracks);
        let tracks: Track[] = tracksStr ? JSON.parse(tracksStr) : [];

        // Add or update the track
        const existingIndex = tracks.findIndex(t => t.name === config.trackName);
        const trackEntry: Track = {
          name: config.trackName,
          description: 'Restored from preset',
          track: config.trackData
        };

        if (existingIndex >= 0) {
          tracks[existingIndex] = trackEntry;
        } else {
          tracks.push(trackEntry);
        }

        localStorage.setItem(STORAGE_KEYS.manoeuvreTrackTracks, JSON.stringify(tracks));
      }
      return config.trackData;
    }

    if (config.type === 'samples' && typeof config.sampleIndex === 'number') {
      // selectedIndex is stored as plain number string
      localStorage.setItem(STORAGE_KEYS.manoeuvreSamplesIndex, String(config.sampleIndex));

      let path = samples[config.sampleIndex]?.getPath() ?? [];
      if (config.sampleLeft === false) {
        path = mirror(path);
      }
      return path;
    }

    return [];
  }, []);

  const createPreset = useCallback(
    (name: string) => {
      const { patternParams, manoeuvre } = readCurrentConfig();

      const newPreset: Preset = {
        id: `preset_${Date.now()}`,
        name,
        target,
        patternParams,
        manoeuvre,
        createdAt: Date.now()
      };

      setStoredPresets([...presets, newPreset]);
      setActivePresetId(newPreset.id);
    },
    [target, readCurrentConfig, presets, setStoredPresets, setActivePresetId]
  );

  const loadPreset = useCallback(
    (id: string | null) => {
      setActivePresetId(id);

      if (!id) {
        return;
      }

      const preset = presets.find(p => p.id === id);
      if (!preset) {
        return;
      }

      // Apply target
      setTarget(preset.target);

      // Apply pattern params
      localStorage.setItem(STORAGE_KEYS.patternParams, JSON.stringify(preset.patternParams));
      setPattern(makePatternByType(preset.patternParams));

      // Apply manoeuvre
      const manoeuvrePath = applyManoeuvreConfig(preset.manoeuvre);
      setManoeuvre(manoeuvrePath);
    },
    [presets, setActivePresetId, setTarget, setPattern, setManoeuvre, applyManoeuvreConfig]
  );

  const updatePreset = useCallback(
    (id: string) => {
      const { patternParams, manoeuvre } = readCurrentConfig();

      setStoredPresets(
        presets.map(p =>
          p.id === id
            ? {
                ...p,
                target,
                patternParams,
                manoeuvre
              }
            : p
        )
      );
    },
    [target, readCurrentConfig, presets, setStoredPresets]
  );

  const deletePreset = useCallback(
    (id: string) => {
      setStoredPresets(presets.filter(p => p.id !== id));
      if (activePresetId === id) {
        setActivePresetId(null);
      }
    },
    [presets, activePresetId, setStoredPresets, setActivePresetId]
  );

  const renamePreset = useCallback(
    (id: string, newName: string) => {
      setStoredPresets(
        presets.map(p => (p.id === id ? { ...p, name: newName } : p))
      );
    },
    [presets, setStoredPresets]
  );

  return useMemo(
    () => ({
      presets,
      activePresetId: activePresetId ?? null,
      createPreset,
      loadPreset,
      updatePreset,
      deletePreset,
      renamePreset
    }),
    [presets, activePresetId, createPreset, loadPreset, updatePreset, deletePreset, renamePreset]
  );
}
