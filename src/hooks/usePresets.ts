import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback, useMemo } from 'react';

import { SCHEMA_VERSION, migratePresets } from '../core/model';
import { ManoeuvreConfig, PatternParams, Preset, Target } from '../types';
import { createVersionedCodec } from '../util/storage';

const STORAGE_KEYS = {
  presets: 'flip.presets',
  activePreset: 'flip.presets.active'
} as const;

interface UsePresetsParams {
  target: Target;
  patternParams: PatternParams;
  manoeuvreConfig: ManoeuvreConfig;
  selectedCourseId: string | null;
  /** The place the user is at, snapshotted with the preset (see `Preset`). */
  activePlaceId: string | null;
  /**
   * Applies a loaded preset's target. A preset names a place, so this is the
   * place-level setter (every mode), not the per-mode one — see App. The
   * place id goes with it so that the preset's course is still one the
   * Courses panel lists.
   */
  applyTarget: (target: Target, placeId: string | null) => void;
  setPatternParams: (params: PatternParams) => void;
  setManoeuvreConfig: (config: ManoeuvreConfig) => void;
  setSelectedCourseId: (id: string | null) => void;
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
  selectedCourseId,
  activePlaceId,
  applyTarget,
  setPatternParams,
  setManoeuvreConfig,
  setSelectedCourseId
}: UsePresetsParams): UsePresetsResult {
  const [storedPresets, setStoredPresets] = useLocalStorageState<Preset[]>(
    STORAGE_KEYS.presets,
    [],
    { codec: createVersionedCodec(SCHEMA_VERSION, migratePresets) }
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
        selectedCourseId,
        placeId: activePlaceId,
        createdAt: Date.now()
      };

      setStoredPresets([...presets, newPreset]);
      setActivePresetId(newPreset.id);
    },
    [target, patternParams, manoeuvreConfig, selectedCourseId, activePlaceId, presets, setStoredPresets, setActivePresetId]
  );

  const loadPreset = useCallback(
    (id: string | null) => {
      setActivePresetId(id);

      if (!id) return;

      const preset = presets.find(p => p.id === id);
      if (!preset) return;

      applyTarget(preset.target, preset.placeId ?? null);
      setPatternParams(preset.patternParams);
      setManoeuvreConfig(preset.manoeuvre);
      setSelectedCourseId(preset.selectedCourseId ?? null);
    },
    [presets, setActivePresetId, applyTarget, setPatternParams, setManoeuvreConfig, setSelectedCourseId]
  );

  const updatePreset = useCallback(
    (id: string) => {
      setStoredPresets(
        presets.map(p =>
          p.id === id
            ? { ...p, target, patternParams, manoeuvre: manoeuvreConfig, selectedCourseId, placeId: activePlaceId }
            : p
        )
      );
    },
    [target, patternParams, manoeuvreConfig, selectedCourseId, activePlaceId, presets, setStoredPresets]
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
