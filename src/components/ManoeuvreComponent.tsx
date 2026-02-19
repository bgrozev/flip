import { Box, Divider, ToggleButton, ToggleButtonGroup } from '@mui/material';
import React from 'react';

import { FlightPath, ManoeuvreConfig, ManoeuvreType } from '../types';

import { DEFAULT_MANOEUVRE_PARAMS } from './ManoeuvreParametersComponent';
import ManoeuvreParametersComponent from './ManoeuvreParametersComponent';
import ManoeuvreSamplesComponent from './ManoeuvreSamplesComponent';
import ManoeuvreTrackComponent from './ManoeuvreTrackComponent';

interface ManoeuvreComponentProps {
  manoeuvreConfig: ManoeuvreConfig;
  onConfigChange: (config: ManoeuvreConfig) => void;
  manoeuvreToSave: FlightPath;
}

export default function ManoeuvreComponent({
  manoeuvreConfig,
  onConfigChange,
  manoeuvreToSave
}: ManoeuvreComponentProps) {
  const handleTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: ManoeuvreType | null
  ) => {
    if (newType === null) return;

    // Preserve existing sub-config when switching type; initialize defaults if first time
    let newConfig: ManoeuvreConfig = { ...manoeuvreConfig, type: newType };

    if (newType === 'parameters' && !newConfig.params) {
      newConfig = { ...newConfig, params: DEFAULT_MANOEUVRE_PARAMS };
    }
    if (newType === 'samples' && typeof newConfig.sampleIndex !== 'number') {
      newConfig = { ...newConfig, sampleIndex: 0, sampleLeft: true };
    }

    onConfigChange(newConfig);
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <ToggleButtonGroup
        value={manoeuvreConfig.type}
        exclusive
        onChange={handleTypeChange}
        fullWidth
        color="primary"
      >
        <ToggleButton value="none">None</ToggleButton>
        <ToggleButton value="parameters">Parameters</ToggleButton>
        <ToggleButton value="track">Track</ToggleButton>
        <ToggleButton value="samples">Samples</ToggleButton>
      </ToggleButtonGroup>

      {manoeuvreConfig.type !== 'none' && <Divider />}

      {manoeuvreConfig.type === 'parameters' && (
        <ManoeuvreParametersComponent
          params={manoeuvreConfig.params ?? DEFAULT_MANOEUVRE_PARAMS}
          onParamsChange={params => onConfigChange({ ...manoeuvreConfig, params })}
        />
      )}

      {manoeuvreConfig.type === 'track' && (
        <ManoeuvreTrackComponent
          manoeuvreToSave={manoeuvreToSave}
          selectedTrackName={manoeuvreConfig.trackName}
          selectedTrackData={manoeuvreConfig.trackData}
          onTrackChange={(trackName, trackData) =>
            onConfigChange({
              ...manoeuvreConfig,
              trackName: trackName ?? undefined,
              trackData
            })
          }
        />
      )}

      {manoeuvreConfig.type === 'samples' && (
        <ManoeuvreSamplesComponent
          sampleIndex={manoeuvreConfig.sampleIndex ?? 0}
          sampleLeft={manoeuvreConfig.sampleLeft ?? true}
          onChange={(index, left) =>
            onConfigChange({ ...manoeuvreConfig, sampleIndex: index, sampleLeft: left })
          }
        />
      )}
    </Box>
  );
}
