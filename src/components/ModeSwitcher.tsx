import {
  Check as CheckIcon,
  Groups as GroupsIcon,
  Route as RouteIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import React, { useState } from 'react';

import { MODES, ModeId } from '../modes';

const MODE_ICONS: Record<ModeId, React.ReactNode> = {
  pattern: <RouteIcon />,
  swoop: <SpeedIcon />,
  flocking: <GroupsIcon />
};

interface ModeSwitcherProps {
  modeId: ModeId;
  onChange: (id: ModeId) => void;
}

/** Compact toolbar menu for switching the app mode at any time. */
export default function ModeSwitcher({ modeId, onChange }: ModeSwitcherProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const current = MODES.find(m => m.id === modeId);

  return (
    <>
      <Tooltip title={`Mode: ${current?.label ?? modeId}`}>
        <IconButton
          type="button"
          aria-label="switch-mode"
          onClick={e => setAnchorEl(e.currentTarget)}
        >
          {MODE_ICONS[modeId]}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {MODES.map(mode => (
          <MenuItem
            key={mode.id}
            disabled={!mode.enabled}
            selected={mode.id === modeId}
            onClick={() => {
              setAnchorEl(null);
              if (mode.id !== modeId) {
                onChange(mode.id);
              }
            }}
          >
            <ListItemIcon>
              {mode.id === modeId ? <CheckIcon /> : MODE_ICONS[mode.id]}
            </ListItemIcon>
            <ListItemText
              primary={mode.label}
              secondary={mode.enabled ? mode.description : `${mode.description} (coming soon)`}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
