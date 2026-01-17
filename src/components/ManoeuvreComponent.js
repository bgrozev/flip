import {
    Block as BlockIcon,
    Build as BuildIcon,
    Folder as FolderIcon,
    Menu as MenuIcon
} from '@mui/icons-material';
import {
    Box,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { useEffect } from 'react';

import { toTurfPoints } from '../util/geo.js';
import { CODEC_JSON } from '../util/util.js';

import ManoeuvreParametersComponent, { defaultPath } from './ManoeuvreParametersComponent.js';
import ManoeuvreSamplesComponent from './ManoeuvreSamplesComponent.js';
import ManoeuvreTrackComponent from './ManoeuvreTrackComponent.js';


const PARAMETERS = 'parameters';
const SAMPLES = 'samples';
const TRACK = 'track';
const NONE = 'none';

export default function ManoeuvreComponent({ setManoeuvre, manoeuvreToSave }) {
    const [ type, setType ] = useLocalStorageState('flip.manoeuvre.type', NONE);
    const [ parametersPath, setParametersPath ] = useLocalStorageState(
        'flip.manoeuvre.parameters_path_turf',
        defaultPath(),
        { codec: CODEC_JSON }
    );
    const [ trackPath, setTrackPath ] = useLocalStorageState(
        'flip.manoeuvre.track_path_turf',
        [],
        { codec: CODEC_JSON }
    );
    const [ samplePath, setSamplePath ] = useLocalStorageState(
        'flip.manoeuvre.sample_path_turf',
        [],
        { codec: CODEC_JSON }
    );

    const handleTypeChange = (event, newType) => {
        if (newType !== null) {
            setType(newType);
        }
    };

    useEffect(() => {
        if (type === NONE) {
            setManoeuvre([]);
        } else if (type === PARAMETERS) {
            setManoeuvre(parametersPath);
        } else if (type === TRACK) {
            setManoeuvre(trackPath);
        } else if (type === SAMPLES) {
            setManoeuvre(samplePath);
        }

    }, [ type, parametersPath, trackPath, samplePath ]);

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

            <Divider/>

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
                        const t = toTurfPoints(p);

                        setTrackPath(t);
                        setManoeuvre(t);
                    }}
                />
            )}

            {type === SAMPLES && (
                <ManoeuvreSamplesComponent
                    onChange={p => {
                        const t = toTurfPoints(p);

                        setSamplePath(t);
                        setManoeuvre(t);
                    }}
                />
            )}
        </Box>
    );
}
