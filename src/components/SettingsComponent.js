import {
    Box,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Tooltip,
    Typography
} from '@mui/material';
import { ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React from 'react';

import {
    SOURCE_OPEN_METEO,
    SOURCE_WINDS_ALOFT,
    forecastSourceLabel
} from '../forecast/forecast.js';
import { CODEC_JSON } from '../util/util.js';

import NumberInput from './NumberInput.js';

const DEFAULT_SETTINGS = {
    showPreWind: true,
    showPoms: true,
    showPomAltitudes: true,
    useDzGroundWind: true,
    interpolateWind: true,
    forecastSource: SOURCE_OPEN_METEO,
    displayWindArrow: false,
    displayWindSummary: true,
    correctPatternHeading: true,
    limitWind: 3000
};

export function useSettings() {
    const [ stored, setStored ] = useLocalStorageState('flip.settings', DEFAULT_SETTINGS, { codec: CODEC_JSON });

    const mergedSettings = { ...DEFAULT_SETTINGS, ...stored };

    const setSettings = newSettings => {
        setStored({ ...DEFAULT_SETTINGS, ...newSettings });
    };

    return [ mergedSettings, setSettings ];
}

const checkboxOptions = [
    {
        key: 'showPreWind',
        label: 'Display pre-wind adjusted pattern',
        tooltip: 'Plot the pattern before it is adjusted for wind. You will see two lines plotted.'
    },

    //    {
    //        key: 'showPoms',
    //        label: 'Display manoeuvre points',
    //        tooltip: 'Show maneuver points as small circles on the map.'
    //    },
    {
        key: 'showPomAltitudes',
        label: 'Show pattern point altitudes',
        tooltip: 'Display the altitude of pattern points on the map.'
    },
    {
        key: 'useDzGroundWind',
        label: 'Use observed ground wind when available',
        tooltip: 'Use real-time ground wind observations. Only available for certain locations.'
    },
    {
        key: 'interpolateWind',
        label: 'Interpolate winds between specified altitudes',
        tooltip: 'Smooth out wind changes across altitudes by interpolating.'
    },
    {
        key: 'displayWindArrow',
        label: 'Show average wind on the map',
        tooltip: 'Shows an arrow with the average wind on top of the map.'
    },
    {
        key: 'displayWindSummary',
        label: 'Show wind summary in the title bar',
        tooltip: 'Shows the average and ground wind in the top bar of the app.'
    },
    {
        key: 'correctPatternHeading',
        label: 'Correct pattern heading for a 90/270/450/etc turn',
        tooltip: 'Correct the direction of the pattern in case the loaded turn is not exactly 90/270/450.'
    }
];

export default function SettingsComponent({ settings, setSettings }) {
    const handleCheckboxChange = key => {
        const newSettings = { ...settings, [key]: !settings[key] };

        setSettings(newSettings);
    };
    const handleNumberChange = key => value => {
        const newSettings = { ...settings, [key]: Number(value) };

        setSettings(newSettings);
    };

    const handleSelectChange = event => {
        const newSettings = { ...settings, forecastSource: event.target.value };

        setSettings(newSettings);
    };

    return (
        <Stack direction="column" spacing={1} alignItems="flex-start">
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 0.5,
                width: '100%',
                boxSizing: 'border-box'
            }} >
                Light/Dark theme
                <ThemeSwitcher />
            </Box>
            {checkboxOptions.map(({ key, label, tooltip }) => (
                <Box
                    key={key}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 0.5,
                        width: '100%',
                        boxSizing: 'border-box'
                    }}
                >
                    <Tooltip title={tooltip} placement="right">
                        <Typography sx={{ flexGrow: 1 }}>{label}</Typography>
                    </Tooltip>
                    <Switch
                        checked={settings[key]}
                        onChange={() => handleCheckboxChange(key)}
                    />
                </Box>
            ))}

            <Divider/>
            <NumberInput
                title="Show upper winds in the table up to this altitude. "
                label="Wind altitude limit"
                initialValue={settings.limitWind}
                step={1000}
                min={1000}
                unit="ft"
                onChange={handleNumberChange('limitWind')}
            />

            <Divider/>
            <FormControl fullWidth sx={{ boxSizing: 'border-box' }}>
                <InputLabel id="forecast-source-label">Forecast source</InputLabel>
                <Select
                    labelId="forecast-source-label"
                    value={settings.forecastSource}
                    label="Forecast source"
                    onChange={handleSelectChange}
                >
                    <MenuItem value={SOURCE_OPEN_METEO}>
                        {forecastSourceLabel(SOURCE_OPEN_METEO)}
                    </MenuItem>
                    <MenuItem value={SOURCE_WINDS_ALOFT}>
                        {forecastSourceLabel(SOURCE_WINDS_ALOFT)}
                    </MenuItem>
                </Select>
            </FormControl>
        </Stack>
    );
}
