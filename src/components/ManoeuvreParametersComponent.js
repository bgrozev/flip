import { Stack } from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React from 'react';

import { createManoeuvrePath } from '../util/manoeuvre.js';
import { CODEC_JSON } from '../util/util.js';

import DirectionSwitch from './DirectionSwitch.js';
import NumberInput from './NumberInput.js';

const DEFAULT_PARAMS = {
    offsetXFt: 300,
    offsetYFt: 150,
    altitudeFt: 900,
    duration: 8,
    left: true
};
const DEFAULT_PATH = createManoeuvrePath(DEFAULT_PARAMS);

function defaultParams() {
    return { ...DEFAULT_PARAMS };
}
export function defaultPath() {
    return { ...DEFAULT_PATH };
}

export default function ManoeuvreParametersComponent(props) {
    const [ params, setParams ] = useLocalStorageState(
        'flip.manoeuvre.params',
        defaultParams(),
        { codec: CODEC_JSON }
    );

    const handleChange = key => value => {
        const newParams = {
            ...params,
            [key]: value
        };

        setParams(newParams);
        props.onChange(createManoeuvrePath(newParams));
    };

    const handleSwitch = () => {
        const newParams = {
            ...params,
            left: !params.left
        };

        setParams(newParams);
        props.onChange(createManoeuvrePath(newParams));
    };

    return (
        <Stack direction='column' spacing={2}>
            <NumberInput
                title='Distance in the depth direction.'
                label='Back'
                initialValue={params.offsetXFt}
                step={50}
                min={50}
                unit='ft'
                onChange={handleChange('offsetXFt')}
            />
            <NumberInput
                title='Distance in the offset direction.'
                label='Offset'
                initialValue={params.offsetYFt}
                step={50}
                min={50}
                unit='ft'
                onChange={handleChange('offsetYFt')}
            />
            <NumberInput
                title='The altitude the manoeuvre starts at.'
                label='Altitude'
                initialValue={params.altitudeFt}
                step='50'
                min={300}
                unit='ft'
                onChange={handleChange('altitudeFt')}
            />
            <NumberInput
                title='The duration from the start of manoeuvre to flying level.'
                label='Duration'
                initialValue={params.duration}
                step='0.5'
                min={1}
                unit='s'
                onChange={handleChange('duration')}
            />
            <DirectionSwitch
                title={'The position of the target relative to the start of the turn. For example, for a right hand '
                    + '270 the target is on the LEFT side.'}
                value={!params.left}
                onChange={handleSwitch}
            />
        </Stack>
    );
}
