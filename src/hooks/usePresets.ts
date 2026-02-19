import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback, useMemo } from 'react';

import { ManoeuvreConfig, PatternParams, Preset, Target } from '../types';
import { createSimpleCodec } from '../util/storage';

const STORAGE_KEYS = {
  presets: 'flip.presets',
  activePreset: 'flip.presets.active'
} as const;

interface UsePresetsParams {
  target: Target;
  patternParams: PatternParams;
  manoeuvreConfig: ManoeuvreConfig;
  setTarget: (target: Target) => void;
  setPatternParams: (params: PatternParams) => void;
  setManoeuvreConfig: (config: ManoeuvreConfig) => void;
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
  patternParams,
  manoeuvreConfig,
  setTarget,
  setPatternParams,
  setManoeuvreConfig
}: UsePresetsParams): UsePresetsResult {
  const [storedPresets, setStoredPresets] = useLocalStorageState<Preset[]>(
    STORAGE_KEYS.presets,
    [],
    { codec: createSimpleCodec<Preset[]>([]) }
  );
  const presets = storedPresets ?? [];

  const [activePresetId, setActivePresetId] = useLocalStorageState<string | null>(
    STORAGE_KEYS.activePreset,
    null
  );

  const createPreset = useCallback(
    (name: string) => {
      const newPreset: Preset = {
        id: `preset_${Date.now()}`,
        name,
        target,
        patternParams,
        manoeuvre: manoeuvreConfig,
        createdAt: Date.now()
      };

      setStoredPresets([...presets, newPreset]);
      setActivePresetId(newPreset.id);
    },
    [target, patternParams, manoeuvreConfig, presets, setStoredPresets, setActivePresetId]
  );

  const loadPreset = useCallback(
    (id: string | null) => {
      setActivePresetId(id);

      if (!id) return;

      const preset = presets.find(p => p.id === id);
      if (!preset) return;

      setTarget(preset.target);
      setPatternParams(preset.patternParams);
      setManoeuvreConfig(preset.manoeuvre);
    },
    [presets, setActivePresetId, setTarget, setPatternParams, setManoeuvreConfig]
  );

  const updatePreset = useCallback(
    (id: string) => {
      setStoredPresets(
        presets.map(p =>
          p.id === id ? { ...p, target, patternParams, manoeuvre: manoeuvreConfig } : p
        )
      );
    },
    [target, patternParams, manoeuvreConfig, presets, setStoredPresets]
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
      setStoredPresets(presets.map(p => (p.id === id ? { ...p, name: newName } : p)));
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
