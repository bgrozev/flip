import { Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import React from 'react';

export default function DirectionSwitch({ title, value, onChange }) {
    return (
        <Tooltip title={title}>
            <Stack direction="row" spacing={2} alignItems="center">
                <ToggleButtonGroup
                    value={value ? 'right' : 'left'}
                    exclusive
                    onChange={(e, newVal) => {
                        if (newVal !== null) {
                            onChange(newVal === 'right');
                        }
                    }}
                    size="small"
                    color="primary"
                >
                    <ToggleButton value="left">Left</ToggleButton>
                    <ToggleButton value="right">Right</ToggleButton>
                </ToggleButtonGroup>
            </Stack>
        </Tooltip>
    );
}
