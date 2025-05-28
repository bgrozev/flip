import {
    Explore as ExploreIcon,
    ModeStandby as ModeStandbyIcon,
    Public as PublicIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import {
    CircularProgress,
    Divider,
    IconButton,
    Stack,
    Tooltip
} from '@mui/material';
import React from 'react';

export default function ToolbarActions({
    onMapButtonClick,
    onRefreshWindsClick,
    onSelectTargetClick,
    onSelectTargetAndHeadingClick,
    fetching
}) {
    return <Stack direction="row" spacing={1} alignItems="center">
        <MapButton onClick={onMapButtonClick} />
        <Divider orientation="vertical" flexItem />
        <SelectTargetAndHeadingButton onClick={onSelectTargetAndHeadingClick} />
        <SelectTargetButton onClick={onSelectTargetClick} />
        <RefreshWindsButton onClick={onRefreshWindsClick} fetching={fetching} />
        <Divider orientation="vertical" flexItem />
    </Stack>;
}

function MapButton({ onClick }) {
    return <Tooltip title="Show map only">
        <IconButton type="button" aria-label="refresh-wind" onClick={onClick}>
            <PublicIcon/>
        </IconButton>
    </Tooltip>;
}

function SelectTargetButton({ onClick }) {
    return <Tooltip title="Select target">
        <IconButton type="button" aria-label="refresh-wind" onClick={onClick}>
            <ModeStandbyIcon/>
        </IconButton>
    </Tooltip>;
}

function SelectTargetAndHeadingButton({ onClick }) {
    return <Tooltip title="Select target and direction">
        <IconButton type="button" aria-label="refresh-wind" onClick={onClick}>
            <ExploreIcon/>
        </IconButton>
    </Tooltip>;
}

function RefreshWindsButton({ onClick, fetching }) {
    const child = fetching
        ? <CircularProgress size={24} />
        : <IconButton type="button" aria-label="refresh-wind" onClick={onClick}>
            <RefreshIcon />
        </IconButton>;

    return <Tooltip title="Refresh wind">{child}</Tooltip>;
}
