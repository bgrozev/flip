import {
  Block as BlockIcon,
  Build as BuildIcon,
  Folder as FolderIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { Box, Divider, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
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
        <Tooltip title="No manoeuvre">
          <ToggleButton value="none" aria-label="None">
            <BlockIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Enter parameters">
          <ToggleButton value="parameters" aria-label="Parameters">
            <BuildIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="My tracks">
          <ToggleButton value="track" aria-label="Files">
            <FolderIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Samples">
          <ToggleButton value="samples" aria-label="Samples">
            <MenuIcon />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider />

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
