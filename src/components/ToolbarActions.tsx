import {
  EditLocation as EditLocationIcon,
  FileDownload as FileDownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { CircularProgress, Divider, IconButton, Stack, Tooltip, useTheme } from '@mui/material';
import React from 'react';

import { ModeId } from '../modes';
import { Preset } from '../types';

import ModeSwitcher from './ModeSwitcher';
import PresetSelector from './PresetSelector';

interface ToolbarActionsProps {
  modeId: ModeId;
  onModeChange: (id: ModeId) => void;
  onRefreshWindsClick: () => void;
  onExportClick: () => void;
  targetEditOpen: boolean;
  onTargetEditToggle: () => void;
  /** Hidden when the mode keeps the target permanently draggable (flocking). */
  showTargetEdit?: boolean;
  fetching: boolean;
  showPresets: boolean;
  presets: Preset[];
  activePresetId: string | null;
  onPresetSelect: (id: string | null) => void;
  onPresetSave: (name?: string) => void;
  onPresetDelete: () => void;
  onPresetRename: (id: string, newName: string) => void;
}

export default function ToolbarActions({
  modeId,
  onModeChange,
  onRefreshWindsClick,
  onExportClick,
  targetEditOpen,
  onTargetEditToggle,
  showTargetEdit = true,
  fetching,
  showPresets,
  presets,
  activePresetId,
  onPresetSelect,
  onPresetSave,
  onPresetDelete,
  onPresetRename
}: ToolbarActionsProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <ModeSwitcher modeId={modeId} onChange={onModeChange} />
      <Divider orientation="vertical" flexItem />
      {showTargetEdit && (
        <EditTargetButton active={targetEditOpen} onClick={onTargetEditToggle} />
      )}
      <RefreshWindsButton onClick={onRefreshWindsClick} fetching={fetching} />
      <ExportButton onClick={onExportClick} />
      <Divider orientation="vertical" flexItem />
      {showPresets && (
        <PresetSelector
          presets={presets}
          activePresetId={activePresetId}
          onSelect={onPresetSelect}
          onSave={onPresetSave}
          onDelete={onPresetDelete}
          onRename={onPresetRename}
        />
      )}
    </Stack>
  );
}


function EditTargetButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const theme = useTheme();
  return (
    <Tooltip title={active ? 'Stop editing target' : 'Edit target on map'}>
      <IconButton
        type="button"
        aria-label="edit-target"
        onClick={onClick}
        sx={active ? { color: theme.palette.primary.main } : undefined}
      >
        <EditLocationIcon />
      </IconButton>
    </Tooltip>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title="Export FlySight 2 CSV">
      <IconButton type="button" aria-label="export" onClick={onClick}>
        <FileDownloadIcon />
      </IconButton>
    </Tooltip>
  );
}

function RefreshWindsButton({
  onClick,
  fetching
}: {
  onClick: () => void;
  fetching: boolean;
}) {
  const child = fetching ? (
    <CircularProgress size={24} />
  ) : (
    <IconButton type="button" aria-label="refresh-wind" onClick={() => onClick()}>
      <RefreshIcon />
    </IconButton>
  );

  return <Tooltip title="Refresh wind">{child}</Tooltip>;
}
