import {
  Block as BlockIcon,
  Build as BuildIcon,
  Folder as FolderIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { Box, Divider, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { useEffect } from 'react';

import { FlightPath } from '../types';
import { CODEC_JSON } from '../util/util';

import ManoeuvreParametersComponent, { defaultPath } from './ManoeuvreParametersComponent';
import ManoeuvreSamplesComponent from './ManoeuvreSamplesComponent';
import ManoeuvreTrackComponent from './ManoeuvreTrackComponent';

const PARAMETERS = 'parameters';
const SAMPLES = 'samples';
const TRACK = 'track';
const NONE = 'none';

type ManoeuvreType = typeof PARAMETERS | typeof SAMPLES | typeof TRACK | typeof NONE;

interface ManoeuvreComponentProps {
  setManoeuvre: (path: FlightPath) => void;
  manoeuvreToSave: FlightPath;
}

export default function ManoeuvreComponent({
  setManoeuvre,
  manoeuvreToSave
}: ManoeuvreComponentProps) {
  const [type, setType] = useLocalStorageState<ManoeuvreType>(
    'flip.manoeuvre.type',
    NONE
  );
  const [parametersPath, setParametersPath] = useLocalStorageState<FlightPath>(
    'flip.manoeuvre.parameters_path_turf',
    defaultPath(),
    { codec: CODEC_JSON }
  );
  const [trackPath, setTrackPath] = useLocalStorageState<FlightPath>(
    'flip.manoeuvre.track_path_turf',
    [],
    { codec: CODEC_JSON }
  );
  const [samplePath, setSamplePath] = useLocalStorageState<FlightPath>(
    'flip.manoeuvre.sample_path_turf',
    [],
    { codec: CODEC_JSON }
  );

  const handleTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: ManoeuvreType | null
  ) => {
    if (newType !== null) {
      setType(newType);
    }
  };

  useEffect(() => {
    if (type === NONE) {
      setManoeuvre([]);
    } else if (type === PARAMETERS) {
      setManoeuvre(parametersPath ?? []);
    } else if (type === TRACK) {
      setManoeuvre(trackPath ?? []);
    } else if (type === SAMPLES) {
      setManoeuvre(samplePath ?? []);
    }
  }, [type, parametersPath, trackPath, samplePath, setManoeuvre]);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <ToggleButtonGroup
        value={type}
        exclusive
        onChange={handleTypeChange}
        fullWidth
        color="primary"
      >
        <Tooltip title="No manoeuvre">
          <ToggleButton value={NONE} aria-label="None">
            <BlockIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Enter parameters">
          <ToggleButton value={PARAMETERS} aria-label="Parameters">
            <BuildIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="My tracks">
          <ToggleButton value={TRACK} aria-label="Files">
            <FolderIcon />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Samples">
          <ToggleButton value={SAMPLES} aria-label="Samples">
            <MenuIcon />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider />

      {type === PARAMETERS && (
        <ManoeuvreParametersComponent
          onChange={p => {
            setParametersPath(p);
            setManoeuvre(p);
          }}
        />
      )}

      {type === TRACK && (
        <ManoeuvreTrackComponent
          manoeuvreToSave={manoeuvreToSave}
          onChange={p => {
            setTrackPath(p);
            setManoeuvre(p);
          }}
        />
      )}

      {type === SAMPLES && (
        <ManoeuvreSamplesComponent
          onChange={p => {
            setSamplePath(p);
            setManoeuvre(p);
          }}
        />
      )}
    </Box>
  );
}
